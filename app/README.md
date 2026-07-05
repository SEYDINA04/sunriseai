# Afriklang ASR & TTS

Service de transcription (ASR) et de synthèse vocale (TTS) multi-langues, développé par Afriklang.

Modèles :
- **`afriklang_asr_wo1`** — ASR Wolof (Whisper fine-tuné, fusionné, autonome)
- **`afriklang_asr_tw1`** — ASR Twi (Whisper fine-tuné, fusionné, autonome)
- **`afriklang_twi_ttsv1`** — TTS Twi ([VoxCPM2](https://github.com/OpenBMB/VoxCPM), latent AudioVAE, sortie native 48 kHz)

---

## Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/` | Redirige vers `/docs` (Swagger) |
| `POST` | `/transcribe/wo` | Transcription Wolof (fichier) → `{ "text": "..." }` |
| `POST` | `/transcribe/twi` | Transcription Twi (fichier) → `{ "text": "..." }` |
| `WS` | `/transcribe/live/{wo\|twi}` | Transcription live en streaming (voir ci-dessous) |
| `POST` | `/tts/twi` | Synthèse vocale Twi : `{ "text": "..." }` → audio `audio/wav` (48 kHz) |
| `GET` | `/health` | État du service et des modèles |

Les endpoints `/transcribe/*` acceptent un paramètre optionnel `?target_lang=fr` (ou `en`) :
le texte transcrit est alors aussi traduit via un LLM (RodiumAI, `gpt-4o-mini` par défaut),
et renvoyé dans le champ `translation` (fichier) ou via un message `{"type": "translation", ...}` (live).
Nécessite la variable d'environnement `RODIUMAI_API_KEY` — sans elle, le paramètre est simplement ignoré.

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

### Synthèse vocale (TTS)

```bash
curl -X POST https://asr.afriklang.com/tts/twi \
  -H "Content-Type: application/json" \
  -d '{"text": "Wo ho te sɛn?"}' \
  --output sortie.wav
```

Renvoie directement le flux audio (`audio/wav`, 48 kHz) — pas de JSON.
Le modèle est chargé au démarrage avec les modèles ASR ; comme eux, il partage l'executor
GPU à un seul thread (une seule inférence à la fois, ASR ou TTS).

> ⚠️ VoxCPM2 fait ~5 Go (poids + AudioVAE), en plus des ~4,5 Go des deux modèles ASR (fp16).
> Sur `g4dn.xlarge` (T4 16 Go), la marge reste correcte mais à surveiller (`nvidia-smi`) au fil
> des futurs modèles ajoutés.

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
Utiliser l'AMI « Deep Learning OSS Nvidia Driver AMI GPU PyTorch » (Amazon Linux 2023) —
torch + CUDA déjà installés.

```bash
pip install -r requirements.txt   # torch fourni par l'AMI, ne pas réinstaller
uvicorn app:app --host 0.0.0.0 --port 8000
```

Ouvrir le port **8000** dans le Security Group (source = ton IP ou `0.0.0.0/0` pour la démo).

### FFmpeg (bibliothèques partagées requises)

Amazon Linux 2023 n'a pas `ffmpeg` dans ses dépôts `dnf`. **N'installe pas un build
statique** (type johnvansickle.com) : `voxcpm` (via `torchaudio`/`torchcodec`) a besoin
des bibliothèques partagées (`libavutil.so`, etc.), qu'un binaire statique ne fournit pas —
symptôme observé : `500` sur `/transcribe/*` avec `OSError: libavutil.so.59: cannot open
shared object file`, alors que `/tts/*` fonctionne (VoxCPM ne passe pas par ce chemin).

Installer un build **shared** à la place :
```bash
curl -sL -o /tmp/ffmpeg.tar.xz \
  https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n7.1-latest-linux64-gpl-shared-7.1.tar.xz
cd /tmp && tar -xf ffmpeg.tar.xz
sudo cp ffmpeg-n7.1-latest-linux64-gpl-shared-7.1/lib/*.so* /usr/local/lib/
sudo cp ffmpeg-n7.1-latest-linux64-gpl-shared-7.1/bin/* /usr/local/bin/
echo '/usr/local/lib' | sudo tee /etc/ld.so.conf.d/local-ffmpeg.conf
sudo ldconfig
```

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
| `MODEL_DIR_WO` | Dossier local du modèle ASR Wolof | `./afriklang_asr_wo1` |
| `MODEL_DIR_TWI` | Dossier local du modèle ASR Twi | `./afriklang_asr_tw1` |
| `MODEL_DIR_TTS_TWI` | Dossier local du modèle TTS Twi | `./afriklang_twi_ttsv1` |
| `S3_BUCKET` | Bucket S3 pour téléchargement auto des modèles | _(non défini)_ |
| `RODIUMAI_API_KEY` | Clé API RodiumAI pour la traduction | _(non défini — `target_lang` ignoré)_ |
| `TRANSLATION_MODEL` | Modèle RodiumAI utilisé pour traduire | `openai/gpt-4o-mini` |

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
