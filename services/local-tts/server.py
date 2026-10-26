"""Local text-to-speech for Visionex, in eighteen of the site's languages.

Each Piper voice knows one language. For a language written in Latin letters the
whole text goes to its voice. For a language written in another script (Arabic,
Persian, Urdu, Bengali, Hindi, Russian, Korean) the Latin runs inside it, such as
"Visionex" or "WhatsApp Business", are spoken by the English voice, because the
native voice cannot pronounce them: the text is cut into runs by script, each run
is spoken by the voice that knows it, and the pieces are joined with a short pause.

voices.json is the list of what can be spoken, with each voice pinned by SHA-256 and
its pace (Arabic is spoken at the length-scale the owner chose by ear, 0.65). Text
in a script the chosen language does not use is refused with `unsupported_language`,
and so is a language with no voice, so the caller can use another provider instead
of having text read in a voice that does not know it.

What this service will not do:
  * log the text. The repository is public and so are its CI logs; a log line
    carries a language, a length and an outcome, never a word of what was said;
  * answer an unbounded request: the body, the text and the number of syntheses
    running at once are all capped;
  * run as root or write anywhere but a small temporary directory (see the
    Dockerfile and the deploy workflow for the container limits).
"""

import hmac
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", "8090"))
HOST = os.environ.get("HOST", "0.0.0.0")
MODELS = os.environ.get("MODELS_DIR", "/models")
# Optional shared secret. The service is published to the loopback interface only,
# so this is a second lock, not the first.
TOKEN = os.environ.get("TTS_TOKEN", "")

MAX_BODY_BYTES = 8 * 1024
MAX_TEXT_CHARS = 1200
MAX_CONCURRENT = 2
PIECE_TIMEOUT_S = 45
PAUSE_S = 0.12


def _load_voices():
    here = os.path.dirname(os.path.abspath(__file__))
    for path in (os.path.join(MODELS, "voices.json"), os.path.join(here, "voices.json")):
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                return json.load(f)["voices"]
    return {}


VOICES = _load_voices()

# The letters each script may contain. Latin is always allowed on top of a native
# script, for the names that are spoken by the English voice.
LATIN_BASIC = r"A-Za-z"
SCRIPT_RANGES = {
    "latin": r"A-Za-zÀ-ɏḀ-ỿ",
    "arabic": r"؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿",
    "bengali": r"ঀ-৿",
    "devanagari": r"ऀ-ॿ",
    "cyrillic": r"Ѐ-ӿ",
    "hangul": r"가-힯ᄀ-ᇿ㄰-㆏",
}

# A run starts and ends on a letter or digit, so a sentence's full stop is not read as part of the name.
_WORD = r"[A-Za-z](?:[A-Za-z0-9&'.\-]*[A-Za-z0-9])?"
LATIN_RUN = re.compile(_WORD + r"(?:\s+" + _WORD + r")*")


def normalise_language(value):
    return str(value or "").strip().lower().replace("_", "-").split("-")[0][:3]


def script_of(lang):
    return VOICES[lang]["script"]


def split_runs(text, lang="ar"):
    """Cut text into [(voice language, piece)] runs.

    A language in Latin letters is one run. Any other language keeps its own runs
    and hands the Latin ones to the English voice."""
    if script_of(lang) == "latin":
        return [(lang, text)] if re.search(r"\w", text) else []
    out, pos = [], 0
    for m in LATIN_RUN.finditer(text):
        if m.start() > pos:
            out.append((lang, text[pos:m.start()]))
        out.append(("en", m.group()))
        pos = m.end()
    if pos < len(text):
        out.append((lang, text[pos:]))
    # Punctuation and spaces alone are not worth a voice.
    return [(voice, piece) for voice, piece in out if re.search(r"\w", piece)]


def unsupported(text, lang="ar"):
    """True when the text holds a letter the chosen language's script does not use."""
    allowed = SCRIPT_RANGES[script_of(lang)]
    if script_of(lang) != "latin":
        allowed += LATIN_BASIC
    pattern = re.compile(f"[{allowed}]")
    return any(ch.isalpha() and not pattern.match(ch) for ch in text)


