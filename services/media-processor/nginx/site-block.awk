# Put one location block into an nginx site file, replacing any copy already
# there, and print the result.
#
#   awk -f site-block.awk block.conf site.conf > site.new
#
# ── Why this exists ─────────────────────────────────────────────────────────
#
# The first version of the deploy step inserted the block and then, on every
# later run, saw `internal/media` in the file and said "already present —
# nothing to do". That is idempotent by *absence*, not by content: a change to
# the block — a larger `client_max_body_size`, a longer `proxy_read_timeout` —
# was copied to the server, skipped, and reported as a success. The route kept
# whatever ceilings it was first deployed with, and nothing said so.
#
# ── Markers, and the one file that will not have them ───────────────────────
#
# What this writes is fenced between two sentinel comments, so a later run can
# find exactly what it wrote and replace precisely that. The block already on
# the server was written before the markers existed, so there is a second way
# in: a `location /internal/media/` line, the contiguous comment lines directly
# above it, and forward to its matching brace. That path runs once per server
# and then never again, because what replaces it is fenced.
#
# Braces are counted rather than matched by regex. A `#` comment containing a
# brace would throw the count off, so comment lines are excluded from it — which
# matters, because the block this manages is mostly comments.

BEGIN { marker_open = "# >>> visionex-media (managed by deploy-media-processor.yml) >>>" }
BEGIN { marker_close = "# <<< visionex-media <<<" }

# First file: the block to install.
FNR == NR { block[++n] = $0; next }

# Second file: the site, held whole. It is a few hundred lines.
{ line[++m] = $0 }

# The brace depth a line contributes, ignoring anything after a `#`.
function braces(text,   stripped) {
  stripped = text
  sub(/#.*$/, "", stripped)
  return gsub(/\{/, "{", stripped) - gsub(/\}/, "}", stripped)
}

END {
  # ── 1. Find a previous copy, fenced or legacy ─────────────────────────────
  remove_from = 0
  remove_to = 0

  for (i = 1; i <= m; i++) {
    if (index(line[i], marker_open) > 0) {
      remove_from = i
      for (j = i; j <= m; j++) if (index(line[j], marker_close) > 0) { remove_to = j; break }
      if (remove_to == 0) { print "UNCLOSED_MARKER" > "/dev/stderr"; exit 1 }
      break
    }
  }

  if (remove_from == 0) {
    for (i = 1; i <= m; i++) {
      if (line[i] !~ /location[ \t]+\/internal\/media\//) continue

      # Walk back over the comment lines that were inserted with it, so a
      # second run does not leave the old commentary orphaned above the new
      # block. A blank line ends the walk: the comments belong to the block
      # only if they are contiguous with it.
      remove_from = i
      for (j = i - 1; j >= 1; j--) {
        if (line[j] ~ /^[ \t]*#/) remove_from = j
        else break
      }

      depth = 0
      for (j = i; j <= m; j++) {
        depth += braces(line[j])
        if (depth <= 0 && j > i) { remove_to = j; break }
        if (depth <= 0 && j == i && line[j] ~ /\}/) { remove_to = j; break }
      }
      if (remove_to == 0) { print "NO_CLOSING_BRACE_FOR_EXISTING" > "/dev/stderr"; exit 1 }
      break
    }
  }

  # ── 2. Decide where the new copy goes ────────────────────────────────────
  #
  # Where the old one was, if there was one — keeping it in the same server
  # block it was already serving from. Otherwise just inside the closing brace
  # of the block that listens on 443, which is the one terminating TLS.
  if (remove_from > 0) {
    insert_before = remove_from
  } else {
    start = 0
    for (i = 1; i <= m; i++)
      if (line[i] ~ /listen[ \t]+(\[::\]:)?443/) { start = i; break }
    if (start == 0) { print "NO_443_BLOCK" > "/dev/stderr"; exit 1 }

    # Depth starts at 1, not 0. The `listen` line is *inside* the server block,
    # so its opening brace is already behind us and counting from zero makes the
    # very next line look like the end of the block — which put the whole thing
    # directly under `listen 443` on a fresh site, where nginx would have
    # accepted it and served it from the wrong scope.
    depth = 1
    insert_before = 0
    for (i = start; i <= m; i++) {
      depth += braces(line[i])
      if (depth <= 0) { insert_before = i; break }
    }
    if (insert_before == 0) { print "NO_CLOSING_BRACE" > "/dev/stderr"; exit 1 }
  }

  # ── 3. Write it out ──────────────────────────────────────────────────────
  for (i = 1; i <= m; i++) {
    if (i == insert_before) {
      print "    " marker_open
      for (j = 1; j <= n; j++) print (block[j] == "" ? "" : "    " block[j])
      print "    " marker_close
    }
    if (remove_from > 0 && i >= remove_from && i <= remove_to) continue
    print line[i]
  }
}
