#!/usr/bin/env bash
# Visionex Data Hub — runs ON the server that holds the persistent disk.
#
#   datahub.sh inspect                      read-only: disk, inodes, Docker, what is already there
#   datahub.sh init                         create the dedicated data directory and its layout (idempotent)
#   datahub.sh status                       measure the Data Hub and write manifests/storage.json
#   datahub.sh install NAME VERSION URL SHA256 EXTRACT_MB [ARCHIVE]
#                                           download -> verify -> extract -> validate -> atomic switch
#
# GitHub holds this script, config and manifests. Supabase holds metadata. THIS DISK holds the data.
#
# Everything is bounded by a LOGICAL budget (default 100 GB) inside the physical disk, and by a reserve
# that is never touched. A download that would not fit is not started. A failed update leaves the
# previous version active. Nothing here prints a secret, a file name from user uploads, or a URL with
# credentials: the repository is public and its CI logs are world-readable.
set -euo pipefail

DATA_DIR="${DATA_DIR:-/var/lib/visionex/data}"
BUDGET_GB="${BUDGET_GB:-100}"            # the global logical budget for datasets, indexes and caches
RESERVE_GB="${RESERVE_GB:-10}"           # free space that is never used
EMERGENCY_FREE_PCT="${EMERGENCY_FREE_PCT:-8}"   # below this much free disk: no new downloads, expired cache cleaned
KEEP_VERSIONS="${KEEP_VERSIONS:-2}"      # the active version and the previous known-good one

GB=$((1024 * 1024 * 1024))
MB=$((1024 * 1024))

layout=(
  datasets/unicode datasets/cldr datasets/geonames datasets/openlibrary datasets/iana datasets/iso datasets/technical datasets/education
  indexes
  cache/ai cache/search cache/assets cache/conversions cache/whatsapp
  tmp manifests backups logs config
)

say() { printf '%s\n' "$*"; }
die() { say "ERROR: $*" >&2; exit 1; }

fs_total() { df -B1 --output=size "$1" | tail -1 | tr -d ' '; }
fs_used()  { df -B1 --output=used "$1" | tail -1 | tr -d ' '; }
fs_free()  { df -B1 --output=avail "$1" | tail -1 | tr -d ' '; }
dir_bytes() { [ -d "$1" ] && du -sB1 "$1" 2>/dev/null | cut -f1 || echo 0; }
human() { numfmt --to=iec --suffix=B "$1" 2>/dev/null || echo "$1 B"; }

# ── inspect: read-only ───────────────────────────────────────────────────────
inspect() {
  say "## Filesystems (capacity, used, free)"
  df -hT -x tmpfs -x devtmpfs -x overlay 2>/dev/null || df -hT
  say
  say "## Block devices"
  lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT 2>/dev/null || true
  say
  say "## Inodes"
  df -i -x tmpfs -x devtmpfs -x overlay 2>/dev/null || df -i
  say
  say "## Where / and /var/lib live"
  findmnt -no TARGET,SOURCE,FSTYPE,SIZE,USED,AVAIL / 2>/dev/null || true
  findmnt -no TARGET,SOURCE,FSTYPE -T /var/lib 2>/dev/null || true
  say
  say "## Docker storage"
  if command -v docker >/dev/null 2>&1; then
    docker system df 2>/dev/null || say "(docker system df needs permission)"
    say "docker root: $(docker info --format '{{.DockerRootDir}}' 2>/dev/null || echo unknown)"
    say "--- containers (name, image, status) ---"
    docker ps -a --format '{{.Names}}  {{.Image}}  {{.Status}}' 2>/dev/null | head -30
    say "--- named volumes ---"
    docker volume ls --format '{{.Name}}' 2>/dev/null | head -30
    say "--- bind mounts per container (source -> destination) ---"
    for c in $(docker ps -aq 2>/dev/null | head -30); do
      n=$(docker inspect -f '{{.Name}}' "$c" 2>/dev/null | tr -d '/')
      docker inspect -f '{{range .Mounts}}{{.Type}} {{.Source}} -> {{.Destination}}{{"\n"}}{{end}}' "$c" 2>/dev/null | sed "s|^|$n: |" | grep -v ': $' || true
    done
  else
    say "(docker not installed)"
  fi
  say
  say "## Sizes of the big directories (totals only, no file names)"
  for d in /var/lib/docker /var/lib/containerd /var/log /var/cache /var/www /var/backups /opt /srv /home /root /tmp /var/lib/visionex /var/lib/postgresql /var/lib/snapd; do
    [ -e "$d" ] && printf '%-24s %s\n' "$d" "$(du -xsh "$d" 2>/dev/null | cut -f1)"
  done
  say
  say "## Top-level usage of / (one level, sizes only)"
  du -xh --max-depth=1 / 2>/dev/null | sort -rh | head -14
  say
  say "## Existing Visionex directories (names of directories only, never files)"
  for d in /var/lib/visionex /var/lib/visionex/data /opt/visionex /srv/visionex /var/www; do
    [ -d "$d" ] && { printf '%s\n' "$d"; find "$d" -maxdepth 2 -type d 2>/dev/null | head -20 | sed 's/^/   /'; }
  done
  say
  say "## Log and journal size"
  journalctl --disk-usage 2>/dev/null || true
  say
  say "## Tools available for the update worker"
  for t in curl wget sha256sum tar gzip unzip xz jq python3 flock numfmt; do
    printf '%-10s %s\n' "$t" "$(command -v "$t" >/dev/null 2>&1 && echo yes || echo no)"
  done
  say
  say "## Uptime and memory"
  uptime -p 2>/dev/null || true
  free -h 2>/dev/null | head -2
}

