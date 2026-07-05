# Teekiai

**Speech AI for West African low-resource languages — Wolof, Twi & Fon**

AI for Good Hackathon · Submission for the FTK "AI for Good" challenge

---

## 1. Overview

**Teekiai** is a speech-AI platform that brings automatic speech recognition
(ASR), text-to-speech (TTS) and translation to West African languages that
mainstream models ignore. It targets a concrete gap: for low-resource African
languages such as **Wolof**, **Twi** and **Fon**, no reliable speech technology
exists today, so voice — the most natural interface for millions of speakers —
stays locked out of digital products.

> **One-line pitch:** *Give African languages a voice that machines can hear, read and speak.*

Teekiai turns speech into searchable, actionable text, translates it on demand,
and speaks text back out loud — all through one simple chat interface backed by
in-house fine-tuned models.

### What we are implementing

The platform is powered by an in-house engine built on top of **fine-tuned
Whisper** (ASR) and **VoxCPM** (TTS) models, served from our own GPU
infrastructure — **no dependency on any third-party speech API**. This repository
contains the full end-to-end stack: the model-serving backend and the web
interface built on top of it for the hackathon demo.

### Capabilities

| Capability | Languages | Status |
|-----------|-----------|--------|
| **ASR** — speech → text | Wolof, Twi | Live (Fon coming) |
| **TTS** — text → speech | Twi | Live (Wolof, Fon coming) |
| **Translation** — to French / English | Wolof, Twi (as an add-on to ASR) | Live (optional) |
| **Live transcription** — real-time streaming | Wolof, Twi | Live |

---

## 2. Repository Structure

Teekiai is a monorepo with two independent, deployable parts:

```
teekiai/
├── app/          Python backend — FastAPI service serving the AI models
│   ├── app.py            ASR + TTS + translation service
│   ├── requirements.txt
│   ├── Dockerfile        python:3.11-slim + ffmpeg
│   └── examples/         CLI client for the live WebSocket
│
└── interface/    Next.js frontend — the chat web app
    ├── src/app/          App Router pages + API route handlers (proxies)
    ├── src/components/   Chat UI (React 19 + Tailwind 4)
    ├── src/hooks/        Recorder, live WebSocket ASR, chat controller
    └── src/lib/          Audio processing, ASR/TTS clients, i18n
```

---

## 3. System Architecture

Teekiai follows a clear separation between the **model backend** and the
**web frontend**, connected through a thin proxy layer.

```
Browser (mic / upload / text)
        │
        ▼
   Next.js Interface        ── chat UI, records & decodes audio in-browser
        │
        ├── /api/asr/transcribe   (server proxy: rate-limit, auth, timeout guard)
        ├── /api/tts/twi          (server proxy)
        │
        ▼
   FastAPI Backend          ── receives audio/text, routes to the right model
        │
        ├── ASR pipeline     ── fine-tuned Whisper (Wolof / Twi)
        ├── TTS pipeline     ── VoxCPM (Twi), 48 kHz output
        └── Translation      ── optional LLM pass (French / English)
        │
        ▼
   Live path (WebSocket)    ── raw PCM stream + Silero VAD → per-segment ASR
```

### Design principles

- **Own the models, own the pipeline.** ASR and TTS run entirely on in-house
  fine-tuned models; only the optional translation step calls an external LLM,
  and it is never blocking.
- **The browser does the heavy audio prep.** Audio is decoded and resampled to
  16 kHz mono client-side, guaranteeing format compatibility regardless of the
  server's installed codecs.
- **The frontend never exposes the backend for file requests.** All file-based
  calls go through Next.js route handlers that add rate-limiting, same-origin
  checks, size limits and timeout handling.

---

## 4. Technology Stack

### 4.1 Core Models

