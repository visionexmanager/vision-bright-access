#!/usr/bin/env bash
# Measure local speech on the production server: text-to-speech with Piper and
# speech-to-text with Whisper (faster-whisper, the CTranslate2 build of the same
# weights that whisper.cpp runs).
#
# Read-and-measure only. Everything lives in one temporary directory that is
# removed on exit; nothing is installed system-wide and no service is touched. It
# refuses to run when the server is busy, runs at the lowest priority, and prints
# timings and word-match scores only. The repository is public and its logs are
# world-readable: the two test sentences below are not secrets, and nothing else
# is printed.
set -uo pipefail

W=/var/tmp/vxbench
trap 'rm -rf "$W"' EXIT
mkdir -p "$W" && cd "$W" || exit 1

cores=$(nproc)
load=$(cut -d' ' -f1 /proc/loadavg)
echo "cores=$cores  load1=$load  mem_free_mb=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)  disk_free_gb=$(df -BG --output=avail /var/tmp | tail -1 | tr -dc 0-9)"
cpu=$(awk -F: '/model name/{print $2; exit}' /proc/cpuinfo | sed 's/^ *//'); echo "cpu=$cpu"

if awk -v l="$load" -v c="$cores" 'BEGIN{exit !(l > c*0.6)}'; then echo "SKIPPED: the server is busy (load1=$load, cores=$cores)."; exit 0; fi
if [ "$(df -BG --output=avail /var/tmp | tail -1 | tr -dc 0-9)" -lt 6 ]; then echo "SKIPPED: under 6 GB free."; exit 0; fi

python3 -m venv venv >/dev/null 2>&1 || { echo "FAILED: python3 venv is not available."; exit 1; }
t0=$(date +%s.%N)
nice -n 19 venv/bin/pip -q install piper-tts faster-whisper >pip.log 2>&1 || { echo "FAILED: pip install"; tail -3 pip.log; exit 1; }
echo "install_seconds=$(echo "$(date +%s.%N) - $t0" | bc 2>/dev/null || echo n/a)"

HF=https://huggingface.co/rhasspy/piper-voices/resolve/main
get() { curl -fsSL -m 300 -o "$2" "$1" || { echo "FAILED: download $2"; exit 1; }; }
get "$HF/ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx" ar.onnx
get "$HF/ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx.json" ar.onnx.json
get "$HF/en/en_US/lessac/medium/en_US-lessac-medium.onnx" en.onnx
get "$HF/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json" en.onnx.json
echo "voice_model_mb ar=$(du -m ar.onnx | cut -f1) en=$(du -m en.onnx | cut -f1)"

AR="مرحبا بكم في فيجن إكس، منصة تجمع الأخبار والتعلم والألعاب والأدوات لأصحاب البصر الضعيف والمكفوفين في عشرين لغة"
EN="Welcome to Visionex, a platform that brings together news, learning, games and tools for blind and low vision people in twenty languages."
export AR EN

for lang in ar en; do
  text=$([ "$lang" = ar ] && echo "$AR" || echo "$EN")
  s=$(date +%s.%N)
  printf '%s' "$text" | nice -n 19 venv/bin/python -m piper -m "$lang.onnx" -f "$lang.wav" >/dev/null 2>"piper-$lang.log" || { echo "FAILED: piper $lang"; tail -2 "piper-$lang.log"; continue; }
  e=$(date +%s.%N)
  dur=$(venv/bin/python -c "import wave,sys;w=wave.open('$lang.wav');print(round(w.getnframes()/w.getframerate(),2))")
  echo "TTS $lang: synth_seconds=$(echo "$e - $s" | bc) audio_seconds=$dur (first call includes loading the model)"
done

cat > stt.py <<'PY'
import os, re, sys, time
from faster_whisper import WhisperModel

def norm(t):
    return re.sub(r"[^\w\s]", " ", t.lower()).split()

refs = {"ar": os.environ["AR"], "en": os.environ["EN"]}
threads = min(4, os.cpu_count() or 2)
for size in ("base", "small"):
    t0 = time.time()
    model = WhisperModel(size, device="cpu", compute_type="int8", cpu_threads=threads)
    load = time.time() - t0
    for lang in ("ar", "en"):
        path = f"{lang}.wav"
        if not os.path.exists(path):
            continue
        t1 = time.time()
        segs, info = model.transcribe(path, language=lang, beam_size=1)
        text = " ".join(s.text for s in segs)
        took = time.time() - t1
        ref, got = norm(refs[lang]), norm(text)
        hit = sum(1 for w in ref if w in got)
        print(f"STT {size} {lang}: load_s={load:.1f} transcribe_s={took:.1f} audio_s={info.duration:.1f} "
              f"rtf={took/max(info.duration,0.01):.2f} words_matched={hit}/{len(ref)} threads={threads}")
PY
nice -n 19 venv/bin/python stt.py 2>stt.err || { echo "FAILED: whisper"; tail -3 stt.err; }
echo "peak_dir_mb=$(du -sm "$W" | cut -f1)  (removed on exit)"