# ── init: the dedicated directory, outside any deployment directory ──────────
init() {
  case "$DATA_DIR" in
    /var/lib/*|/srv/*|/data/*|/mnt/*) ;;
    *) [ "${DATAHUB_TEST:-}" = 1 ] || die "DATA_DIR must be a persistent system path (got a path outside /var/lib, /srv, /data, /mnt)" ;;
  esac
  parent="$(dirname "$DATA_DIR")"
  mkdir -p "$parent"
  free=$(fs_free "$parent"); total=$(fs_total "$parent")
  need=$(( (BUDGET_GB + RESERVE_GB) * GB ))
  say "filesystem of $parent: total $(human "$total"), free $(human "$free"); budget $BUDGET_GB GB + reserve $RESERVE_GB GB"
  if [ "$free" -lt "$need" ]; then
    say "NOTE: free space is below budget+reserve. The budget is capped to what fits, it is not forced."
  fi
  mkdir -p "$DATA_DIR"
  for d in "${layout[@]}"; do mkdir -p "$DATA_DIR/$d"; done
  # Readable by the service in the read-only container (it runs as an unprivileged user). Public datasets only; nothing secret lives here,
  # and the service is the only door: this directory is not served by nginx and not exposed anywhere.
  chmod 755 "$DATA_DIR"; chmod -R go+rX "$DATA_DIR" 2>/dev/null || true
  # A marker the deploy scripts can check: if this file is missing the directory was replaced.
  [ -f "$DATA_DIR/config/HUB_ID" ] || { date -u +%Y-%m-%dT%H:%M:%SZ > "$DATA_DIR/config/HUB_ID"; }
  # Effective budget: never more than fits with the reserve left over.
  fit_gb=$(( (free / GB) - RESERVE_GB )); [ "$fit_gb" -lt 0 ] && fit_gb=0
  eff=$BUDGET_GB; [ "$fit_gb" -lt "$eff" ] && eff=$fit_gb
  cat > "$DATA_DIR/config/budget.env" <<EOF
# Written by datahub.sh init. Edit only through the workflow.
BUDGET_GB=$BUDGET_GB
EFFECTIVE_BUDGET_GB=$eff
RESERVE_GB=$RESERVE_GB
EMERGENCY_FREE_PCT=$EMERGENCY_FREE_PCT
KEEP_VERSIONS=$KEEP_VERSIONS
EOF
  sync_conf
  [ -f "$DATA_DIR/config/datasets.conf" ] || cat > "$DATA_DIR/config/datasets.conf" <<'CONF'
# group|name|official source (https)|declared extracted size in MB|archive|file that must exist after extraction
# The first, smallest, authoritative datasets. Larger ones are added here only after the disk has been measured.
unicode|unicode-ucd|https://www.unicode.org/Public/UCD/latest/ucd/UCD.zip|150|zip|UnicodeData.txt
cldr|cldr-core|https://unicode.org/Public/cldr/latest/core.zip|400|zip|root.xml
iana|language-subtag-registry|https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry|1|raw|language-subtag-registry
iana|tzdata|https://data.iana.org/time-zones/tzdata-latest.tar.gz|10|tar.gz|tzdata.zi
CONF
  say "initialised: $DATA_DIR (effective budget ${eff} GB)"
  find "$DATA_DIR" -maxdepth 2 -type d | sort | sed "s|^$DATA_DIR|.|" | head -40
  status
}

load_budget() {
  [ -f "$DATA_DIR/config/budget.env" ] && . "$DATA_DIR/config/budget.env"
  EFFECTIVE_BUDGET_GB="${EFFECTIVE_BUDGET_GB:-$BUDGET_GB}"
}

# ── status: measure, never estimate ──────────────────────────────────────────
status() {
  [ -d "$DATA_DIR" ] || die "$DATA_DIR does not exist (run init)"
  load_budget
  total=$(fs_total "$DATA_DIR"); used=$(fs_used "$DATA_DIR"); free=$(fs_free "$DATA_DIR")
  datasets=$(dir_bytes "$DATA_DIR/datasets"); indexes=$(dir_bytes "$DATA_DIR/indexes")
  cache_global=$(( $(dir_bytes "$DATA_DIR/cache/ai") + $(dir_bytes "$DATA_DIR/cache/search") + $(dir_bytes "$DATA_DIR/cache/whatsapp") ))
  cache_assets=$(dir_bytes "$DATA_DIR/cache/assets"); cache_conv=$(dir_bytes "$DATA_DIR/cache/conversions")
  tmp=$(dir_bytes "$DATA_DIR/tmp")
  reserved=$(( RESERVE_GB * GB ))
  hub=$(( datasets + indexes + cache_global + cache_assets + cache_conv + tmp ))
  budget=$(( EFFECTIVE_BUDGET_GB * GB ))
  remaining=$(( budget - hub )); [ "$remaining" -lt 0 ] && remaining=0
  free_pct=$(( free * 100 / total ))
  state=ok
  [ "$free_pct" -lt $(( EMERGENCY_FREE_PCT * 2 )) ] && state=low
  [ "$free_pct" -lt "$EMERGENCY_FREE_PCT" ] && state=emergency
  [ "$hub" -gt "$budget" ] && state=over_budget
  out="$DATA_DIR/manifests/storage.json"
  tmpf="$out.tmp.$$"
  cat > "$tmpf" <<EOF
{
  "measured_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "path": "$DATA_DIR",
  "state": "$state",
  "disk": { "total_bytes": $total, "used_bytes": $used, "free_bytes": $free, "free_percent": $free_pct },
  "budget": { "configured_gb": $BUDGET_GB, "effective_gb": $EFFECTIVE_BUDGET_GB, "reserve_gb": $RESERVE_GB, "emergency_free_percent": $EMERGENCY_FREE_PCT },
  "data_hub": {
    "datasets_bytes": $datasets, "indexes_bytes": $indexes, "global_cache_bytes": $cache_global,
    "asset_cache_bytes": $cache_assets, "conversion_cache_bytes": $cache_conv, "temporary_bytes": $tmp,
    "reserved_bytes": $reserved, "total_bytes": $hub, "remaining_budget_bytes": $remaining
  }
}
EOF
  mv -f "$tmpf" "$out"
  say "STATE $state"
  say "Disk total         : $(human "$total")"
  say "Disk used          : $(human "$used")"
  say "Disk free          : $(human "$free") (${free_pct}%)"
  say "Data Hub budget    : ${EFFECTIVE_BUDGET_GB} GB (configured ${BUDGET_GB} GB), reserve ${RESERVE_GB} GB"
  say "Data Hub datasets  : $(human "$datasets")"
  say "Data Hub indexes   : $(human "$indexes")"
  say "Global cache       : $(human "$cache_global")"
  say "Asset cache        : $(human "$cache_assets")"
  say "Conversion cache   : $(human "$cache_conv")"
  say "Temporary          : $(human "$tmp")"
  say "Reserved           : $(human "$reserved")"
  say "Total Data Hub     : $(human "$hub")"
  say "Remaining budget   : $(human "$remaining")"
  say "Path               : $DATA_DIR"
}

# ── install: versioned, verified, atomic ─────────────────────────────────────
install_dataset() {
  name="${1:-}"; version="${2:-}"; url="${3:-}"; sha="${4:-}"; extract_mb="${5:-}"; archive="${6:-auto}"
  [ -n "$name" ] && [ -n "$version" ] && [ -n "$url" ] && [ -n "$extract_mb" ] || die "usage: install NAME VERSION URL SHA256|- EXTRACT_MB [zip|tar.gz|gz|raw]"
  [[ "$name" =~ ^[a-z0-9_-]{1,40}$ ]] || die "bad dataset name"
  [[ "$version" =~ ^[A-Za-z0-9._-]{1,40}$ ]] || die "bad version"
  [[ "$url" == https://* ]] || die "the source must be an https URL"
  case "$url" in *[[:space:]]*|*\"*|*\'*|*\;*|*\`*|*\$*|*\|*|*\&*|*\<*|*\>*) die "the source URL has characters that are not allowed" ;; esac
  [[ "$extract_mb" =~ ^[0-9]{1,7}$ ]] || die "EXTRACT_MB must be a number"
  [ -d "$DATA_DIR" ] || die "$DATA_DIR does not exist (run init)"
  load_budget

  group="${DATASET_GROUP:-technical}"
  [ -d "$DATA_DIR/datasets/$group" ] || die "unknown group $group"
  base="$DATA_DIR/datasets/$group/$name"
  mkdir -p "$base/versions"

  # 1. space: download + extract + temp headroom, against the free disk, the reserve and the budget
  head_bytes=$(curl -fsSIL --max-time 30 "$url" 2>/dev/null | awk 'tolower($1)=="content-length:"{v=$2} END{gsub("\r","",v); print v+0}')
  [ -n "$head_bytes" ] || head_bytes=0
  extract_bytes=$(( extract_mb * MB ))
  need=$(( head_bytes + extract_bytes + extract_bytes / 10 ))
  free=$(fs_free "$DATA_DIR"); reserve=$(( RESERVE_GB * GB ))
  say "$name $version: download $(human "$head_bytes"), extracted about $(human "$extract_bytes"), needs $(human "$need"); free $(human "$free"), reserve $(human "$reserve")"
  [ "$free" -gt $(( need + reserve )) ] || die "not enough free space for $name (the reserve is never used)"
  status >/dev/null
  [ $(( hub + need )) -le $(( EFFECTIVE_BUDGET_GB * GB )) ] || die "$name would exceed the Data Hub budget"
  free_pct=$(( $(fs_free "$DATA_DIR") * 100 / $(fs_total "$DATA_DIR") ))
  [ "$free_pct" -ge "$EMERGENCY_FREE_PCT" ] || die "disk is under the emergency threshold; downloads are stopped"

  # 2. one update of one dataset at a time
  # mkdir is atomic everywhere; a lock older than six hours is a crashed run and is taken over.
  lockdir="$DATA_DIR/tmp/.lock-$name.d"
  if [ -d "$lockdir" ] && [ -n "$(find "$lockdir" -maxdepth 0 -mmin +360 2>/dev/null)" ]; then rmdir "$lockdir" 2>/dev/null || true; fi
  mkdir "$lockdir" 2>/dev/null || die "another update of $name is running"

  work="$DATA_DIR/tmp/$name.$$"
  trap 'rm -rf "$work"; rmdir "$lockdir" 2>/dev/null || true' EXIT
  mkdir -p "$work/extract"

  # 3. download straight from the official source, streaming to disk
  say "downloading"
  curl -fsSL --proto '=https' --tlsv1.2 --max-time 3600 --max-filesize $(( need + 50 * MB )) -o "$work/payload" "$url" || die "download failed"
  actual=$(sha256sum "$work/payload" | cut -d' ' -f1 | tr -cd 'a-f0-9')
  if [ "$sha" != "-" ] && [ -n "$sha" ]; then
    [ "$actual" = "$sha" ] || die "checksum mismatch; the active version is unchanged"
    say "checksum verified"
  else
    say "no published checksum; recorded sha256 $actual"
  fi

  # Same bytes as the active version: nothing to switch, nothing to keep.
  if [ -f "$base/current/MANIFEST.json" ] && grep -q "\"sha256\": \"$actual\"" "$base/current/MANIFEST.json"; then
    say "unchanged: $name is already at this content; no new version"
    return 0
  fi

  # 4. extract, refusing any entry that could leave the directory
  if [ "$archive" = "auto" ]; then
    case "$url" in *.zip) archive=zip ;; *.tar.gz|*.tgz) archive=tar.gz ;; *.gz) archive=gz ;; *) archive=raw ;; esac
  fi
  case "$archive" in
    zip)
      # unzip when the box has it; Python's zipfile (which also drops absolute and ".." members) when it does not.
      if command -v unzip >/dev/null; then
        if unzip -Z1 "$work/payload" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then die "archive has an unsafe path; refused"; fi
        unzip -q -o "$work/payload" -d "$work/extract"
      else
        command -v python3 >/dev/null || die "neither unzip nor python3 is installed on the server"
        if python3 -c 'import sys,zipfile;print("\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))' "$work/payload" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then die "archive has an unsafe path; refused"; fi
        python3 -c 'import sys,zipfile;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])' "$work/payload" "$work/extract"
      fi ;;
    tar.gz)
      if tar -tzf "$work/payload" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then die "archive has an unsafe path; refused"; fi
      tar -xzf "$work/payload" -C "$work/extract" --no-same-owner --no-same-permissions ;;
    gz)  gunzip -c "$work/payload" > "$work/extract/$name" ;;
    raw) cp "$work/payload" "$work/extract/$name" ;;
    *)   die "unknown archive type" ;;
  esac
  # No links out, no executables.
  if find "$work/extract" \( -type l -o -perm /111 \) -print -quit | grep -q .; then
    find "$work/extract" -type l -delete
    find "$work/extract" -type f -exec chmod a-x {} +
  fi
  got=$(dir_bytes "$work/extract")
  [ "$got" -gt 0 ] || die "extracted nothing"
  [ "$got" -le $(( extract_bytes * 2 )) ] || die "extracted size is far above the declared size; refused"

  # 5. validate, then record, then switch
  if [ -n "${VALIDATE_NONEMPTY:-}" ]; then
    [ -e "$work/extract/$VALIDATE_NONEMPTY" ] || [ -n "$(find "$work/extract" -name "$VALIDATE_NONEMPTY" -print -quit)" ] || die "expected file $VALIDATE_NONEMPTY is missing; the active version is unchanged"
  fi
  dest="$base/versions/$version"
  [ ! -e "$dest" ] || rm -rf "$dest"
  mv "$work/extract" "$dest"
  cat > "$dest/MANIFEST.json" <<EOF
{ "dataset": "$name", "group": "$group", "version": "$version", "source_host": "$(echo "$url" | awk -F/ '{print $3}')", "sha256": "$actual",
  "payload_bytes": $(stat -c %s "$work/payload"), "extracted_bytes": $got, "installed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)" }
EOF
  ln -sfn "versions/$version" "$base/current.new"
  mv -T "$base/current.new" "$base/current"     # atomic: the pointer is never missing
  say "active: $name -> $version ($(human "$got"))"

  # 6. keep the previous known-good version, drop older ones
  ls -1dt "$base"/versions/*/ 2>/dev/null | tail -n +$(( KEEP_VERSIONS + 1 )) | while read -r old; do rm -rf "$old"; say "removed old version $(basename "$old")"; done
  status >/dev/null
}

