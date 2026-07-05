"""
Afriklang ASR — Service de transcription multi-langues (Afriklang).

Modèles chargés au démarrage :
  - afriklang_asr_wo1  (Wolof)
  - afriklang_asr_tw1  (Twi)

Endpoints :
  - POST /transcribe/{wo|twi}       transcription d'un fichier audio (option ?target_lang=fr pour traduire)
  - WS   /transcribe/live/{wo|twi}  transcription live (PCM 16 kHz int16 mono + Silero VAD),
                                     traduction optionnelle via ?target_lang=fr
  - POST /tts/twi                   synthèse vocale Twi : {"text": "..."} -> audio/wav (48 kHz)

Lancement :
    uvicorn app:app --host 0.0.0.0 --port 8000

Variables d'environnement :
    MODEL_DIR_WO       dossier local du modèle ASR Wolof  (défaut: ./afriklang_asr_wo1)
    MODEL_DIR_TWI      dossier local du modèle ASR Twi    (défaut: ./afriklang_asr_tw1)
    MODEL_DIR_TTS_TWI  dossier local du modèle TTS Twi    (défaut: ./afriklang_twi_ttsv1)
    S3_BUCKET          bucket S3 pour téléchargement auto (optionnel)
    RODIUMAI_API_KEY   clé API RodiumAI pour la traduction (optionnel — sans elle, ?target_lang est ignoré)
    TRANSLATION_MODEL  modèle RodiumAI utilisé pour la traduction (défaut: openai/gpt-4o-mini)
"""

import os
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("USE_TORCH", "1")

import asyncio
import io
import tempfile
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager, suppress

import numpy as np
import torch
import librosa
import soundfile as sf

from fastapi import FastAPI, UploadFile, File, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, Response
from pydantic import BaseModel

from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
from silero_vad import load_silero_vad, VADIterator
from openai import AsyncOpenAI
from voxcpm import VoxCPM

S3_BUCKET = os.environ.get("S3_BUCKET")

# --- Traduction (via RodiumAI, API compatible OpenAI) ---
RODIUMAI_API_KEY = os.environ.get("RODIUMAI_API_KEY")
TRANSLATION_MODEL = os.environ.get("TRANSLATION_MODEL", "openai/gpt-4o-mini")
TRANSLATION_CLIENT = (
    AsyncOpenAI(api_key=RODIUMAI_API_KEY, base_url="https://api.rodiumai.io/v1")
    if RODIUMAI_API_KEY else None
)
LANG_NAMES = {"fr": "français", "en": "anglais", "es": "espagnol", "wo": "wolof", "twi": "twi"}

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

# --- Synthèse vocale (TTS) : VoxCPM2, latent AudioVAE, sortie native 48 kHz ---
TTS_MODELS = {
    "twi": {
        "dir": os.environ.get("MODEL_DIR_TTS_TWI", "./afriklang_twi_ttsv1"),
        "s3_prefix": "models/afriklang_twi_ttsv1",
        "name": "afriklang_twi_ttsv1",
        "model": None,
    },
}

STATE = {"device": None}

# Le GPU ne traite qu'une inférence à la fois (ASR ou TTS) : un executor à 1 thread
# sérialise tous les appels modèle sans bloquer la boucle asyncio.
INFERENCE_EXECUTOR = ThreadPoolExecutor(max_workers=1)

# --- Paramètres du flux live ---
SAMPLE_RATE = 16000
VAD_WINDOW = 512            # taille de fenêtre imposée par Silero VAD v5 à 16 kHz (32 ms)
PRE_ROLL_WINDOWS = 16       # ~0,5 s d'audio conservé avant le déclenchement de la parole
MAX_SEGMENT_S = 28          # flush forcé avant la limite des 30 s de Whisper
MIN_SEGMENT_S = 0.35        # sous ce seuil, un déclenchement VAD est un faux positif (bruit/souffle)

# Seuils natifs Whisper pour éviter les hallucinations sur silence/bruit
# (cf. https://github.com/openai/whisper/discussions/679) : plutôt que d'inventer
# du texte plausible sur un segment sans vraie parole, le modèle le signale comme vide.
WHISPER_GENERATE_KWARGS = {
    "no_speech_threshold": 0.6,
    "logprob_threshold": -1.0,
    "compression_ratio_threshold": 2.4,
    "condition_on_prev_tokens": False,
    # Requis par transformers pour activer le mécanisme de repli ci-dessus : sans
    # cette échelle de températures, generate_with_fallback() compare `None > 0.0`
    # en interne et plante (TypeError). Échelle standard du CLI Whisper d'OpenAI.
    "temperature": (0.0, 0.2, 0.4, 0.6, 0.8, 1.0),
}

# Whisper (et ses fine-tunes) hallucinent des mentions de crédit de sous-titrage
# sur du silence — signature bien connue héritée de données d'entraînement sous-titrées.
HALLUCINATION_PATTERNS = (
    "sous-titr", "sous titr", "amara.org", "abonnez-vous",
    "merci d'avoir regardé", "merci pour votre attention",
)


def _is_hallucination(text: str) -> bool:
    t = text.lower()
    return any(p in t for p in HALLUCINATION_PATTERNS)


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

    for lang, cfg in TTS_MODELS.items():
        _ensure_model_local(cfg["dir"], cfg["s3_prefix"])
        cfg["model"] = VoxCPM.from_pretrained(cfg["dir"], load_denoiser=False)
        print(f"[afriklang] {cfg['name']} chargé (TTS)")


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
    text = cfg["pipeline"](arr, generate_kwargs=WHISPER_GENERATE_KWARGS)["text"].strip()
    return "" if _is_hallucination(text) else text


