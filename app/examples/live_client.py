"""
Client d'exemple pour la transcription live Teekiai ASR.

Streame un fichier audio vers le endpoint WebSocket /transcribe/live/{lang}
en simulant un flux micro temps réel, et affiche les transcriptions reçues.

Usage :
    python live_client.py <fichier_audio> [--lang wo|twi] [--url ws://localhost:8000] [--speed 4]

Dépendances : websockets, librosa, numpy (déjà dans requirements.txt du serveur).
"""

import argparse
import asyncio
import json

import librosa
import numpy as np
import websockets

SAMPLE_RATE = 16000
CHUNK_MS = 100  # taille des chunks envoyés (simule un micro)


async def stream_file(path: str, lang: str, base_url: str, speed: float):
    # n'importe quel format lisible par librosa (wav, mp3, flac, webm…) -> PCM 16 kHz mono
    audio, _ = librosa.load(path, sr=SAMPLE_RATE, mono=True)
    pcm = (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16).tobytes()

    chunk_bytes = int(SAMPLE_RATE * CHUNK_MS / 1000) * 2
    url = f"{base_url}/transcribe/live/{lang}"
    print(f"Connexion à {url} — {len(pcm) / 2 / SAMPLE_RATE:.1f}s d'audio")

    async with websockets.connect(url) as ws:

        async def receiver():
            async for raw in ws:
                msg = json.loads(raw)
                if msg["type"] == "ready":
                    print(f"[ready] modèle={msg['model']} format={msg['format']}")
                elif msg["type"] == "speech_start":
                    print("[parole détectée]")
                elif msg["type"] == "transcript":
                    marker = "final" if msg["final"] else "partiel"
                    print(f"[{marker}] {msg['text']}")
                elif msg["type"] == "error":
                    print(f"[erreur] {msg['error']}")

        recv_task = asyncio.create_task(receiver())

        for i in range(0, len(pcm), chunk_bytes):
            await ws.send(pcm[i:i + chunk_bytes])
            await asyncio.sleep(CHUNK_MS / 1000 / speed)

        # fin du fichier : silence pour laisser le VAD clôturer, puis stop
        await ws.send(b"\x00" * chunk_bytes * 10)
        await ws.send("stop")
        await asyncio.wait_for(recv_task, timeout=60)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("file")
    p.add_argument("--lang", default="wo", choices=["wo", "twi"])
    p.add_argument("--url", default="ws://localhost:8000")
    p.add_argument("--speed", type=float, default=1.0,
                   help="facteur d'accélération de l'envoi (1 = temps réel)")
    args = p.parse_args()
    asyncio.run(stream_file(args.file, args.lang, args.url, args.speed))
