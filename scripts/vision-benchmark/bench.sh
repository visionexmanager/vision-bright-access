#!/usr/bin/env bash
# Measure local image description on the production server: which small vision
# model, if any, is fast and good enough to take photographs off the paid models.
#
# Candidates: Qwen3-VL 2B and 4B and SmolVLM2 (llama.cpp, quantised, CPU) and
# Florence-2 (PyTorch, CPU, English captions only).
#
# Everything happens in throwaway Docker containers limited to three cores, run at
# the lowest priority and removed on exit together with the working directory.
# Nothing is installed on the host and no service is touched. It refuses to run when
# the server is busy.
#
# The test images are NOT anyone's photographs. Four are drawn in the script, with
# an exact known answer (colours, counts, left and right, a sign that reads
# "EXIT 42"); one is a public COCO validation photograph of two cats. The logs are
# world-readable, so the script prints timings, scores and the first 160 characters
# of each answer, never a secret and never anything from a user.
#
# Arabic text is NOT drawn into an image: an Arabic glyph without shaping looks like
# text and reads as nothing, which already misled an OCR investigation once. Arabic
# is tested as the *language of the answer* instead.
#
# The score is crude on purpose: the share of expected facts that appear in the
# answer. It separates "sees nothing" from "sees the scene". It does not judge
# fluency, and it cannot tell a faithful description from a lucky one.
#
# MODELS (env) picks a subset: qwen3vl-2b, qwen3vl-4b, smolvlm2, florence2.
set -uo pipefail

W=/var/tmp/vxvision
MODELS="${MODELS:-qwen3vl-2b,smolvlm2,florence2,qwen3vl-4b}"
case "$MODELS" in *[!a-z0-9,-]*) echo "FAILED: bad MODELS value"; exit 1;; esac

cleanup() {
  docker rm -f vxvllama >/dev/null 2>&1
  # The containers run as root, so the files are root's; one removes them.
  docker run --rm -v "$W":/w alpine find /w -mindepth 1 -delete >/dev/null 2>&1
  rmdir "$W" 2>/dev/null
}
trap cleanup EXIT
mkdir -p "$W/cache" "$W/img" || exit 1

cores=$(nproc)
load=$(cut -d' ' -f1 /proc/loadavg)
echo "cores=$cores  load1=$load  mem_free_mb=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)  disk_free_gb=$(df -BG --output=avail /var/tmp | tail -1 | tr -dc 0-9)"
echo "cpu=$(awk -F: '/model name/{print $2; exit}' /proc/cpuinfo | sed 's/^ *//')"
echo "models=$MODELS"

if awk -v l="$load" -v c="$cores" 'BEGIN{exit !(l > c*0.6)}'; then echo "SKIPPED: the server is busy (load1=$load, cores=$cores)."; exit 0; fi
if [ "$(df -BG --output=avail /var/tmp | tail -1 | tr -dc 0-9)" -lt 14 ]; then echo "SKIPPED: under 14 GB free."; exit 0; fi
command -v docker >/dev/null 2>&1 || { echo "FAILED: docker is not available to this user."; exit 1; }

# ── Shared scoring ───────────────────────────────────────────────────────────
cat > "$W/common.py" <<'PY'
import json, re

def arabic_share(text):
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 0.0
    return sum(1 for c in letters if "؀" <= c <= "ۿ") / len(letters)

def score(answer, checks, want_arabic=False):
    """Share of expected facts present. Arabic answers also need to BE Arabic."""
    a = answer.lower()
    hits = sum(1 for rx in checks if re.search(rx, a))
    total = len(checks)
    if want_arabic:
        total += 1
        hits += 1 if arabic_share(answer) >= 0.6 else 0
    return hits / total if total else 0.0

def load_cases():
    return json.load(open("/w/cases.json"))
PY

# ── The test images and what each must mention ───────────────────────────────
cat > "$W/make.py" <<'PY'
import json, os, urllib.request
from PIL import Image, ImageDraw, ImageFont

os.makedirs("/w/img", exist_ok=True)
font = ImageFont.load_default(size=110)

# 1. three red circles and two blue squares on white
im = Image.new("RGB", (768, 512), "white"); d = ImageDraw.Draw(im)
for i in range(3): d.ellipse((60 + i*150, 60, 160 + i*150, 160), fill=(220, 30, 30))
for i in range(2): d.rectangle((120 + i*220, 300, 240 + i*220, 420), fill=(30, 60, 220))
im.save("/w/img/shapes.png")

# 2. a green sign reading EXIT 42
im = Image.new("RGB", (768, 512), (230, 230, 230)); d = ImageDraw.Draw(im)
d.rectangle((84, 150, 684, 360), fill=(20, 130, 60))
d.text((384, 255), "EXIT 42", fill="white", font=font, anchor="mm")
im.save("/w/img/sign.png")

