# Afriklang Voicemail Intelligence

**Voice Transcription Plugin for West African Telecom Call Centers — Twi & Wolof**

AI for Good Hackathon · Submission for the FTK "AI for Good" challenge

---

## 1. Overview

Afriklang Voicemail Intelligence turns every voice message received by a telecom
call center into **transcribed, searchable, and prioritizable text**. It targets a
concrete operational problem: incoming voice messages that are slow to process
manually and impossible to search or index — a challenge made worse for African
low-resource languages where no reliable transcription solution exists today.

> **One-line pitch:** *An opaque voice channel becomes a searchable database.*

The product never changes how a customer leaves a message. It only transforms what
happens next: an audio file to listen to becomes text to act on.

### What we are implementing

The system is powered by the **Afriklang ASR engine**, an in-house speech-to-text
service already fine-tuned on **Twi** and **Wolof**. This repository documents the
end-to-end technology stack behind that engine and the application layer built on
top of it for the hackathon demo.

---

## 2. System Architecture

The product works as a linear, layered pipeline. Each stage has a single
responsibility, which keeps the demo predictable and the system easy to reason about.

```
Voice message received
        │
        ▼
   API Backend          ── receives the audio, routes it to the model
        │
        ▼
   ASR Transcription    ── Afriklang fine-tuned Whisper model (Twi / Wolof)
        │
        ▼
   Confidence Scoring   ── attaches a reliability score to each transcription
        │
        ▼
   Keyword Detection    ── deterministic urgency / category tagging
        │
        ▼
   Indexing             ── full-text search + filtering
        │
        ▼
   Searchable Inbox     ── call-center-style interface
```

### Reliability principle

**AI is used only for transcription.** Everything else — confidence thresholds,
keyword detection, and message routing — runs on **deterministic code**. This
guarantees that no "AI miscalculation" can disrupt the pipeline, and makes the
behavior fully reproducible.

---

## 3. Technology Stack

### 3.1 Core ASR Engine

| Component | Technology | Role |
|-----------|-----------|------|
| Base model | **OpenAI Whisper large-v3** | Foundation speech-to-text architecture |
| Wolof model | **`afriklang_asr_wo1`** | Fine-tuned, merged standalone model (Wolof) |
| Twi models | **`afriklang_asr_tw1` / `tw2`** | Fine-tuned, merged standalone models (Twi) |
| Runtime dependency | **None (PEFT merged)** | Models are fused — no PEFT adapters loaded at runtime |

The models are **merged and autonomous**: adapters are baked into the weights, so
inference has no PEFT dependency and can be served directly.

### 3.2 Voice Activity Detection (Live mode)

| Component | Technology | Role |
|-----------|-----------|------|
| VAD | **Silero VAD v5** | Detects speech start/end in the live audio stream |
| Streaming pattern | Inspired by **`huggingface/speech-to-speech`** | Each detected segment is transcribed independently |

### 3.3 Backend & API

| Component | Technology | Role |
|-----------|-----------|------|
| API framework | **FastAPI** | HTTP + WebSocket endpoints, auto-generated Swagger docs |
| Transcription endpoint | `POST /transcribe/{wo\|twi}` | File-based transcription → `{ "text": "..." }` |
| Live endpoint | `WS /transcribe/live/{wo\|twi}` | Streaming transcription over WebSocket |
| Health endpoint | `GET /health` | Service and model readiness |
| Server | **Uvicorn** (ASGI) | Runs the FastAPI application |
| Audio processing | **ffmpeg** | Audio decoding / format normalization |
| Runtime | **Python 3.11** | Language runtime |

### 3.4 Frontend

| Component | Technology | Role |
|-----------|-----------|------|
| UI framework | **Next.js + Tailwind CSS** | Call-center inbox interface |
| Alternative | **Streamlit** | Faster option if the team stays Python-only |

### 3.5 Data & Search

| Component | Technology | Role |
|-----------|-----------|------|
| Database | **PostgreSQL** | Message history, metadata, transcriptions |
| Search | **PostgreSQL full-text search** | Searchable / filterable transcriptions |
| Alternative search | **Elasticsearch** | If time allows, for richer indexing |
| Audio storage | **AWS S3** (`afriklang-data`) | Raw audio file storage |

### 3.6 Infrastructure & Deployment

| Component | Technology | Role |
|-----------|-----------|------|
| Model training / inference | **AWS SageMaker** | Fine-tuning and model serving infrastructure |
| Model registry (storage) | **AWS S3** (SageMaker bucket) | Model artifacts, auto-downloaded on startup |
| Demo compute | **AWS EC2 `g4dn.xlarge`** (GPU T4, 16 GB) | Recommended GPU instance for inference |
| Base image | **Deep Learning AMI (PyTorch)** | Ships torch + CUDA preinstalled |
| Containerization | **Docker** (`python:3.11-slim` + ffmpeg) | Portable, reproducible deployment |
| GPU containers | **nvidia-docker** | GPU-accelerated inference in containers |
| Frontend hosting | **Vercel / Railway** | Deploy the inbox interface |
| Secure tunneling | **Cloudflare Tunnel (`cloudflared`)** | HTTPS for microphone capture (`getUserMedia`) during demos |

---

## 4. AI Modules

| Module | Function | Implementation approach |
|--------|----------|-------------------------|
| Reception / Call simulation | Simulate a new voice message arriving in the queue | Pre-recorded Twi/Wolof messages or live mic capture |
| ASR transcription | Speech-to-text + language detection | Fine-tuned Afriklang Whisper models |
| Keyword detection | Detect urgency / category signals | Deterministic keyword rules on transcribed text |
| Indexing & search | Make transcriptions searchable and filterable | Full-text search + tag filters |

