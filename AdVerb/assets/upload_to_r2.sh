#!/usr/bin/env bash
set -euo pipefail

BUCKET="${1:-adverb-assets}"

for dir in logos backgrounds overlays; do
  if [ -d "$dir" ]; then
    for file in "$dir"/*; do
      [ -f "$file" ] || continue
      key="$dir/$(basename "$file")"
      echo "Uploading $file -> $key"
      wrangler r2 object put "${BUCKET}/${key}" --file "$file"
    done
  fi
done

echo "Upload completed."
