# Local text-to-speech: Piper voices for Arabic and English in one recording.
#
# A separate container, not part of the media processor. That service is plain Node
# with no dependencies on purpose, because it parses files that arrive from the
# internet; Python, onnxruntime and a 120 MB model set do not belong in it.
#
# Everything is pinned: the Python image by tag, piper-tts by version, and each
# voice by the commit of the voice repository AND by the SHA-256 of the model file
# (see fetch_voices.py). A build that downloads anything else fails.

FROM python:3.12-slim

# numpy is named explicitly: the service uses it to join the pieces.
RUN pip install --no-cache-dir "piper-tts==1.8.0" numpy

COPY fetch_voices.py /tmp/fetch_voices.py
RUN mkdir /models && python /tmp/fetch_voices.py && rm /tmp/fetch_voices.py

WORKDIR /app
COPY server.py ./

# Never root. The deploy runs it read-only with a small tmpfs for /tmp.
RUN useradd --system --uid 10001 --no-create-home tts
USER 10001

ENV PORT=8090 HOST=0.0.0.0 MODELS_DIR=/models PYTHONUNBUFFERED=1
EXPOSE 8090
CMD ["python", "/app/server.py"]
