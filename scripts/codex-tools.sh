#!/usr/bin/env bash

# Source this file in Codex/Work shells before using npm or GitHub CLI:
#   source scripts/codex-tools.sh

export NPM_CONFIG_CACHE="/tmp/visionex-npm-cache"
mkdir -p "$NPM_CONFIG_CACHE"

if ! command -v gh >/dev/null 2>&1; then
  visionex_gh_version="2.97.0"
  visionex_tools_root="/workspace/tools"
  visionex_gh_root="$visionex_tools_root/gh-$visionex_gh_version"
  visionex_gh_archive="/tmp/gh_${visionex_gh_version}_linux_amd64.tar.gz"
  visionex_gh_checksum="a2c9b8497e1f85b1ad0dfcb78b5a622e098801b8e461e459e88e1ee12f018112"

  if [[ ! -x "$visionex_gh_root/bin/gh" ]]; then
    mkdir -p "$visionex_gh_root" "$visionex_tools_root/bin"
    curl -fsSL \
      "https://github.com/cli/cli/releases/download/v${visionex_gh_version}/gh_${visionex_gh_version}_linux_amd64.tar.gz" \
      -o "$visionex_gh_archive"
    printf '%s  %s\n' "$visionex_gh_checksum" "$visionex_gh_archive" | sha256sum --check --status
    tar --no-same-owner -xzf "$visionex_gh_archive" -C "$visionex_gh_root" --strip-components=1
  fi

  mkdir -p "$visionex_tools_root/bin"
  ln -sfn "$visionex_gh_root/bin/gh" "$visionex_tools_root/bin/gh"
  export PATH="$visionex_tools_root/bin:$PATH"
fi

unset visionex_gh_version visionex_tools_root visionex_gh_root visionex_gh_archive visionex_gh_checksum
