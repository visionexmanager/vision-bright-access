#!/usr/bin/env bash
# Measure local speech on the production server: text-to-speech with Piper and
# speech-to-text with Whisper (faster-whisper, the CTranslate2 build of the same
# weights that whisper.cpp runs).
#
# It all happens inside one throwaway Docker container, limited to three cores and
# 6 GB, run at the lowest priority, and removed on exit together with its working
# directory. Nothing is installed on the host and no service is touched. It
# refuses to run when the server is busy. It prints timings and word-match scores
# and two fixed test sentences, never a secret: the repository is public and its
# logs are world-readable.
set -uo pipefail

W=/var/tmp/vxbench
# The container runs as root, so its files are root's; it removes them itself.
cleanup() {
  docker run --rm -v "$W":/w alpine find /w -mindepth 1 -delete >/dev/null 2>&1
  rmdir "$W" 2>/dev/null
}
trap cleanup EXIT
mkdir -p "$W" || exit 1

cores=$(nproc)
load=$(cut -d' ' -f1 /proc/loadavg)
echo "cores=$cores  load1=$load  mem_free_mb=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)  disk_free_gb=$(df -BG --output=avail /var/tmp | tail -1 | tr -dc 0-9)"
echo "cpu=$(awk -F: '/model name/{print $2; exit}' /proc/cpuinfo | sed 's/^ *//')"

if awk -v l="$load" -v c="$cores" 'BEGIN{exit !(l > c*0.6)}'; then echo "SKIPPED: the server is busy (load1=$load, cores=$cores)."; exit 0; fi
if [ "$(df -BG --output=avail /var/tmp | tail -1 | tr -dc 0-9)" -lt 6 ]; then echo "SKIPPED: under 6 GB free."; exit 0; fi
command -v docker >/dev/null 2>&1 || { echo "FAILED: docker is not available to this user."; exit 1; }

cat > "$W/inner.py" <<'PY'
import os, re, subprocess, sys, time, urllib.request, wave

AR = "مرحبا بكم في فيجن إكس، منصة تجمع الأخبار والتعلم والألعاب والأدوات لأصحاب البصر الضعيف والمكفوفين في عشرين لغة"
EN = "Welcome to Visionex, a platform that brings together news, learning, games and tools for blind and low vision people in twenty languages."
HF = "https://huggingface.co/rhasspy/piper-voices/resolve/main"
VOICES = {
    "ar": f"{HF}/ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx",
    "en": f"{HF}/en/en_US/lessac/medium/en_US-lessac-medium.onnx",
}

def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)

t = time.time()
r = run([sys.executable, "-m", "pip", "install", "-q", "--no-cache-dir", "piper-tts", "faster-whisper", "av>=13"])
if r.returncode != 0:
    print("FAILED: pip install"); print(r.stderr[-400:]); sys.exit(1)
print(f"install_seconds={time.time()-t:.0f}")

for lang, url in VOICES.items():
    for suffix in ("", ".json"):
        urllib.request.urlretrieve(url + suffix, f"{lang}.onnx{suffix}")
    print(f"voice_model_mb {lang}={os.path.getsize(f'{lang}.onnx')//1048576}")

for lang, text in (("ar", AR), ("en", EN)):
    t = time.time()
    r = run([sys.executable, "-m", "piper", "-m", f"{lang}.onnx", "-f", f"{lang}.wav"], input=text)
    took = time.time() - t
    if r.returncode != 0 or not os.path.exists(f"{lang}.wav"):
        print(f"FAILED: piper {lang}"); print(r.stderr[-300:]); continue
    with wave.open(f"{lang}.wav") as w:
        audio = w.getnframes() / w.getframerate()
    print(f"TTS {lang}: synth_seconds={took:.1f} audio_seconds={audio:.1f} rtf={took/audio:.2f} (includes loading the model)")

def norm(s):
    return re.sub(r"[^\w\s]", " ", s.lower()).split()

try:
    from faster_whisper import WhisperModel
except Exception as e:
    print("FAILED: faster_whisper import", type(e).__name__); sys.exit(1)

threads = min(3, os.cpu_count() or 2)
refs = {"ar": AR, "en": EN}
for size in ("base", "small"):
    t = time.time()
    model = WhisperModel(size, device="cpu", compute_type="int8", cpu_threads=threads)
    load = time.time() - t
    for lang in ("ar", "en"):
        if not os.path.exists(f"{lang}.wav"):
            continue
        t = time.time()
        segs, info = model.transcribe(f"{lang}.wav", language=lang, beam_size=1)
        text = " ".join(s.text for s in segs)
        took = time.time() - t
        ref, got = norm(refs[lang]), norm(text)
        hit = sum(1 for w in ref if w in got)
        print(f"STT {size} {lang}: load_s={load:.1f} transcribe_s={took:.1f} audio_s={info.duration:.1f} "
              f"rtf={took/max(info.duration, 0.01):.2f} words_matched={hit}/{len(ref)} threads={threads}")
PY

timeout 1500 nice -n 19 docker run --rm --cpus=3 --memory=6g -v "$W":/w -w /w -e PYTHONUNBUFFERED=1 python:3.12-slim python /w/inner.py
echo "exit=$?"
