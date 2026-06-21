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
from fastapi.responses import HTMLResponse, JSONResponse

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


@app.get("/", response_class=HTMLResponse)
def index():
    return HTML_PAGE


# --- Frontend (palette Afriklang : violet #321E53, ambre #F4A261, Arial) ---
HTML_PAGE = """
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>afriklang_asr_wolof</title>
<style>
  :root { --violet:#321E53; --amber:#F4A261; }
  * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
  body { margin:0; background:#f5f3f8; color:var(--violet); }
  header { background:var(--violet); color:#fff; padding:20px 24px; }
  header h1 { margin:0; font-size:20px; letter-spacing:.3px; }
  header p { margin:4px 0 0; opacity:.8; font-size:13px; }
  main { max-width:720px; margin:28px auto; padding:0 16px; }
  .card { background:#fff; border-radius:12px; padding:22px; margin-bottom:18px;
          box-shadow:0 1px 3px rgba(50,30,83,.12); }
  .card h2 { margin:0 0 14px; font-size:15px; color:var(--violet); }
  button { background:var(--amber); color:var(--violet); border:none; border-radius:8px;
           padding:11px 18px; font-size:14px; font-weight:bold; cursor:pointer; }
  button:disabled { opacity:.5; cursor:not-allowed; }
  input[type=file] { font-size:14px; }
  #rec.recording { background:#c0392b; color:#fff; }
  .out { margin-top:16px; padding:14px; background:#faf7ff; border-left:4px solid var(--amber);
         border-radius:6px; min-height:24px; white-space:pre-wrap; font-size:15px; }
  .muted { color:#7a6f8c; font-size:12px; margin-top:8px; }
  .row { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
</style>
</head>
<body>
<header>
  <h1>afriklang_asr_wolof</h1>
  <p>Transcription automatique du wolof — Afriklang</p>
</header>
<main>
  <div class="card">
    <h2>1. Uploader un fichier audio</h2>
    <div class="row">
      <input type="file" id="audioFile" accept="audio/*">
      <button id="btnUpload">Transcrire</button>
    </div>
    <div class="muted">Formats : wav, mp3, m4a, ogg…</div>
    <div class="out" id="outUpload"></div>
  </div>

  <div class="card">
    <h2>2. Enregistrer depuis le micro</h2>
    <div class="row">
      <button id="rec">● Enregistrer</button>
    </div>
    <div class="muted">Le micro nécessite une connexion sécurisée (HTTPS) ou localhost.</div>
    <div class="out" id="outRec"></div>
  </div>
</main>

<script>
async function sendAudio(blob, filename, outEl) {
  outEl.textContent = "Transcription en cours…";
  const fd = new FormData();
  fd.append("file", blob, filename);
  try {
    const r = await fetch("/transcribe", { method:"POST", body: fd });
    const j = await r.json();
    outEl.textContent = j.text ? j.text : ("Erreur : " + (j.error || "inconnue"));
  } catch (e) {
    outEl.textContent = "Erreur réseau : " + e;
  }
}

document.getElementById("btnUpload").onclick = () => {
  const f = document.getElementById("audioFile").files[0];
  if (!f) { document.getElementById("outUpload").textContent = "Choisis un fichier d'abord."; return; }
  sendAudio(f, f.name, document.getElementById("outUpload"));
};

let mediaRecorder, chunks = [];
const recBtn = document.getElementById("rec");
recBtn.onclick = async () => {
  if (mediaRecorder && mediaRecorder.state === "recording") { mediaRecorder.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    chunks = [];
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      stream.getTracks().forEach(t => t.stop());
      recBtn.textContent = "● Enregistrer"; recBtn.classList.remove("recording");
      sendAudio(blob, "recording.webm", document.getElementById("outRec"));
    };
    mediaRecorder.start();
    recBtn.textContent = "■ Arrêter"; recBtn.classList.add("recording");
  } catch (e) {
    document.getElementById("outRec").textContent = "Micro inaccessible (HTTPS requis) : " + e;
  }
};
</script>
</body>
</html>
"""