# 3. a red square on the left, a blue circle on the right
im = Image.new("RGB", (768, 512), "white"); d = ImageDraw.Draw(im)
d.rectangle((60, 170, 260, 370), fill=(220, 30, 30))
d.ellipse((500, 170, 700, 370), fill=(30, 60, 220))
im.save("/w/img/layout.png")

# 4. a public photograph: two cats asleep on a pink couch with remote controls
try:
    urllib.request.urlretrieve("http://images.cocodataset.org/val2017/000000039769.jpg", "/w/img/cats.jpg")
    im = Image.open("/w/img/cats.jpg"); im.thumbnail((768, 768)); im.save("/w/img/cats.jpg")
    have_cats = True
except Exception as e:
    print("note: cats photograph not downloaded:", type(e).__name__); have_cats = False

EN = "Describe this image in detail for a blind person."
AR = "صف هذه الصورة بالتفصيل لشخص كفيف. أجب بالعربية فقط."
cases = [
    {"id": "shapes-en", "img": "shapes.png", "prompt": EN, "ar": False,
     "checks": [r"red", r"blue", r"circle", r"square", r"(3|three)\b", r"(2|two)\b"]},
    {"id": "sign-en", "img": "sign.png", "prompt": EN, "ar": False,
     "checks": [r"exit", r"42", r"green"]},
    {"id": "layout-en", "img": "layout.png", "prompt": EN, "ar": False,
     "checks": [r"red.{0,60}left|left.{0,60}red", r"blue.{0,60}right|right.{0,60}blue", r"square", r"circle"]},
    {"id": "shapes-ar", "img": "shapes.png", "prompt": AR, "ar": True,
     "checks": [r"أحمر|حمراء|حمر", r"أزرق|زرقاء|زرق", r"دائر|دوائر", r"مربع"]},
]
if have_cats:
    cases += [
        {"id": "cats-en", "img": "cats.jpg", "prompt": EN, "ar": False,
         "checks": [r"cat", r"couch|sofa", r"remote|controller", r"(2|two)\b", r"pink"]},
        {"id": "cats-ar", "img": "cats.jpg", "prompt": AR, "ar": True,
         "checks": [r"قط", r"أريك|كنب|اريك|أريكة", r"ريموت|جهاز تحكم|تحكم", r"وردي|زهري"]},
    ]
json.dump(cases, open("/w/cases.json", "w"), ensure_ascii=False)
print("cases", len(cases))
PY
echo "== making test images"
docker run --rm -v "$W":/w -w /w python:3.12-slim sh -c 'pip install -q --no-cache-dir pillow >/dev/null 2>&1 && python /w/make.py' || { echo "FAILED: test images"; exit 1; }

# ── llama.cpp client (Qwen3-VL, SmolVLM2) ────────────────────────────────────
cat > "$W/client.py" <<'PY'
import base64, json, sys, time, urllib.request
sys.path.insert(0, "/w")
from common import load_cases, score

name = sys.argv[1]
scores, secs = [], []
for case in load_cases():
    mime = "image/png" if case["img"].endswith(".png") else "image/jpeg"
    b64 = base64.b64encode(open("/w/img/" + case["img"], "rb").read()).decode()
    body = json.dumps({
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": case["prompt"]},
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
        ]}],
        "max_tokens": 200, "temperature": 0,
    }).encode()
    req = urllib.request.Request("http://127.0.0.1:8099/v1/chat/completions", body, {"content-type": "application/json"})
    t = time.time()
    try:
        out = json.load(urllib.request.urlopen(req, timeout=300))
    except Exception as e:
        print(f"  {case['id']}: FAILED {type(e).__name__}")
        scores.append(0.0)
        if time.time() - t > 250:
            print("  (too slow, skipping the rest of this model)")
            break
        continue
    took = time.time() - t
    text = out["choices"][0]["message"]["content"] or ""
    s = score(text, case["checks"], case["ar"])
    tm = out.get("timings", {})
    scores.append(s); secs.append(took)
    print(f"  {case['id']}: score={s:.2f} seconds={took:.1f} prompt_ms={tm.get('prompt_ms', 0):.0f} "
          f"tok_per_s={tm.get('predicted_per_second', 0):.1f} | {text[:160].replace(chr(10), ' ')}")
if scores:
    print(f"SUMMARY {name}: mean_score={sum(scores)/len(scores):.2f} mean_seconds={(sum(secs)/len(secs) if secs else 0):.1f} cases={len(scores)}")
PY

