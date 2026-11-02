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
MAX_SEGMENT_CHARS = 300
THREADS = int(os.environ.get("TRANSLATOR_THREADS", "3"))

model_path = snapshot_download(REPO, revision=REVISION)
tokenizer = SentencePieceProcessor()
tokenizer.load(f"{model_path}/sentencepiece.model")
translator = ctranslate2.Translator(model_path, compute_type="int8", inter_threads=1, intra_threads=THREADS)

busy = threading.Lock()
SENTENCE_END = re.compile(r"(?<=[.!?؟。！？…])\s+")


def segments(paragraph):
    """Sentences, with anything still too long cut at a space."""
    out = []
    for sentence in SENTENCE_END.split(paragraph.strip()):
        sentence = sentence.strip()
        while len(sentence) > MAX_SEGMENT_CHARS:
            cut = sentence.rfind(" ", 0, MAX_SEGMENT_CHARS)
            cut = cut if cut > 40 else MAX_SEGMENT_CHARS
            out.append(sentence[:cut].strip())
            sentence = sentence[cut:].strip()
        if sentence:
            out.append(sentence)
    return out


def translate(text, target):
    paragraphs = [p for p in text.split("\n")]
    flat, owner = [], []
    for index, paragraph in enumerate(paragraphs):
        for piece in segments(paragraph):
            flat.append(piece)
            owner.append(index)
    if not flat:
        return ""
    batches = [tokenizer.encode(f"<2{target}> {piece}", out_type=str) for piece in flat]
    results = translator.translate_batch(
        batches,
        batch_type="tokens",
        max_batch_size=1024,
        beam_size=2,
        no_repeat_ngram_size=3,
        repetition_penalty=1.5,
        max_decoding_length=256,
    )
    rendered = [tokenizer.decode(r.hypotheses[0]).strip() for r in results]
    joiner = "" if target in NO_SPACE else " "
    lines = [[] for _ in paragraphs]
    for index, piece in zip(owner, rendered):
        lines[index].append(piece)
    return "\n".join(joiner.join(parts) for parts in lines).strip()


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
