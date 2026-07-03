"""
Afriklang ASR — Service de transcription multi-langues (Afriklang).

Modèles chargés au démarrage :
  - afriklang_asr_wo1  (Wolof)
  - afriklang_asr_tw1  (Twi)

Endpoints :
  - POST /transcribe/{wo|twi}       transcription d'un fichier audio
  - WS   /transcribe/live/{wo|twi}  transcription live (PCM 16 kHz int16 mono + Silero VAD)

Lancement :
    uvicorn app:app --host 0.0.0.0 --port 8000

Variables d'environnement :
    MODEL_DIR_WO   dossier local du modèle Wolof  (défaut: ./afriklang_asr_wo1)
    MODEL_DIR_TWI  dossier local du modèle Twi    (défaut: ./afriklang_asr_tw1)
    S3_BUCKET      bucket S3 pour téléchargement auto (optionnel)
"""

import os
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("USE_TORCH", "1")

import asyncio
import tempfile
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager, suppress

import numpy as np
import torch
import librosa

from fastapi import FastAPI, UploadFile, File, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
from silero_vad import load_silero_vad, VADIterator

S3_BUCKET = os.environ.get("S3_BUCKET")

MODELS = {
    "wo": {
        "dir": os.environ.get("MODEL_DIR_WO", "./afriklang_asr_wo1"),
        "s3_prefix": "models/afriklang_asr_wo1",
        "name": "afriklang_asr_wo1",
        "pipeline": None,
    },
    "twi": {
        "dir": os.environ.get("MODEL_DIR_TWI", "./afriklang_asr_tw1"),
        "s3_prefix": "models/afriklang_asr_tw1",
        "name": "afriklang_asr_tw1",
        "pipeline": None,
    },
}

STATE = {"device": None}

# Le GPU ne traite qu'une inférence à la fois : un executor à 1 thread
# sérialise toutes les transcriptions (batch + live) sans bloquer la boucle asyncio.
ASR_EXECUTOR = ThreadPoolExecutor(max_workers=1)

# --- Paramètres du flux live ---
SAMPLE_RATE = 16000
VAD_WINDOW = 512            # taille de fenêtre imposée par Silero VAD v5 à 16 kHz (32 ms)
PRE_ROLL_WINDOWS = 16       # ~0,5 s d'audio conservé avant le déclenchement de la parole
MAX_SEGMENT_S = 28          # flush forcé avant la limite des 30 s de Whisper


def _ensure_model_local(model_dir: str, s3_prefix: str):
    if os.path.exists(os.path.join(model_dir, "config.json")):
        return
    if not S3_BUCKET:
        raise RuntimeError(
            f"Modele absent dans '{model_dir}' et S3_BUCKET non defini."
        )
    import boto3
    os.makedirs(model_dir, exist_ok=True)
    s3 = boto3.client("s3")
    for obj in s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=s3_prefix).get("Contents", []):
        fname = os.path.basename(obj["Key"])
        if fname:
            s3.download_file(S3_BUCKET, obj["Key"], os.path.join(model_dir, fname))
            print("[afriklang] telecharge :", fname)


def _load_pipeline(model_dir: str, device: str, dtype) -> pipeline:
    model = AutoModelForSpeechSeq2Seq.from_pretrained(model_dir, torch_dtype=dtype).to(device)
    processor = AutoProcessor.from_pretrained(model_dir)
    model.config.use_cache = True
    return pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        torch_dtype=dtype,
        device=0 if device == "cuda" else -1,
        chunk_length_s=30,
    )


def _load_all_models():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device == "cuda" else torch.float32
    STATE["device"] = device

    for lang, cfg in MODELS.items():
        _ensure_model_local(cfg["dir"], cfg["s3_prefix"])
        cfg["pipeline"] = _load_pipeline(cfg["dir"], device, dtype)
        print(f"[afriklang] {cfg['name']} chargé sur {device}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_all_models()
    yield


app = FastAPI(
    title="Afriklang ASR",
    description="API de transcription automatique — Wolof (wo) et Twi (twi). "
                "Fichier via POST /transcribe/{lang}, live via WebSocket /transcribe/live/{lang}.",
    version="2.1.0",
    lifespan=lifespan,
)

# Ouvert pour permettre aux frontends de test (local ou distants) d'appeler l'API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _transcribe_file_sync(cfg: dict, tmp_path: str) -> str:
    arr, _ = librosa.load(tmp_path, sr=SAMPLE_RATE, mono=True)
    return cfg["pipeline"](arr)["text"].strip()


async def _run_transcription(lang: str, file_data: bytes, filename: str) -> JSONResponse:
    cfg = MODELS.get(lang)
    if cfg is None:
        return JSONResponse({"error": f"Langue '{lang}' non supportée"}, status_code=400)
    if cfg["pipeline"] is None:
        return JSONResponse({"error": f"Modèle '{lang}' non chargé"}, status_code=503)

    suffix = os.path.splitext(filename or "")[1] or ".webm"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(file_data)
            tmp_path = tmp.name
        loop = asyncio.get_event_loop()
        text = await loop.run_in_executor(ASR_EXECUTOR, _transcribe_file_sync, cfg, tmp_path)
        return JSONResponse({"text": text, "language": lang, "model": cfg["name"]})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": STATE["device"],
        "models": {
            lang: {"name": cfg["name"], "loaded": cfg["pipeline"] is not None}
            for lang, cfg in MODELS.items()
        },
    }


