"""Translating text on this server, with MADLAD-400 (3B, int8, CTranslate2).

One purpose, one model, no outbound calls once the files are cached: the media
processor sends text and a target language and gets the translation back. The
container is started by `deploy-translator.yml` and is reachable only on the
Docker bridge address, never from the internet.

Why the surface is this small: the caller picks a target from a fixed list and
nothing else. MADLAD takes a `<2xx>` prefix to choose the language and has no
instructions to follow, so unlike a chat model there is no prompt for text
inside an article to hijack.
"""
import json
import os
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import ctranslate2
from huggingface_hub import snapshot_download
from sentencepiece import SentencePieceProcessor

REPO = "santhosh/madlad400-3b-ct2"
# Pinned: a moved tag on someone else's repository must not change what runs here.
REVISION = "c32ad0cf118807ea6258d14be137547155842723"

# The site's twenty locales, by the code MADLAD uses for them.
LANGUAGES = {
    "en", "ar", "bn", "de", "es", "fa", "fr", "hi", "id", "it",
    "ja", "ko", "nl", "pl", "pt", "ru", "tr", "ur", "vi", "zh",
}
# Scripts that put no space between sentences.
NO_SPACE = {"zh", "ja"}

MAX_CHARS = 6000
MAX_SEGMENT_CHARS = 400
THREADS = int(os.environ.get("TRANSLATOR_THREADS", "3"))

model_path = snapshot_download(REPO, revision=REVISION)
tokenizer = SentencePieceProcessor()
tokenizer.load(f"{model_path}/sentencepiece.model")
translator = ctranslate2.Translator(model_path, compute_type="int8", inter_threads=1, intra_threads=THREADS)

busy = threading.Lock()
SENTENCE_END = re.compile(r"(?<=[.!?؟。！？…])\s+")


def segments(paragraph):
    """Sentences packed into pieces of at most MAX_SEGMENT_CHARS.

    A short sentence translated on its own is where this model invents
    (a 2026-11-02 test turned "Work begins in March." into a sentence about
    October and another about 2019), so neighbouring sentences travel together
    and give it something to be faithful to. A single over-long sentence is cut
    at a space.
    """
    sentences = []
    for sentence in SENTENCE_END.split(paragraph.strip()):
        sentence = sentence.strip()
        while len(sentence) > MAX_SEGMENT_CHARS:
            cut = sentence.rfind(" ", 0, MAX_SEGMENT_CHARS)
            cut = cut if cut > 40 else MAX_SEGMENT_CHARS
            sentences.append(sentence[:cut].strip())
            sentence = sentence[cut:].strip()
        if sentence:
            sentences.append(sentence)
    pieces, current = [], ""
    for sentence in sentences:
        if current and len(current) + 1 + len(sentence) > MAX_SEGMENT_CHARS:
            pieces.append(current)
            current = sentence
        else:
            current = f"{current} {sentence}".strip()
    if current:
        pieces.append(current)
    return pieces


def translate_piece(piece, target):
    tokens = tokenizer.encode(f"<2{target}> {piece}", out_type=str)
    # A translation is never many times longer than its source; the cap is what
    # stops the model running on into text that was not there.
    cap = min(256, int(len(tokens) * 2.5) + 10)
    result = translator.translate_batch(
        [tokens],
        beam_size=4,
        no_repeat_ngram_size=4,
        repetition_penalty=1.1,
        max_decoding_length=cap,
    )
    return tokenizer.decode(result[0].hypotheses[0]).strip()


def translate(text, target):
    paragraphs = text.split("
")
    lines = []
    for paragraph in paragraphs:
        pieces = [translate_piece(piece, target) for piece in segments(paragraph)]
        lines.append(("" if target in NO_SPACE else " ").join(pieces))
    return "
".join(lines).strip()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # never log a request line: the text is the customer's
        pass

    def _send(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"ok": True})
        self._send(404, {"ok": False})

    def do_POST(self):
        if self.path != "/translate":
            return self._send(404, {"ok": False})
        length = int(self.headers.get("content-length") or 0)
        if length <= 0 or length > MAX_CHARS * 8:
            return self._send(413, {"ok": False, "reason": "bad_size"})
        try:
            payload = json.loads(self.rfile.read(length))
            text, target = payload["text"], payload["target"]
        except Exception:
            return self._send(400, {"ok": False, "reason": "bad_json"})
        if not isinstance(text, str) or target not in LANGUAGES or not text.strip() or len(text) > MAX_CHARS:
            return self._send(422, {"ok": False, "reason": "refused"})
        if not busy.acquire(blocking=False):
            return self._send(503, {"ok": False, "reason": "busy"})
        started = time.time()
        try:
            out = translate(text, target)
            self._send(200, {"ok": True, "text": out, "ms": int((time.time() - started) * 1000)})
        except Exception as error:  # a class name only: a message can quote the text
            self._send(200, {"ok": False, "reason": type(error).__name__})
        finally:
            busy.release()


if __name__ == "__main__":
    print("translator ready", flush=True)
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
