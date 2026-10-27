#!/usr/bin/env bash
# Make a few Piper audio samples on the server, so a person can listen and judge
# the voice. Same isolation as bench.sh: one throwaway container limited to three
# cores and 6 GB, at the lowest priority, refusing to start when the server is
# busy. The WAV files land in /var/tmp/vxsamples for the workflow to copy out and
# are removed afterwards. The sentences are fixed and contain nothing private.
set -uo pipefail

W=/var/tmp/vxsamples
mkdir -p "$W" || exit 1

load=$(cut -d' ' -f1 /proc/loadavg)
cores=$(nproc)
if awk -v l="$load" -v c="$cores" 'BEGIN{exit !(l > c*0.6)}'; then echo "SKIPPED: the server is busy (load1=$load)."; exit 0; fi
command -v docker >/dev/null 2>&1 || { echo "FAILED: docker is not available to this user."; exit 1; }

cat > "$W/make.py" <<'PY'
import subprocess, sys, urllib.request

HF = "https://huggingface.co/rhasspy/piper-voices/resolve/main"
VOICES = {
    "ar": f"{HF}/ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx",
    "en": f"{HF}/en/en_US/lessac/medium/en_US-lessac-medium.onnx",
}
SAMPLES = {
    "ar-1-intro": ("ar", "مرحبا بكم في فيجن إكس، منصة تجمع الأخبار والتعلم والألعاب والأدوات لأصحاب البصر الضعيف والمكفوفين في عشرين لغة."),
    "ar-2-weather": ("ar", "اليوم الثلاثاء، السادس والعشرون من أكتوبر. الطقس في عمان مشمس، ودرجة الحرارة اثنتان وعشرون مئوية."),
    "ar-3-done": ("ar", "لقد تم نشر منشورك بنجاح على فيسبوك وإنستغرام وثريدز."),
    "en-1-intro": ("en", "Welcome to Visionex, a platform that brings together news, learning, games and tools for blind and low vision people in twenty languages."),
    "en-2-weather": ("en", "Today is Tuesday, October twenty sixth. The weather in Amman is sunny, twenty two degrees Celsius."),
    "en-3-done": ("en", "Your post has been published successfully on Facebook, Instagram and Threads."),
}

r = subprocess.run([sys.executable, "-m", "pip", "install", "-q", "--no-cache-dir", "piper-tts"], capture_output=True, text=True)
if r.returncode != 0:
    print("FAILED: pip install"); print(r.stderr[-300:]); sys.exit(1)

for lang, url in VOICES.items():
    for suffix in ("", ".json"):
        urllib.request.urlretrieve(url + suffix, f"{lang}.onnx{suffix}")

def piper(lang, text, out, scale=1.0):
    # length-scale below 1 speaks faster. The flag has been spelled both ways
    # across Piper releases, so try the current spelling first.
    base = [sys.executable, "-m", "piper", "-m", f"{lang}.onnx", "-f", out]
    for flag in ("--length-scale", "--length_scale"):
        r = subprocess.run(base + [flag, str(scale)], input=text, capture_output=True, text=True)
        if r.returncode == 0:
            return r
    return r

for name, (lang, text) in SAMPLES.items():
    r = piper(lang, text, f"{name}.wav")
    print(("ok   " if r.returncode == 0 else "FAILED ") + name)

# The Arabic voice reads slowly. The same sentence at four speeds, to choose by ear
# (1.0 is the default speed, smaller is faster).
for scale in (0.85, 0.75, 0.65):
    r = piper("ar", SAMPLES["ar-2-weather"][1], f"ar-speed-{scale}.wav", scale)
    print(("ok   " if r.returncode == 0 else "FAILED ") + f"ar-speed-{scale}")

# ── One recording that speaks both languages ────────────────────────────────
# Each Piper voice knows one language: the Arabic voice cannot pronounce "Visionex".
# So the text is cut into runs by script, each run is spoken by the voice that
# knows it, and the pieces are joined with a short pause.
import re, wave
import numpy as np

MIXED = {
    "mixed-1-brand": "مرحبا بكم في Visionex، منصة تجمع الأخبار والتعلم والألعاب لأصحاب البصر الضعيف.",
    "mixed-2-social": "تم نشر منشورك بنجاح على Facebook و Instagram و Threads، ويمكنك مشاهدته من لوحة الإدارة.",
    "mixed-3-numbers": "أرسلت رسالة واتساب إلى الرقم 962 7 9999 9999 باستخدام WhatsApp Business، وتكلفتها 5 دولارات.",
}
ARABIC_SCALE = 0.75  # the Arabic pieces of a mixed recording are spoken faster
LATIN = re.compile(r"[A-Za-z][A-Za-z0-9&'.\-]*(?:\s+[A-Za-z][A-Za-z0-9&'.\-]*)*")

def runs(text):
    out, pos = [], 0
    for m in LATIN.finditer(text):
        if m.start() > pos:
            out.append(("ar", text[pos:m.start()]))
        out.append(("en", m.group()))
        pos = m.end()
    if pos < len(text):
        out.append(("ar", text[pos:]))
    # Punctuation and spaces alone are not worth a voice.
    return [(lang, t) for lang, t in out if re.search(r"\w", t)]

def speak(lang, text, scale=1.0):
    path = "piece.wav"
    r = piper(lang, text, path, scale)
    if r.returncode != 0:
        return None
    with wave.open(path) as w:
        rate, raw = w.getframerate(), w.readframes(w.getnframes())
    return rate, np.frombuffer(raw, dtype=np.int16)

for name, text in MIXED.items():
    pieces, rate = [], None
    for lang, part in runs(text):
        got = speak(lang, part, ARABIC_SCALE if lang == "ar" else 1.0)
        if got is None:
            continue
        r_, data = got
        if rate is None:
            rate = r_
        if r_ != rate:  # the two voices are not guaranteed to share a sample rate
            idx = np.linspace(0, len(data) - 1, int(len(data) * rate / r_))
            data = np.interp(idx, np.arange(len(data)), data).astype(np.int16)
        pieces.append(data)
        pieces.append(np.zeros(int(rate * 0.12), dtype=np.int16))
    if not pieces:
        print("FAILED " + name)
        continue
    with wave.open(f"{name}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes(np.concatenate(pieces).tobytes())
    print(f"ok   {name}  ({len(runs(text))} pieces)")
PY

timeout 900 nice -n 19 docker run --rm --cpus=3 --memory=6g -v "$W":/w -w /w -e PYTHONUNBUFFERED=1 python:3.12-slim python /w/make.py
# The container ran as root: make the results readable for the copy.
docker run --rm -v "$W":/w alpine sh -c 'chmod -R a+rX /w' >/dev/null 2>&1
ls -1 "$W"/*.wav 2>/dev/null | sed 's#.*/##'
