# Bambi AI Voicemail POC (Telegram, no telecom)

A minimal store-and-forward voicemail system over Telegram — no PSTN, IVR,
USSD, or carrier partnership required. Proves two things:

1. **Full voicemail loop**: record → store → transcribe → retrieve
2. **Voice-to-text + auto-reply**: sender gets an instant transcript confirmation

## Setup (5 minutes)

1. **Create a bot**: message [@BotFather](https://t.me/BotFather) on Telegram,
   run `/newbot`, follow the prompts, copy the token it gives you.

2. **Install dependencies**:
   ```
   pip install -r requirements.txt
   ```

3. **Set your token**:
   ```
   export TELEGRAM_BOT_TOKEN="your-token-here"
   ```

4. **Run it**:
   ```
   python bot.py
   ```

That's it — no server, no webhook, no domain needed. It runs on your laptop
via polling.

## Trying the demo (mock mode, default)

Runs with `MOCK_MODE=true` by default, so it returns realistic-looking
Twi/Wolof mock transcripts without needing your ASR model wired up yet —
good for demoing the full flow today.

1. Have two Telegram accounts (or two friends) both message the bot `/start`.
2. User A: `/lang twi`
3. User A: `/send @userB_username`
4. User A: record and send a voice note
5. User A instantly gets a transcript confirmation back
6. User B gets a notification, then runs `/inbox` to hear + read it

## Wiring in your real Teeki AI ASR/TTS

Open `speech.py`:
- Fill in `call_teeki_asr()` to POST audio to your actual ASR endpoint
  (Twi/Wolof model) and return the transcript.
- Fill in `call_teeki_tts()` if/when you want a spoken auto-reply
  instead of text-only.
- Set `MOCK_MODE=false` in your environment once both are ready.

No other files need to change — `bot.py` and `db.py` are already wired to
call through `speech.py`.

## What this deliberately skips (for a fast POC)

- No PSTN/carrier/IVR integration — this is why it's fast to build
- No cloud infra — SQLite + local file storage is enough to demo
- No auth beyond Telegram's own identity — fine for a POC, not for production
- Recipient must have messaged the bot once before you can reach their
  username (Telegram bot API limitation — bots can't message users cold)

## Natural next steps once this proves out

- Swap Telegram for a branded WhatsApp Business bot (same architecture,
  bigger reach in your target markets) or a PWA recorder for a fully
  branded experience
- Move SQLite → Postgres, local files → S3/Cloudflare R2
- Add push notifications instead of relying on /inbox polling
- Add TTS auto-reply so the whole interaction can be voice-only, for
  low-literacy users