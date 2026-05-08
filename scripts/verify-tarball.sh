#!/usr/bin/env bash
# Verify the publishable npm tarball ships every runtime file required by the
# OpenClaw plugin loader. Run AFTER `npm run build`. Used by CI and release
# workflows so both gates assert the same set of files.
set -euo pipefail

REQUIRED_FILES=(
  dist/index.js
  dist/provider-discovery.js
  dist/templates/agents-md-block.tmpl
  dist/templates/ilmu-configuration.skill.md.tmpl
  dist/templates/openclaw-configuration.skill.md.tmpl
)

PACK_LIST=$(npm pack --dry-run --json)

missing=0
for required in "${REQUIRED_FILES[@]}"; do
  if ! echo "$PACK_LIST" | jq -e --arg f "$required" '.[0].files[] | select(.path == $f)' >/dev/null; then
    echo "::error::publishable tarball is missing $required"
    missing=1
  fi
done

if [ "$missing" -ne 0 ]; then
  echo "Tarball file list:"
  echo "$PACK_LIST" | jq -r '.[0].files[].path'
  exit 1
fi

echo "All ${#REQUIRED_FILES[@]} required runtime files present in tarball."
