"""
Afriklang ASR — Service de transcription multi-langues (Afriklang).

Modèles chargés au démarrage :
  - afriklang_asr_wo1  (Wolof)
  - afriklang_asr_tw1  (Twi)

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

import tempfile
import torch
import librosa
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse, RedirectResponse

from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline

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
    description="API de transcription automatique — Wolof (wo) et Twi (twi)",
    version="2.0.0",
    lifespan=lifespan,
)


def _run_transcription(lang: str, file_data: bytes, filename: str) -> JSONResponse:
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
        arr, _ = librosa.load(tmp_path, sr=16000, mono=True)
        text = cfg["pipeline"](arr)["text"].strip()
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
    return _run_transcription("wo", data, file.filename)


@app.post("/transcribe/twi", summary="Transcription Twi")
async def transcribe_twi(file: UploadFile = File(...)):
    data = await file.read()
    return _run_transcription("twi", data, file.filename)


@app.post("/transcribe", summary="Transcription Wolof (rétrocompatibilité)", include_in_schema=False)
async def transcribe_legacy(file: UploadFile = File(...)):
    data = await file.read()
    return _run_transcription("wo", data, file.filename)


@app.get("/", include_in_schema=False)
def index():
    return RedirectResponse(url="/docs")
