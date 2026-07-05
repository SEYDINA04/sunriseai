#!/usr/bin/env bash
# Installs every skill listed in skills.txt into .claude/skills/.
# Safe to re-run (idempotent): each skill folder is replaced cleanly.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"   # -> .claude/skills
MANIFEST="$SCRIPT_DIR/skills.txt"

[[ -f "$MANIFEST" ]] || { echo "error: manifest not found: $MANIFEST" >&2; exit 1; }
command -v git >/dev/null || { echo "error: git is required" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
declare -A CLONED
count=0

trim() { local s="$1"; s="${s#"${s%%[![:space:]]*}"}"; s="${s%"${s##*[![:space:]]}"}"; printf '%s' "$s"; }

while IFS= read -r raw || [[ -n "$raw" ]]; do
  line="$(trim "${raw%%#*}")"            # strip comments + surrounding whitespace
  [[ -z "$line" ]] && continue

  reporef="${line%% *}"                  # owner/repo[@ref]
  path="$(trim "${line#* }")"            # path/inside/repo
  repo="${reporef%@*}"
  ref="main"; [[ "$reporef" == *@* ]] && ref="${reporef#*@}"
  key="${repo}@${ref}"
  name="$(basename "$path")"
  dest="$SKILLS_DIR/$name"

  if [[ -z "${CLONED[$key]:-}" ]]; then
    clone="$TMP/${key//[\/@]/_}"
    echo "Cloning ${repo}@${ref} ..."
    git clone --depth 1 --branch "$ref" "https://github.com/${repo}.git" "$clone" >/dev/null 2>&1 \
      || git clone --depth 1 "https://github.com/${repo}.git" "$clone" >/dev/null 2>&1 \
      || { echo "  error: failed to clone ${repo}" >&2; continue; }
    CLONED[$key]="$clone"
  fi

  src="${CLONED[$key]}/$path"
  [[ -d "$src" ]] || { echo "  warn: '$path' not found in ${repo}@${ref}, skipping" >&2; continue; }

  rm -rf "$dest"
  cp -R "$src" "$dest"
  echo "  installed: $name"
  count=$((count + 1))
done < "$MANIFEST"

echo "Done $count skill(s) installed into $SKILLS_DIR"