def synth_piece(voice, piece, workdir):
    """Speak one run with its voice. Returns (sample_rate, int16 bytes) or None."""
    out = os.path.join(workdir, "piece.wav")
    model = os.path.join(MODELS, f"{voice}.onnx")
    cmd = [sys.executable, "-m", "piper", "-m", model, "-f", out,
           "--length-scale", str(VOICES[voice]["length_scale"])]
    try:
        result = subprocess.run(cmd, input=piece, capture_output=True, text=True,
                                timeout=PIECE_TIMEOUT_S)
    except subprocess.TimeoutExpired:
        return None
    if result.returncode != 0 or not os.path.exists(out):
        return None
    with wave.open(out) as w:
        return w.getframerate(), w.readframes(w.getnframes())


def synthesize(text, lang):
    """The whole recording as WAV bytes, or None if a piece could not be spoken."""
    import numpy as np

    pieces, rate = [], None
    with tempfile.TemporaryDirectory(dir="/tmp") as workdir:
        for voice, piece in split_runs(text, lang):
            got = synth_piece(voice, piece, workdir)
            if got is None:
                return None
            piece_rate, raw = got
            data = np.frombuffer(raw, dtype=np.int16)
            if rate is None:
                rate = piece_rate
            if piece_rate != rate:  # the voices need not share a sample rate
                idx = np.linspace(0, len(data) - 1, int(len(data) * rate / piece_rate))
                data = np.interp(idx, np.arange(len(data)), data).astype(np.int16)
            pieces.append(data)
            pieces.append(np.zeros(int(rate * PAUSE_S), dtype=np.int16))
    if not pieces:
        return None
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(np.concatenate(pieces).tobytes())
    return buf.getvalue()


_slots = threading.BoundedSemaphore(MAX_CONCURRENT)


class Handler(BaseHTTPRequestHandler):
    server_version = "visionex-local-tts"
    sys_version = ""

    def log_message(self, fmt, *args):  # silent: a request line is not worth the risk of a log
        pass

    def _send(self, status, body, content_type="application/json"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _authorised(self):
        if not TOKEN:
            return True
        given = self.headers.get("Authorization", "")
        return hmac.compare_digest(given, f"Bearer {TOKEN}")

    def do_GET(self):
        if self.path == "/healthz":
            ready = bool(VOICES) and all(os.path.exists(os.path.join(MODELS, f"{lang}.onnx")) for lang in VOICES)
            return self._send(200 if ready else 503, {"ok": ready, "languages": sorted(VOICES)})
        return self._send(404, {"error": "not_found"})

    def do_POST(self):
        if self.path != "/speak":
            return self._send(404, {"error": "not_found"})
        if not self._authorised():
            return self._send(401, {"error": "unauthorized"})

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = -1
        if length <= 0 or length > MAX_BODY_BYTES:
            return self._send(413 if length > MAX_BODY_BYTES else 400, {"error": "bad_body"})

        try:
            payload = json.loads(self.rfile.read(length))
            text = payload["text"]
            lang = normalise_language(payload.get("language", "ar"))
        except Exception:
            return self._send(400, {"error": "bad_json"})
        if not isinstance(text, str) or not text.strip():
            return self._send(400, {"error": "empty_text"})
        if len(text) > MAX_TEXT_CHARS:
            return self._send(413, {"error": "text_too_long", "max_chars": MAX_TEXT_CHARS})
        if lang not in VOICES or unsupported(text, lang):
            return self._send(422, {"error": "unsupported_language"})
        if not split_runs(text, lang):
            return self._send(422, {"error": "nothing_to_say"})

        if not _slots.acquire(blocking=False):
            return self._send(429, {"error": "busy"})
        started = time.time()
        try:
            wav = synthesize(text, lang)
        finally:
            _slots.release()

        # A language, a length and an outcome, never the text.
        print(f"speak lang={lang} chars={len(text)} ok={wav is not None} seconds={time.time() - started:.1f}", flush=True)
        if wav is None:
            return self._send(500, {"error": "synthesis_failed"})
        return self._send(200, wav, "audio/wav")


def main():
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
