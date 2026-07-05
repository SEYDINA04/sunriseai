FROM python:3.11-slim

# Dépendances système : ffmpeg pour le décodage audio
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dépendances Python en couche séparée pour profiter du cache Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Le modèle est monté via un volume ou téléchargé au démarrage (S3_BUCKET)
VOLUME ["/app/teekiai_asr_wo1"]

EXPOSE 8000

ENV MODEL_DIR=/app/teekiai_asr_wo1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
