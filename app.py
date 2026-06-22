"""
afriklang_asr_wolof — Service de transcription ASR wolof (Afriklang).

Charge le modèle fusionné AUTONOME 'afriklang_asr_wo1' :
aucune dépendance PEFT ni GalsenAI au runtime, une seule ligne de chargement.

Lancement :
    uvicorn app:app --host 0.0.0.0 --port 8000

Variables d'environnement :
    MODEL_DIR   dossier local du modèle (défaut: ./afriklang_asr_wo1)
    S3_BUCKET   bucket S3 d'où télécharger le modèle s'il est absent en local (optionnel)
    S3_PREFIX   préfixe S3 du modèle (défaut: models/afriklang_asr_wo1)
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

MODEL_DIR = os.environ.get("MODEL_DIR", "./afriklang_asr_wo1")
S3_BUCKET = os.environ.get("S3_BUCKET")
S3_PREFIX = os.environ.get("S3_PREFIX", "models/afriklang_asr_wo1")

STATE = {"asr": None, "device": None}


def _ensure_model_local():
    """Télécharge le modèle depuis S3 s'il n'est pas déjà présent en local."""
    if os.path.exists(os.path.join(MODEL_DIR, "config.json")):
        return
    if not S3_BUCKET:
        raise RuntimeError(
            f"Modele absent dans '{MODEL_DIR}' et S3_BUCKET non defini. "
            f"Place le modele en local ou definis S3_BUCKET + S3_PREFIX."
        )
    import boto3
    os.makedirs(MODEL_DIR, exist_ok=True)
    s3 = boto3.client("s3")
    for obj in s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=S3_PREFIX).get("Contents", []):
        fname = os.path.basename(obj["Key"])
        if fname:
            s3.download_file(S3_BUCKET, obj["Key"], os.path.join(MODEL_DIR, fname))
            print("[afriklang] telecharge :", fname)


def _load_model():
    _ensure_model_local()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype  = torch.float16 if device == "cuda" else torch.float32

    model     = AutoModelForSpeechSeq2Seq.from_pretrained(MODEL_DIR, torch_dtype=dtype).to(device)
    processor = AutoProcessor.from_pretrained(MODEL_DIR)
    model.config.use_cache = True

    STATE["asr"] = pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        torch_dtype=dtype,
        device=0 if device == "cuda" else -1,
        chunk_length_s=30,
    )
    STATE["device"] = device
    print(f"[afriklang_asr_wolof] afriklang_asr_wo1 charge sur {device}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_model()
    yield


app = FastAPI(title="afriklang_asr_wolof", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok", "model": "afriklang_asr_wo1",
            "device": STATE["device"], "loaded": STATE["asr"] is not None}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if STATE["asr"] is None:
        return JSONResponse({"error": "Modele non charge"}, status_code=503)

    data = await file.read()
    suffix = os.path.splitext(file.filename or "")[1] or ".webm"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        arr, _ = librosa.load(tmp_path, sr=16000, mono=True)   # wav/mp3/m4a/webm -> 16kHz mono
        text = STATE["asr"](arr)["text"].strip()
        return JSONResponse({"text": text})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.get("/", include_in_schema=False)
def index():
    return RedirectResponse(url="/docs")
