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

for name, (lang, text) in SAMPLES.items():
    r = subprocess.run([sys.executable, "-m", "piper", "-m", f"{lang}.onnx", "-f", f"{name}.wav"],
                       input=text, capture_output=True, text=True)
    print(("ok   " if r.returncode == 0 else "FAILED ") + name)
PY

timeout 900 nice -n 19 docker run --rm --cpus=3 --memory=6g -v "$W":/w -w /w -e PYTHONUNBUFFERED=1 python:3.12-slim python /w/make.py
# The container ran as root: make the results readable for the copy.
docker run --rm -v "$W":/w alpine sh -c 'chmod -R a+rX /w' >/dev/null 2>&1
ls -1 "$W"/*.wav 2>/dev/null | sed 's#.*/##'
