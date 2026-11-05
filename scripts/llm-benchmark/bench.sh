#!/usr/bin/env bash
# Measure local TEXT chat models on the production server: is a small model fast
# and good enough to answer WhatsApp / website conversations, written or voiced?
#
# Candidates (llama.cpp, Q4_K_M, CPU only): Qwen3-1.7B and Qwen3-4B-Instruct-2507.
#
# Everything runs in one throwaway container limited to three cores, at the lowest
# priority, removed on exit together with the working directory. Nothing is
# installed on the host and no service is touched. It refuses to run when the
# server is busy.
#
# The prompts are invented test questions with a known answer, never a user's
# message. The logs are world-readable, so the script prints timings, scores and the
# first 160 characters of each answer, never a secret.
#
# The score is crude on purpose: the share of expected facts present in the answer
# (plus, for Arabic prompts, "the answer is actually Arabic"). It separates "answers"
# from "does not answer"; it cannot judge fluency or tone.
#
# Thinking is switched off (chat_template_kwargs.enable_thinking=false) because a
# voice reply cannot wait for hidden reasoning.
#
# MODELS (env) picks a subset: qwen3-1.7b, qwen3-4b.
set -uo pipefail

W=/var/tmp/vxllm
MODELS="${MODELS:-qwen3-1.7b,qwen3-4b}"
case "$MODELS" in *[!a-z0-9.,-]*) echo "FAILED: bad MODELS value"; exit 1;; esac

cleanup() {
  docker rm -f vxllmllama >/dev/null 2>&1
  docker run --rm -v "$W":/w alpine find /w -mindepth 1 -delete >/dev/null 2>&1
  rmdir "$W" 2>/dev/null
}
trap cleanup EXIT
mkdir -p "$W/cache" || exit 1

cores=$(nproc)
load=$(cut -d' ' -f1 /proc/loadavg)
echo "cores=$cores  load1=$load  mem_free_mb=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)  disk_free_gb=$(df -BG --output=avail /var/tmp | tail -1 | tr -dc 0-9)"
echo "cpu=$(awk -F: '/model name/{print $2; exit}' /proc/cpuinfo | sed 's/^ *//')"
echo "models=$MODELS"

if awk -v l="$load" -v c="$cores" 'BEGIN{exit !(l > c*0.6)}'; then echo "SKIPPED: the server is busy (load1=$load, cores=$cores)."; exit 0; fi
if [ "$(df -BG --output=avail /var/tmp | tail -1 | tr -dc 0-9)" -lt 8 ]; then echo "SKIPPED: under 8 GB free."; exit 0; fi
command -v docker >/dev/null 2>&1 || { echo "FAILED: docker is not available to this user."; exit 1; }

cat > "$W/client.py" <<'PY'
import json, re, sys, threading, time, urllib.request

URL = "http://127.0.0.1:8099/v1/chat/completions"
SYSTEM = ("You are a short, clear voice assistant for blind and low-vision users. "
          "Reply in the language of the question, in at most three short sentences, "
          "with no markdown and no emoji.")

def arabic_share(text):
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 0.0
    return sum(1 for c in letters if "؀" <= c <= "ۿ") / len(letters)

def clean(text):
    return re.sub(r"<think>.*?</think>", "", text or "", flags=re.S).strip()

def score(answer, checks, want_arabic):
    a = answer.lower()
    hits = sum(1 for rx in checks if re.search(rx, a))
    total = len(checks)
    if want_arabic:
        total += 1
        hits += 1 if arabic_share(answer) >= 0.6 else 0
    return hits / total if total else 0.0

HISTORY = []
for i in range(1, 9):
    HISTORY.append({"role": "user", "content": f"Note {i}: please remember that I like tea number {i} and my favourite colour is blue. Also keep answers short."})
    HISTORY.append({"role": "assistant", "content": f"Noted, tea number {i} and blue."})
HISTORY[0] = {"role": "user", "content": "My name is Sami and I live in Tripoli. Please remember it."}

CASES = [
    ("en-capital",  "en", [{"role": "user", "content": "What is the capital of France? One short sentence."}], [r"paris"], False),
    ("ar-capital",  "ar", [{"role": "user", "content": "ما عاصمة لبنان؟ أجب بجملة قصيرة."}], [r"بيروت"], True),
    ("ar-math",     "ar", [{"role": "user", "content": "كم يساوي 17 × 6؟"}], [r"102"], True),
    ("en-list",     "en", [{"role": "user", "content": "Give me three tips for crossing a street safely if I am blind. Use a numbered list."}], [r"1[\.\)]", r"3[\.\)]"], False),
    ("ar-advice",   "ar", [{"role": "user", "content": "أنا كفيف، كيف أطلب من سائق التاكسي أن يوصلني إلى المستشفى؟"}], [r"مستشفى"], True),
    ("fr-capital",  "fr", [{"role": "user", "content": "Quelle est la capitale de l'Espagne ? Réponds en une phrase."}], [r"madrid"], False),
    ("fa-capital",  "fa", [{"role": "user", "content": "پایتخت ایران کجاست؟ یک جمله کوتاه."}], [r"تهران"], False),
    ("tr-capital",  "tr", [{"role": "user", "content": "Türkiye'nin başkenti neresidir? Tek cümle."}], [r"ankara"], False),
    ("es-capital",  "es", [{"role": "user", "content": "¿Cuál es la capital de Italia? Una frase."}], [r"roma"], False),
    ("obey",        "en", [{"role": "user", "content": "Reply with only the word OK."}], [r"^\W*ok\W*$"], False),
    ("recall",      "en", HISTORY + [{"role": "user", "content": "What is my name and which city do I live in?"}], [r"sami", r"tripoli"], False),
]