@app.post("/transcribe/wo", summary="Transcription Wolof")
async def transcribe_wo(file: UploadFile = File(...)):
    data = await file.read()
    return await _run_transcription("wo", data, file.filename)


@app.post("/transcribe/twi", summary="Transcription Twi")
async def transcribe_twi(file: UploadFile = File(...)):
    data = await file.read()
    return await _run_transcription("twi", data, file.filename)


@app.post("/transcribe", summary="Transcription Wolof (rétrocompatibilité)", include_in_schema=False)
async def transcribe_legacy(file: UploadFile = File(...)):
    data = await file.read()
    return await _run_transcription("wo", data, file.filename)


# --------------------------------------------------------------------------
# Transcription live (WebSocket)
#
# Protocole :
#   - Le client envoie des frames BINAIRES : PCM brut 16 kHz, int16 little-endian, mono.
#     La taille des chunks est libre, le serveur re-découpe en fenêtres de 512 échantillons.
#   - Le client peut envoyer la frame TEXTE "stop" pour flusher le segment en cours et fermer.
#   - Le serveur envoie des messages JSON :
#       {"type": "ready", ...}                          à la connexion
#       {"type": "speech_start"}                        début de parole détecté (Silero VAD)
#       {"type": "transcript", "text": ..., "final": bool}   segment transcrit
# --------------------------------------------------------------------------

@app.websocket("/transcribe/live/{lang}")
async def transcribe_live(ws: WebSocket, lang: str):
    await ws.accept()

    cfg = MODELS.get(lang)
    if cfg is None or cfg["pipeline"] is None:
        await ws.send_json({"type": "error", "error": f"Langue '{lang}' non disponible"})
        await ws.close(code=4004)
        return

    # Une instance VAD par connexion : le modèle Silero garde un état interne
    # (récurrent) qui ne doit pas être partagé entre plusieurs flux.
    vad = VADIterator(
        load_silero_vad(),
        threshold=0.5,
        sampling_rate=SAMPLE_RATE,
        min_silence_duration_ms=600,
        speech_pad_ms=100,
    )

    loop = asyncio.get_event_loop()
    pcm_rest = b""                              # octets pas encore alignés sur une fenêtre
    pre_roll = deque(maxlen=PRE_ROLL_WINDOWS)   # contexte audio avant le début de parole
    segment: list[np.ndarray] = []
    in_speech = False

    async def flush(final: bool):
        nonlocal segment
        if not segment:
            return
        audio = np.concatenate(segment)
        segment = []
        text = await loop.run_in_executor(
            ASR_EXECUTOR, lambda: cfg["pipeline"](audio)["text"].strip()
        )
        if text:
            await ws.send_json(
                {"type": "transcript", "text": text, "language": lang, "final": final}
            )

    await ws.send_json({
        "type": "ready",
        "language": lang,
        "model": cfg["name"],
        "format": "pcm s16le 16kHz mono",
    })

    try:
        while True:
            msg = await ws.receive()
            if msg.get("type") == "websocket.disconnect":
                break

            if msg.get("text") is not None:
                if msg["text"].strip().lower() == "stop":
                    if in_speech:
                        await flush(final=True)
                    break
                continue

            pcm_rest += msg.get("bytes") or b""
            n_win = len(pcm_rest) // (VAD_WINDOW * 2)

            for i in range(n_win):
                chunk = pcm_rest[i * VAD_WINDOW * 2:(i + 1) * VAD_WINDOW * 2]
                win = np.frombuffer(chunk, dtype=np.int16).astype(np.float32) / 32768.0
                event = vad(torch.from_numpy(win))

                if in_speech:
                    segment.append(win)
                    if event and "end" in event:
                        in_speech = False
                        await flush(final=True)
                    elif len(segment) * VAD_WINDOW / SAMPLE_RATE > MAX_SEGMENT_S:
                        # la parole continue : on transcrit ce qu'on a pour ne pas
                        # dépasser la fenêtre de 30 s de Whisper
                        await flush(final=False)
                else:
                    pre_roll.append(win)
                    if event and "start" in event:
                        in_speech = True
                        segment = list(pre_roll)
                        pre_roll.clear()
                        await ws.send_json({"type": "speech_start"})

            pcm_rest = pcm_rest[n_win * VAD_WINDOW * 2:]
    except Exception:
        pass
    finally:
        vad.reset_states()
        with suppress(Exception):
            await ws.close()


@app.get("/", include_in_schema=False)
def index():
    return RedirectResponse(url="/docs")