| Component | Technology | Role |
|-----------|-----------|------|
| ASR base model | **OpenAI Whisper large-v3** | Foundation speech-to-text architecture |
| Wolof ASR | Fine-tuned, merged standalone model | Speech recognition (Wolof) |
| Twi ASR | Fine-tuned, merged standalone model | Speech recognition (Twi) |
| Twi TTS | **VoxCPM** (AudioVAE latent, 48 kHz) | Text-to-speech (Twi) |
| Runtime dependency | **None (PEFT merged)** | Adapters baked into weights — no PEFT at runtime |

The ASR models are **merged and autonomous**: adapters are fused into the
weights, so inference has no PEFT dependency and can be served directly.

### 4.2 Voice Activity Detection (Live mode)

| Component | Technology | Role |
|-----------|-----------|------|
| VAD | **Silero VAD v5** | Detects speech start/end in the live audio stream |
| Streaming pattern | Inspired by **`huggingface/speech-to-speech`** | Each detected segment is transcribed independently |

### 4.3 Backend & API

| Component | Technology | Role |
|-----------|-----------|------|
| API framework | **FastAPI** | HTTP + WebSocket endpoints, auto-generated Swagger docs |
| ASR endpoint | `POST /transcribe/{wo\|twi}` | File-based transcription → `{ "text": "..." }` |
| Live endpoint | `WS /transcribe/live/{wo\|twi}` | Streaming transcription over WebSocket |
| TTS endpoint | `POST /tts/twi` | Text → `audio/wav` (48 kHz) |
| Health endpoint | `GET /health` | Service and model readiness |
| Server | **Uvicorn** (ASGI) | Runs the FastAPI application |
| Audio processing | **ffmpeg + librosa + soundfile** | Audio decoding / format normalization |
| Runtime | **Python 3.11** | Language runtime |

### 4.4 Frontend

| Component | Technology | Role |
|-----------|-----------|------|
| Framework | **Next.js 16 (App Router) + React 19** | Chat interface + server route handlers |
| Styling | **Tailwind CSS 4** | UI styling |
| Icons / flags | **lucide-react**, **react-circle-flags** | UI assets |
| Tests | **Vitest + Testing Library** | Unit test suite |
| Audio capture | **Web Audio API** (`ScriptProcessorNode`) | Live mic capture & resampling |

### 4.5 Translation (optional)

| Component | Technology | Role |
|-----------|-----------|------|
| Provider (default) | **GitHub Models** (`gpt-4o-mini`) | Free-tier LLM translation |
| Provider (fallback) | **RodiumAI** | Used if no GitHub Models token |
| Behavior | Non-blocking | Ignored if no key configured; never breaks ASR |

### 4.6 Infrastructure & Deployment

| Component | Technology | Role |
|-----------|-----------|------|
| Model training / storage | **AWS SageMaker + S3** | Fine-tuning and model artifact storage (auto-downloaded on startup) |
| Demo compute | **AWS EC2 `g4dn.xlarge`** (GPU T4, 16 GB) | Recommended GPU instance for inference |
| Base image | **Deep Learning AMI (PyTorch)** | Ships torch + CUDA preinstalled |
| Containerization | **Docker** (`python:3.11-slim` + ffmpeg) | Portable, reproducible backend |
| Frontend hosting | **AWS Amplify** | CI/CD + hosting for the interface |
| Secure tunneling | **Cloudflare Tunnel (`cloudflared`)** | HTTPS for microphone capture (`getUserMedia`) in demos |

---

## 5. Backend Service (`app/`)

A single FastAPI service loads all three models at startup and serves them from
one GPU.