llama_model() {  # key, hf-repo:quant
  local key="$1" repo="$2"
  echo "== $key ($repo)"
  docker rm -f vxvllama >/dev/null 2>&1
  nice -n 19 docker run -d --name vxvllama --cpus=3 --memory=7g -p 127.0.0.1:8099:8080 \
    -v "$W/cache":/root/.cache ghcr.io/ggml-org/llama.cpp:server \
    -hf "$repo" --host 0.0.0.0 --port 8080 -c 4096 -t 3 --no-webui >/dev/null 2>&1 \
    || { echo "FAILED: could not start the server image"; return; }
  local ok=0 started=$(date +%s)
  for _ in $(seq 1 180); do
    if curl -fsS http://127.0.0.1:8099/health >/dev/null 2>&1; then ok=1; break; fi
    docker ps -q -f name=vxvllama | grep -q . || break
    sleep 5
  done
  if [ "$ok" != 1 ]; then
    echo "FAILED: $key did not become ready (does the repository exist, and does it ship an mmproj file?)"
    docker logs --tail 12 vxvllama 2>&1 | cut -c1-200
    docker rm -f vxvllama >/dev/null 2>&1
    return
  fi
  echo "ready_seconds=$(( $(date +%s) - started )) (includes the download)"
  docker run --rm --network host -v "$W":/w python:3.12-slim python /w/client.py "$key"
  docker rm -f vxvllama >/dev/null 2>&1
}

# ── Florence-2 (PyTorch, English captions) ───────────────────────────────────
cat > "$W/florence.py" <<'PY'
import sys, time
sys.path.insert(0, "/w")
from unittest.mock import patch
from common import load_cases, score

try:
    from transformers import AutoModelForCausalLM, AutoProcessor
    from transformers.dynamic_module_utils import get_imports
    from PIL import Image
    import torch
    torch.set_num_threads(3)

    def no_flash(f):  # the remote code imports flash_attn, which cannot exist on CPU
        imps = get_imports(f)
        return [i for i in imps if i != "flash_attn"] if str(f).endswith("modeling_florence2.py") else imps

    t = time.time()
    with patch("transformers.dynamic_module_utils.get_imports", no_flash):
        model = AutoModelForCausalLM.from_pretrained("microsoft/Florence-2-large", trust_remote_code=True,
                                                     torch_dtype=torch.float32, attn_implementation="eager").eval()
    proc = AutoProcessor.from_pretrained("microsoft/Florence-2-large", trust_remote_code=True)
    print(f"load_seconds={time.time()-t:.0f}")
except Exception as e:
    print("FAILED: florence-2 did not load:", type(e).__name__, str(e)[:200]); sys.exit(0)

scores, secs = [], []
task = "<MORE_DETAILED_CAPTION>"
for case in load_cases():
    if case["ar"]:
        print(f"  {case['id']}: n/a (Florence-2 answers in English only)")
        continue
    img = Image.open("/w/img/" + case["img"]).convert("RGB")
    t = time.time()
    try:
        inputs = proc(text=task, images=img, return_tensors="pt")
        with torch.no_grad():
            ids = model.generate(input_ids=inputs["input_ids"], pixel_values=inputs["pixel_values"],
                                 max_new_tokens=200, num_beams=1, do_sample=False)
        text = proc.batch_decode(ids, skip_special_tokens=True)[0]
    except Exception as e:
        print(f"  {case['id']}: FAILED {type(e).__name__} {str(e)[:120]}")
        scores.append(0.0)
        continue
    took = time.time() - t
    s = score(text, case["checks"], False)
    scores.append(s); secs.append(took)
    print(f"  {case['id']}: score={s:.2f} seconds={took:.1f} | {text[:160].replace(chr(10), ' ')}")
if scores:
    print(f"SUMMARY florence2: mean_score={sum(scores)/len(scores):.2f} mean_seconds={(sum(secs)/len(secs) if secs else 0):.1f} cases={len(scores)} (English only)")
PY

florence() {
  echo "== florence2 (microsoft/Florence-2-large)"
  nice -n 19 timeout 1500 docker run --rm --cpus=3 --memory=7g -v "$W":/w -w /w -e HF_HOME=/w/cache -e PYTHONUNBUFFERED=1 python:3.12-slim sh -c '
    pip install -q --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1 &&
    pip install -q --no-cache-dir "transformers==4.46.3" einops timm pillow numpy >/dev/null 2>&1 &&
    python /w/florence.py' || echo "FAILED: florence-2 step"
}

for m in $(echo "$MODELS" | tr ',' ' '); do
  case "$m" in
    qwen3vl-2b) llama_model qwen3vl-2b "bartowski/Qwen_Qwen3-VL-2B-Instruct-GGUF:Q4_K_M" ;;
    qwen3vl-4b) llama_model qwen3vl-4b "bartowski/Qwen_Qwen3-VL-4B-Instruct-GGUF:Q4_K_M" ;;
    smolvlm2)   llama_model smolvlm2   "ggml-org/SmolVLM2-2.2B-Instruct-GGUF" ;;
    florence2)  florence ;;
    *) echo "skipped unknown model: $m" ;;
  esac
done
echo "done"