# The list of datasets comes from the repository (GitHub = config); the workflow ships it base64 in DATASETS_CONF_B64.
sync_conf() {
  [ -n "${DATASETS_CONF_B64:-}" ] || return 0
  tmpc="$DATA_DIR/config/datasets.conf.new"
  printf '%s' "$DATASETS_CONF_B64" | base64 -d > "$tmpc" 2>/dev/null || { rm -f "$tmpc"; die "the dataset list could not be decoded"; }
  # Every non-comment line must have exactly six fields and an https source.
  line_ok='^[a-z0-9_-]+[|][a-z0-9_-]+[|]https://[^|[:space:]]+[|][0-9]+[|](zip|tar[.]gz|gz|raw|auto)[|][A-Za-z0-9._-]+$'
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in '' | '#'* | ' '*'#'*) continue ;; esac
    [[ "$line" =~ $line_ok ]] || { rm -f "$tmpc"; die "the dataset list has a malformed line; the previous list stays"; }
  done < "$tmpc"
  mv -f "$tmpc" "$DATA_DIR/config/datasets.conf"
  say "dataset list updated from the repository"
}

# ── update-all: what the scheduler runs, on the box that has the disk ──────────
update_all() {
  [ -d "$DATA_DIR" ] || die "$DATA_DIR does not exist (run init)"
  sync_conf
  conf="$DATA_DIR/config/datasets.conf"; [ -f "$conf" ] || die "no datasets.conf"
  log="$DATA_DIR/logs/update.log"
  [ -f "$log" ] && [ "$(stat -c %s "$log")" -gt $((5 * MB)) ] && : > "$log"
  version="$(date -u +%Y-%m-%d)"; ok=0; bad=0
  while IFS='|' read -r group name url mb archive validate; do
    case "$group" in '' | '#'*) continue ;; esac
    if out=$( ( DATASET_GROUP="$group" VALIDATE_NONEMPTY="$validate" install_dataset "$name" "$version" "$url" "-" "$mb" "${archive:-auto}" ) 2>&1 ); then
      printf '%s