async def _translate(text: str, source_lang: str, target_lang: str) -> str | None:
    """Traduit `text` de `source_lang` vers `target_lang` via un LLM (RodiumAI).
    Déclarer explicitement la langue source est nécessaire : sans elle, GPT-4o-mini
    devine parfois mal (ex. laisse des mots wolof non traduits) — avec elle, le
    résultat est stable sur des essais répétés. Renvoie None si indisponible (pas
    de clé, texte vide, ou erreur réseau/API) — la traduction est toujours une
    amélioration optionnelle, jamais bloquante."""
    if not TRANSLATION_CLIENT or not text:
        return None
    source_name = LANG_NAMES.get(source_lang, source_lang)
    target_name = LANG_NAMES.get(target_lang, target_lang)
    try:
        resp = await TRANSLATION_CLIENT.chat.completions.create(
            model=TRANSLATION_MODEL,
            messages=[{
                "role": "user",
                "content": f"Traduis ce texte du {source_name} vers le {target_name}. Réponds "
                           f"uniquement avec la traduction, sans aucune explication ni guillemets : {text}",
            }],
            max_tokens=500,
            temperature=0,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[afriklang] erreur traduction : {e}")
        return None


async def _run_transcription(
    lang: str, file_data: bytes, filename: str, target_lang: str | None = None
) -> JSONResponse:
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
        text = await loop.run_in_executor(INFERENCE_EXECUTOR, _transcribe_file_sync, cfg, tmp_path)
        result = {"text": text, "language": lang, "model": cfg["name"]}
        if target_lang:
            translation = await _translate(text, lang, target_lang)
            result["translation"] = translation
            result["target_lang"] = target_lang
        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


def _synthesize_tts_sync(cfg: dict, text: str) -> bytes:
    wav = cfg["model"].generate(text=text, cfg_value=2.0, inference_timesteps=10)
    sample_rate = getattr(getattr(cfg["model"], "tts_model", None), "sample_rate", 48000)
    buf = io.BytesIO()
    sf.write(buf, wav, sample_rate, format="WAV")
    return buf.getvalue()


class TTSRequest(BaseModel):
    text: str


async def _run_tts(lang: str, req: TTSRequest):
    cfg = TTS_MODELS.get(lang)
    if cfg is None:
        return JSONResponse({"error": f"Langue '{lang}' non supportée en TTS"}, status_code=400)
    if cfg["model"] is None:
        return JSONResponse({"error": f"Modèle TTS '{lang}' non chargé"}, status_code=503)
    if not req.text.strip():
        return JSONResponse({"error": "Texte vide"}, status_code=400)
    try:
        loop = asyncio.get_event_loop()
        wav_bytes = await loop.run_in_executor(INFERENCE_EXECUTOR, _synthesize_tts_sync, cfg, req.text)
        return Response(content=wav_bytes, media_type="audio/wav")
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/tts/twi", summary="Synthèse vocale Twi (texte → audio)")
async def tts_twi(req: TTSRequest):
    return await _run_tts("twi", req)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": STATE["device"],
        "models": {
            lang: {"name": cfg["name"], "loaded": cfg["pipeline"] is not None}
            for lang, cfg in MODELS.items()
        },
        "tts_models": {
            lang: {"name": cfg["name"], "loaded": cfg["model"] is not None}
            for lang, cfg in TTS_MODELS.items()
        },
    }


@app.post("/transcribe/wo", summary="Transcription Wolof")
async def transcribe_wo(file: UploadFile = File(...), target_lang: str | None = None):
    data = await file.read()
    return await _run_transcription("wo", data, file.filename, target_lang)


@app.post("/transcribe/twi", summary="Transcription Twi")
async def transcribe_twi(file: UploadFile = File(...), target_lang: str | None = None):
    data = await file.read()
    return await _run_transcription("twi", data, file.filename, target_lang)


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
#   - Query param optionnel ?target_lang=fr : chaque segment FINAL est aussi traduit.
#   - Le serveur envoie des messages JSON :
#       {"type": "ready", ...}                          à la connexion
#       {"type": "speech_start"}                        début de parole détecté (Silero VAD)
#       {"type": "transcript", "text": ..., "final": bool}   segment transcrit
#       {"type": "translation", "text": ..., "target_lang": ...}  traduction du segment final
# --------------------------------------------------------------------------

@app.websocket("/transcribe/live/{lang}")
async def transcribe_live(ws: WebSocket, lang: str, target_lang: str | None = None):
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
        threshold=0.6,
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

        # Un déclenchement VAD trop court est presque toujours un faux positif
        # (bruit, souffle, clic) — l'envoyer à Whisper ne ferait qu'halluciner.
        if len(audio) / SAMPLE_RATE < MIN_SEGMENT_S:
            return

        text = await loop.run_in_executor(
            INFERENCE_EXECUTOR,
            lambda: cfg["pipeline"](audio, generate_kwargs=WHISPER_GENERATE_KWARGS)["text"].strip(),
        )
        if text and _is_hallucination(text):
            print(f"[afriklang] hallucination filtrée : {text!r}")
            text = ""
        if text:
            await ws.send_json(
                {"type": "transcript", "text": text, "language": lang, "final": final}
            )
            if final and target_lang:
                translation = await _translate(text, lang, target_lang)
                if translation:
                    await ws.send_json(
                        {"type": "translation", "text": translation, "target_lang": target_lang}
                    )

    await ws.send_json({
        "type": "ready",
        "language": lang,
        "model": cfg["name"],
        "format": "pcm s16le 16kHz mono",
        "target_lang": target_lang,
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