**Endpoints:**

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/` | Redirects to `/docs` (Swagger) |
| `POST` | `/transcribe/wo` | Wolof transcription (file) → `{ "text": "..." }` |
| `POST` | `/transcribe/twi` | Twi transcription (file) → `{ "text": "..." }` |
| `WS` | `/transcribe/live/{wo\|twi}` | Live streaming transcription |
| `POST` | `/tts/twi` | Twi speech synthesis → `audio/wav` (48 kHz) |
| `GET` | `/health` | Service and model status |

`/transcribe/*` accept an optional `?target_lang=fr` (or `en`): the transcript is
then also translated and returned in a `translation` field (file) or via a
`{"type": "translation", ...}` message (live).

### Engineering notes

- **Single-inference GPU serialization.** A one-thread `ThreadPoolExecutor`
  serializes every model call (ASR or TTS) so the 16 GB T4 is never
  over-committed, without blocking the asyncio loop.
- **Hallucination filtering.** Whisper invents plausible text on silence (e.g.
  subtitle-credit phrases). Teekiai combines Whisper's native no-speech /
  logprob / compression thresholds with a pattern filter to drop these outputs.
- **Live VAD segmentation.** Silero VAD v5 detects speech boundaries in the raw
  PCM stream, with a ~0.5 s pre-roll and a forced flush before Whisper's 30 s
  window limit.

### Quick start (local / CPU)

```bash
cd app
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

Check readiness: `curl http://localhost:8000/health`

> `torch` should be installed separately for CUDA
> (`pip install torch --index-url https://download.pytorch.org/whl/cu118`),
> or provided by the GPU AMI — do not reinstall it there.

### Docker

```bash
cd app
docker build -t teekiai-asr .
docker run --rm --gpus all -p 8000:8000 \
  -v $(pwd)/models:/app/models \
  teekiai-asr
```

---

## 6. Web Interface (`interface/`)

A multilingual chat app with three modes — **ASR**, **TTS**, and
**Translation** — driven by a single controller hook.

### The proxy layer

The interface never calls the backend directly for file requests. Instead,
Next.js **route handlers** (`/api/asr/transcribe`, `/api/tts/twi`) proxy each
call and add:

- **Rate-limiting** per client IP
- **Same-origin checks** to block other sites from driving the proxy
- **Size limits** (10 MB uploads) and content-type validation
- A **27 s upstream timeout** that returns a clean JSON error *before* the
  hosting CDN's ~30 s gateway timeout fires an opaque 504

The **live WebSocket path bypasses the proxy** (its URL is client-visible via
`NEXT_PUBLIC_ASR_WS_URL`), which is why the backend enables permissive CORS.

### Client-side audio handling

- Audio is decoded and **resampled to 16 kHz mono in the browser**
  (`OfflineAudioContext`), guaranteeing codec compatibility.
- Long recordings (>1 min) are **split into segments cut at the quietest point**
  near each boundary, so no spoken word is sliced. Each segment finishes well
  under the timeout, and transcripts are stitched back together.
- Live capture uses `ScriptProcessorNode` → JS resample → 16-bit PCM frames
  streamed over the WebSocket.

### Getting started

```bash
cd interface
npm install
cp .env.example .env.local   # set ASR_API_URL and NEXT_PUBLIC_ASR_WS_URL
npm run dev                  # http://localhost:3000
```

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run test` | Vitest unit suite |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript (`tsc --noEmit`) |

### CI/CD

Every push / PR to `main` and `dev` runs a pipeline (lint, type-check, format,
Vitest, security audit, `next build`). On a passing push to `main`, deployment
to **AWS Amplify** is triggered via an incoming webhook.

---

## 7. Live Transcription (WebSocket Protocol)

Live mode is inspired by [huggingface/speech-to-speech](https://github.com/huggingface/speech-to-speech).
**Silero VAD v5** detects speech boundaries in the incoming stream; each segment
is transcribed by the Whisper model of the chosen language.

**Protocol:**

- **Client → Server:** binary frames of raw **PCM audio — 16 kHz, int16
  little-endian, mono** (chunk size is free; the server re-segments internally).
  A text frame `"stop"` flushes the current segment and closes the connection.
- **Server → Client (JSON):**
  - `{"type": "ready", ...}` — on connection
  - `{"type": "speech_start"}` — when speech begins
  - `{"type": "transcript", "text": "...", "final": true}` — on each transcribed
    segment (`"final": false` marks a partial segment when speech continues beyond ~28 s)
  - `{"type": "translation", "text": "...", "target_lang": "fr"}` — when a
    `?target_lang` is requested

---

## 8. Transcription Quality & Trust

Speech recognition is never perfect, so Teekiai stays **honest about its
limits** — transcriptions are presented as measurable, verifiable outputs, never
as a guarantee of perfect accuracy.

- Whisper's native thresholds and a pattern filter drop hallucinated text on
  silence rather than emitting plausible-but-fake output.
- Very short VAD triggers (noise, breath, clicks) are discarded before reaching
  the model.
- Translation is always framed as an optional enhancement and fails gracefully.

---

## 9. Configuration

### Backend (`app/.env`)

| Variable | Role | Default |
|----------|------|---------|
| `MODEL_DIR_WO` | Local Wolof ASR model directory | `./teekiai_asr_wo1` |
| `MODEL_DIR_TWI` | Local Twi ASR model directory | `./teekiai_asr_tw1` |
| `MODEL_DIR_TTS_TWI` | Local Twi TTS model directory | `./teekiai_twi_ttsv1` |
| `S3_BUCKET` | S3 bucket for automatic model download | _(unset)_ |
| `GITHUB_MODELS_TOKEN` | GitHub PAT (`Models: Read-only`) — translation provider (priority) | _(unset)_ |
| `RODIUMAI_API_KEY` | RodiumAI key — translation fallback | _(unset)_ |
| `TRANSLATION_MODEL` | Model used for translation | `openai/gpt-4o-mini` |

Without `GITHUB_MODELS_TOKEN` or `RODIUMAI_API_KEY`, `?target_lang` is simply ignored.

### Frontend (`interface/.env.local`)

| Variable | Role | Visibility |
|----------|------|------------|
| `ASR_API_URL` | Base URL of the backend service | Server-only |
| `NEXT_PUBLIC_ASR_WS_URL` | Base WebSocket URL for live ASR | Client-visible |

---

## 10. Users & Value

| Persona | Role | Primary need |
|---------|------|--------------|
| **Everyday speaker** | Wolof / Twi / Fon speaker | Interact with digital services in their own language, by voice |
| **Product builder** | Developer / operator | Add African-language speech to their product without building models from scratch |

By exposing ASR, TTS and translation behind a simple API and chat interface,
Teekiai lets any product speak, listen to, and understand West African languages
that were previously unsupported.

---

## 11. Roadmap

| Phase | Focus |
|-------|-------|
| **Hackathon MVP** | ASR + TTS + translation for Wolof & Twi, live and file modes |
| **Language expansion** | Add Fon and other priority languages |
| **Coverage expansion** | Wolof/Fon TTS, wider translation pairs |
| **Scale** | Production API, key-based auth, scale-to-zero GPU serving |

**Backend roadmap (Phase 2):**
- SageMaker Async Endpoint (scale-to-zero) for usage-based billing
- API-key authentication
- Persistent-GPU WebSocket live transcription

---

## 12. Ethics, Risk & Data Honesty

- Never present a transcription as 100% reliable.
- Filter hallucinated output rather than emitting fabricated text.
- Frame translation as an optional, best-effort enhancement.
- Secure processing and storage of user audio in production.
- Test across regional variants and accents before real deployment.

---

## 13. Licensing

The Teekiai ASR models are fine-tuned derivatives of **OpenAI Whisper large-v3**
(MIT), and the Twi TTS model builds on **VoxCPM**. Upstream model licenses must be
reviewed and respected before any commercial use — attribution is required where
applicable.

---

## References

| # | Source | Used for |
|---|--------|----------|
| [1] | OpenAI Whisper documentation | Base ASR model and fine-tuning |
| [2] | VoxCPM | Base TTS model |
| [3] | AWS SageMaker documentation | Fine-tuning and inference infrastructure |
| [4] | Silero VAD | Voice activity detection for live mode |
| [5] | huggingface/speech-to-speech | Live streaming / VAD architecture reference |

---

*AI for Good Hackathon · Submission deadline: Sunday, 5 July 2026, 23:59.*
