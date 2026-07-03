# Afriklang ASR

Service de transcription automatique de la parole (ASR) multi-langues, développé par Afriklang.

Modèles fusionnés autonomes (Whisper fine-tuné, aucune dépendance PEFT au runtime) :
- **`afriklang_asr_wo1`** — Wolof
- **`afriklang_asr_tw1`** — Twi

---

## Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/` | Redirige vers `/docs` (Swagger) |
| `POST` | `/transcribe/wo` | Transcription Wolof (fichier) → `{ "text": "..." }` |
| `POST` | `/transcribe/twi` | Transcription Twi (fichier) → `{ "text": "..." }` |
| `WS` | `/transcribe/live/{wo\|twi}` | Transcription live en streaming (voir ci-dessous) |
| `GET` | `/health` | État du service et des modèles |

### Transcription live (WebSocket)

Architecture inspirée de [huggingface/speech-to-speech](https://github.com/huggingface/speech-to-speech) :
**Silero VAD v5** détecte les débuts/fins de parole dans le flux, chaque segment est
transcrit par le modèle Whisper de la langue choisie.

Protocole :
- Le client envoie des frames **binaires** : PCM brut **16 kHz, int16 little-endian, mono**
  (taille de chunk libre, le serveur re-découpe).
- Frame texte `"stop"` → flush du segment en cours puis fermeture.
- Le serveur répond en JSON :
  - `{"type": "ready", ...}` à la connexion
  - `{"type": "speech_start"}` quand la parole démarre
  - `{"type": "transcript", "text": "...", "final": true}` à chaque segment transcrit
    (`"final": false` = segment partiel, la parole continue au-delà de ~28 s)

Client d'exemple : [examples/live_client.py](examples/live_client.py)
```bash
python examples/live_client.py mon_audio.wav --lang wo --url wss://asr.afriklang.com
```

---

## Démarrage rapide (local / CPU)

### 1. Environnement virtuel

```bash
python -m venv .venv
source .venv/bin/activate      # Windows : .venv\Scripts\activate
pip install -r requirements.txt
```

> `torch` doit être installé séparément si tu veux la version CUDA :
> `pip install torch --index-url https://download.pytorch.org/whl/cu118`

### 2. Modèle

**Option A — Manuel** (à faire une fois) :
```bash
aws s3 cp --recursive \
  s3://sagemaker-us-east-1-478335820298/models/afriklang_asr_wo1/ \
  ./afriklang_asr_wo1/
```

**Option B — Automatique** (téléchargement au démarrage si le modèle est absent) :
```bash
cp .env.example .env
# édite .env et renseigne S3_BUCKET / S3_PREFIX
```

### 3. Lancer

```bash
uvicorn app:app --host 0.0.0.0 --port 8000
```

Vérifie que le service est prêt : `curl http://localhost:8000/health`

---

## Docker

### Build

```bash
docker build -t afriklang-asr-wolof .
```

### Run

**Avec le modèle déjà en local :**
```bash
docker run --rm -p 8000:8000 \
  -v $(pwd)/afriklang_asr_wo1:/app/afriklang_asr_wo1 \
  afriklang-asr-wolof
```

**Avec téléchargement automatique depuis S3 :**
```bash
docker run --rm -p 8000:8000 \
  -e S3_BUCKET=sagemaker-us-east-1-478335820298 \
  -e S3_PREFIX=models/afriklang_asr_wo1 \
  -e AWS_ACCESS_KEY_ID=... \
  -e AWS_SECRET_ACCESS_KEY=... \
  afriklang-asr-wolof
```

**Avec GPU (nvidia-docker) :**
```bash
docker run --rm --gpus all -p 8000:8000 \
  -v $(pwd)/afriklang_asr_wo1:/app/afriklang_asr_wo1 \
  afriklang-asr-wolof
```

---

## Déploiement AWS (EC2 recommandé)

Instance recommandée pour la démo : **`g4dn.xlarge`** (GPU T4 16 Go, ~0,53 $/h).
Utiliser l'AMI « Deep Learning AMI (PyTorch) » — torch + CUDA déjà installés.

```bash
sudo apt-get update && sudo apt-get install -y ffmpeg
pip install -r requirements.txt   # torch fourni par l'AMI, ne pas réinstaller
uvicorn app:app --host 0.0.0.0 --port 8000
```

Ouvrir le port **8000** dans le Security Group (source = ton IP ou `0.0.0.0/0` pour la démo).

### Micro et HTTPS

`getUserMedia` (enregistrement micro) est bloqué en HTTP sur une IP distante.
L'**upload de fichier fonctionne en HTTP**. Pour le micro en démo rapide :

```bash
cloudflared tunnel --url http://localhost:8000
```

---

## Variables d'environnement

| Variable | Rôle | Défaut |
|----------|------|--------|
| `MODEL_DIR` | Dossier local du modèle | `./afriklang_asr_wo1` |
| `S3_BUCKET` | Bucket S3 pour téléchargement auto | _(non défini)_ |
| `S3_PREFIX` | Préfixe S3 du modèle | `models/afriklang_asr_wo1` |

Voir `.env.example` pour un template prêt à l'emploi.

---

## Structure du projet

```
.
├── app.py              # Application FastAPI + frontend intégré
├── requirements.txt    # Dépendances Python
├── Dockerfile          # Image Docker (python:3.11-slim + ffmpeg)
├── .env.example        # Template de configuration
└── .gitignore          # Exclusions git (venv, modèle, fichiers audio…)
```

---

## Roadmap (Phase 2)

- SageMaker Async Endpoint (scale-to-zero) pour facturation à l'usage uniquement
- Authentification par clé API
- Live transcription via WebSocket + chunking (nécessite GPU allumé en continu)

---

## Licence

`afriklang_asr_wo1` est un dérivé de `galsenai/whisper-large-v3-wo` (lui-même basé sur OpenAI Whisper large-v3, MIT).
Vérifier et respecter la licence GalsenAI avant tout usage commercial — attribution obligatoire.