' "$out" >> "$log"; ok=$((ok + 1)); say "ok   $name"
    else
      printf '%s
' "$out" >> "$log"; bad=$((bad + 1))
      say "FAIL $name (the previous version stays active): $(printf '%s' "$out" | tail -n 2 | tr '
' ' ' | cut -c1-240)"
    fi
  done < "$conf"
  status >/dev/null
  say "update finished: $ok ok, $bad failed"
  [ "$bad" -eq 0 ]
}

# Weekly, on this server: the update worker lives where the disk is. Supabase keeps metadata, not files.
schedule() {
  [ "$(id -u)" = 0 ] || die "schedule needs root"
  # The workflow installs the worker first (this script arrives on stdin, so it has no file of its own to copy).
  [ -x /usr/local/lib/visionex/datahub.sh ] || die "the update worker is not installed at /usr/local/lib/visionex/datahub.sh"
  /usr/local/lib/visionex/datahub.sh status >/dev/null || die "the installed worker does not run"
  cat > /etc/cron.d/visionex-datahub <<CRON
# Visionex Data Hub: update the local datasets (versioned, verified, atomic), then measure storage.
MAILTO=""
17 3 * * 0 root DATA_DIR=$DATA_DIR /usr/local/lib/visionex/datahub.sh update-all >/dev/null 2>&1
47 * * * * root DATA_DIR=$DATA_DIR /usr/local/lib/visionex/datahub.sh status >/dev/null 2>&1
CRON
  chmod 644 /etc/cron.d/visionex-datahub
  say "scheduled: weekly update (Sunday 03:17) and hourly storage measurement"
  cat /etc/cron.d/visionex-datahub | sed 's/^/   /'
}

cmd="${1:-}"; shift || true
case "$cmd" in
  inspect) inspect ;;
  init)    init ;;
  status)  status ;;
  install) install_dataset "$@" ;;
  update-all) update_all ;;
  schedule) schedule ;;
  *) die "usage: datahub.sh inspect|init|status|install|update-all|schedule" ;;
esac
