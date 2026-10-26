"""Download the two Piper voices at build time and refuse anything that is not the
exact file that was reviewed: the voice repository is fetched at a fixed commit and
each model's SHA-256 is checked."""

import hashlib
import urllib.request

REV = "5041a7a49ae5b3a0f30e6837769eb03fdbb231bd"
BASE = f"https://huggingface.co/rhasspy/piper-voices/resolve/{REV}"
VOICES = {
    "ar": ("ar/ar_JO/kareem/medium/ar_JO-kareem-medium",
           "9e95cab07b679da603bba17c4dec7ab3111320571964ee95c0379603c086491e"),
    "en": ("en/en_US/lessac/medium/en_US-lessac-medium",
           "5efe09e69902187827af646e1a6e9d269dee769f9877d17b16b1b46eeaaf019f"),
}

for lang, (path, sha) in VOICES.items():
    urllib.request.urlretrieve(f"{BASE}/{path}.onnx", f"/models/{lang}.onnx")
    urllib.request.urlretrieve(f"{BASE}/{path}.onnx.json", f"/models/{lang}.onnx.json")
    with open(f"/models/{lang}.onnx", "rb") as f:
        got = hashlib.sha256(f.read()).hexdigest()
    if got != sha:
        raise SystemExit(f"the {lang} model does not match its pinned SHA-256")
print("voices verified")