**Transcription output schema:**

```
{ "text": "...", "language": "tw", "confidence": 0.00, "confidence_level": "high|medium|low" }
```

---

## 5. Transcription Quality & Trust Engine

A wrong transcription in a call-center context can lead to mis-routing, so the
product stays **honest about its limits** — transcriptions are presented as
measurable, verifiable outputs, never as a guarantee of perfect accuracy.

The engine uses a **traffic-light approach** based on the model's own confidence score:

| Level | Meaning | Behavior |
|-------|---------|----------|
| 🟢 **Green** | High confidence | Transcription displayed and indexed automatically |
| 🟡 **Amber** | Medium confidence | Displayed with a "verify with audio" note |
| 🔴 **Red** | Low confidence | Flagged "needs manual review", not auto-indexed |

The confidence score is always shown next to the text and is never hidden from the
agent. Below a minimum threshold, messages are flagged for review rather than
auto-categorized.

---

## 6. Live Transcription (WebSocket Protocol)

Live mode is inspired by [huggingface/speech-to-speech](https://github.com/huggingface/speech-to-speech).
**Silero VAD v5** detects speech boundaries in the incoming stream; each segment is
transcribed by the Whisper model of the chosen language.

**Protocol:**

- **Client → Server:** binary frames of raw **PCM audio — 16 kHz, int16
  little-endian, mono** (chunk size is free; the server re-segments internally).
  A text frame `"stop"` flushes the current segment and closes the connection.
- **Server → Client (JSON):**
  - `{"type": "ready", ...}` — on connection
  - `{"type": "speech_start"}` — when speech begins
  - `{"type": "transcript", "text": "...", "final": true}` — on each transcribed
    segment (`"final": false` marks a partial segment when speech continues beyond ~28 s)

---

## 7. Data Model

Minimum schema for a two-day build:

| Table | Key fields |
|-------|-----------|
| `operators` | id, company_name, pricing_plan, contract_status |
| `voicemail_messages` | id, operator_id, caller_number, audio_url, received_at, status |
| `transcriptions` | id, message_id, transcribed_text, confidence_score, confidence_level |
| `message_tags` | id, message_id, category, urgency_level |
| `usage_billing` | id, operator_id, period, volume_minutes, amount_billed |

---

## 8. Environment Configuration

| Variable | Role | Default |
|----------|------|---------|
| `MODEL_DIR` | Local model directory | `./afriklang_asr_wo1` |
| `S3_BUCKET` | S3 bucket for automatic model download | _(unset)_ |
| `S3_PREFIX` | S3 prefix of the model | `models/afriklang_asr_wo1` |

Models can be provisioned two ways:
- **Manual** — copy artifacts from the SageMaker S3 bucket once.
- **Automatic** — configure `S3_BUCKET` / `S3_PREFIX` so the model downloads on
  first startup if absent.

---

## 9. Users & Value

| Persona | Role | Primary need |
|---------|------|--------------|
| **Kofi** | Call-center agent | Read messages fast, prioritize urgent ones, trust the transcription |
| **Kwame** | Operations Lead / CTO | Measurably reduce call-center processing cost |

**Illustrative impact** *(explicitly framed as an estimate, not a fact)*: at ~45
seconds of listening per message, a call center processing 10,000 messages/month
ties up roughly **15.6 agent-days** just to listen — before any triage. Confirming
these figures with real operator data turns a cost line into a calculable ROI.

---

## 10. Roadmap

| Phase | Focus |
|-------|-------|
| **Hackathon MVP** | Full flow: reception → transcription → indexing → search |
| **Pilot (1–3 months)** | Real integration with a partner operator, measured time savings |
| **Language expansion** | Add Fon and other priority languages |
| **Advanced reporting** | Analytics dashboard for operations leads |
| **Scale** | Production API, guaranteed SLAs, automated billing |

**ASR engine roadmap (Phase 2):**
- SageMaker Async Endpoint (scale-to-zero) for usage-only billing
- API-key authentication
- Persistent-GPU WebSocket live transcription

---

## 11. Ethics, Risk & Data Honesty

- Never present a transcription as 100% reliable — always show a confidence score.
- Frame all impact figures as **estimates to be validated**, explicitly labeled as such.
- Enforce a strict confidence threshold before any automatic routing.
- Secure processing and storage of customer voice messages in production.
- Test across regional variants and accents before real deployment.

All figures related to literacy, message volume, agent cost, and time/cost impact
are illustrative estimates or general background knowledge — **no unverified figure
is presented as an established fact.**

---

## 12. Licensing

The Afriklang ASR models are fine-tuned derivatives of **OpenAI Whisper large-v3**
(MIT). Upstream model licenses must be reviewed and respected before any commercial
use — attribution is required where applicable.

---

## References

| # | Source | Used for |
|---|--------|----------|
| [1] | OpenAI Whisper documentation | Base ASR model and fine-tuning |
| [2] | AWS SageMaker documentation | Fine-tuning and inference infrastructure |
| [3] | GSMA — Sub-Saharan Africa mobile money reports | Voice / mobile money channel context |
| [4] | Ghana / Senegal adult literacy rates | Accessibility context *(to be sourced)* |
| [5] | huggingface/speech-to-speech | Live streaming / VAD architecture reference |

---

*AI for Good Hackathon · Submission deadline: Sunday, 5 July 2026, 23:59.*