def call(messages, max_tokens=160):
    body = json.dumps({
        "messages": [{"role": "system", "content": SYSTEM}] + messages,
        "max_tokens": max_tokens, "temperature": 0,
        "chat_template_kwargs": {"enable_thinking": False},
    }).encode()
    req = urllib.request.Request(URL, body, {"content-type": "application/json"})
    t = time.time()
    out = json.load(urllib.request.urlopen(req, timeout=300))
    return out, time.time() - t

name = sys.argv[1]
try:
    call([{"role": "user", "content": "Hello"}], 8)  # warm-up, not counted
except Exception as e:
    print(f"  warm-up FAILED {type(e).__name__}")
    sys.exit(0)

scores, secs, tps, ttft = [], [], [], []
for cid, lang, msgs, checks, ar in CASES:
    try:
        out, took = call(msgs)
    except Exception as e:
        print(f"  {cid}: FAILED {type(e).__name__}")
        scores.append(0.0)
        continue
    text = clean(out["choices"][0]["message"]["content"])
    s = score(text, checks, ar)
    tm = out.get("timings", {})
    scores.append(s); secs.append(took)
    tps.append(tm.get("predicted_per_second", 0)); ttft.append(tm.get("prompt_ms", 0) / 1000)
    print(f"  {cid}: score={s:.2f} seconds={took:.1f} prompt_tokens={out.get('usage', {}).get('prompt_tokens', 0)} "
          f"prompt_s={tm.get('prompt_ms', 0)/1000:.2f} gen_tokens={out.get('usage', {}).get('completion_tokens', 0)} "
          f"tok_per_s={tm.get('predicted_per_second', 0):.1f} | {text[:160].replace(chr(10), ' ')}")

def mean(xs):
    return sum(xs) / len(xs) if xs else 0.0

print(f"SUMMARY {name}: mean_score={mean(scores):.2f} mean_seconds={mean(secs):.1f} "
      f"mean_tok_per_s={mean(tps):.1f} mean_prompt_s={mean(ttft):.2f} cases={len(scores)}")

# Two people asking at the same moment.
results = []
def worker():
    try:
        _, took = call([{"role": "user", "content": "Give me two tips for staying safe at home."}], 80)
        results.append(took)
    except Exception:
        results.append(-1)
ths = [threading.Thread(target=worker) for _ in range(2)]
t0 = time.time()
[t.start() for t in ths]; [t.join() for t in ths]
print(f"CONCURRENCY {name}: 2 simultaneous requests, wall={time.time()-t0:.1f}s each={[round(r, 1) for r in results]}")
PY

llama_model() {  # key, hf-repo:quant
  local key="$1" repo="$2"
  echo "== $key ($repo)"
  docker rm -f vxllmllama >/dev/null 2>&1
  nice -n 19 docker run -d --name vxllmllama --cpus=3 --memory=6g -p 127.0.0.1:8099:8080 \
    -v "$W/cache":/root/.cache ghcr.io/ggml-org/llama.cpp:server \
    -hf "$repo" --host 0.0.0.0 --port 8080 -c 8192 --parallel 2 -t 3 --no-webui >/dev/null 2>&1 \
    || { echo "FAILED: could not start the server image"; return; }
  local ok=0 started=$(date +%s)
  for _ in $(seq 1 120); do
    if curl -fsS http://127.0.0.1:8099/health >/dev/null 2>&1; then ok=1; break; fi
    docker ps -q -f name=vxllmllama | grep -q . || break
    sleep 5
  done
  if [ "$ok" != 1 ]; then
    echo "FAILED: $key did not become ready"
    docker logs --tail 12 vxllmllama 2>&1 | cut -c1-200
    docker rm -f vxllmllama >/dev/null 2>&1
    return
  fi
  echo "ready_seconds=$(( $(date +%s) - started )) (includes the download)"
  docker run --rm --network host -v "$W":/w python:3.12-slim python /w/client.py "$key"
  echo "memory: $(docker stats --no-stream --format '{{.MemUsage}}' vxllmllama 2>/dev/null)"
  docker rm -f vxllmllama >/dev/null 2>&1
}

for m in $(echo "$MODELS" | tr ',' ' '); do
  case "$m" in
    qwen3-1.7b) llama_model qwen3-1.7b "bartowski/Qwen_Qwen3-1.7B-GGUF:Q4_K_M" ;;
    qwen3-4b)   llama_model qwen3-4b   "bartowski/Qwen_Qwen3-4B-Instruct-2507-GGUF:Q4_K_M" ;;
    *) echo "skipped unknown model: $m" ;;
  esac
done
echo "done"
