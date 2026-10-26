"""Download the Piper voices named in voices.json at build time, and refuse anything
that is not the exact file that was reviewed: the voice repository is fetched at a
fixed commit and each model's SHA-256 is checked against the lock file.

voices.json is the single list of what the service can speak. Adding a language
means adding an entry there (with the SHA-256 from the voice repository) and
nothing else."""

import hashlib
import json
import os
import shutil
import urllib.request

LOCK = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "voices.json"), encoding="utf-8"))
BASE = f"https://huggingface.co/rhasspy/piper-voices/resolve/{LOCK['revision']}"
TARGET = "/models"

for lang, voice in LOCK["voices"].items():
    model = f"{TARGET}/{lang}.onnx"
    urllib.request.urlretrieve(f"{BASE}/{voice['onnx']}", model)
    urllib.request.urlretrieve(f"{BASE}/{voice['config']}", f"{model}.json")
    digest = hashlib.sha256()
    with open(model, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    if digest.hexdigest() != voice["sha256"]:
        raise SystemExit(f"the {lang} model does not match its pinned SHA-256")

# The server reads the same list at run time.
shutil.copy(os.path.join(os.path.dirname(os.path.abspath(__file__)), "voices.json"), f"{TARGET}/voices.json")
print(f"{len(LOCK['voices'])} voices verified")
