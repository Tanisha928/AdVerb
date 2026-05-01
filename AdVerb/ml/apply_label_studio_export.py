"""
Read a Label Studio export JSON and write label_studio_id back to metadata.yaml.
Also flags any tasks marked as wrong_category so you can fix the metadata manually.

Usage:
  python ml/apply_label_studio_export.py ml/label_studio_export.json
"""

import json
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent
METADATA_FILE = ROOT / "assets" / "metadata.yaml"


def main(export_path: str) -> None:
    with open(export_path, "r") as f:
        tasks = json.load(f)

    with open(METADATA_FILE, "r") as f:
        metadata = yaml.safe_load(f) or {}

    updated = 0
    reassign_needed: list[dict] = []

    for task in tasks:
        data = task.get("data", {})
        filename = data.get("filename", "")
        task_id = task.get("id")

        # Determine the metadata key from filename
        key = f"overlays/{filename}"
        if key not in metadata:
            print(f"[warn] {filename} not found in metadata.yaml — skipping")
            continue

        # Write label studio task ID back
        if task_id is not None:
            metadata[key]["label_studio_id"] = task_id
            updated += 1

        # Surface any items flagged for category reassignment
        annotations = task.get("annotations", [])
        for ann in annotations:
            for result in ann.get("result", []):
                if result.get("from_name") == "category_ok":
                    value = result.get("value", {}).get("choices", [])
                    if "no_reassign" in value:
                        notes = ""
                        for r2 in ann.get("result", []):
                            if r2.get("from_name") == "notes":
                                notes = r2.get("value", {}).get("text", [""])[0]
                        reassign_needed.append({
                            "key": key,
                            "current_category": metadata[key].get("category"),
                            "notes": notes,
                        })

    with open(METADATA_FILE, "w") as f:
        yaml.dump(metadata, f, default_flow_style=False, allow_unicode=True, sort_keys=True)

    print(f"Updated {updated} label_studio_id entries in metadata.yaml")

    if reassign_needed:
        print(f"\n[action required] {len(reassign_needed)} assets need category reassignment:")
        for item in reassign_needed:
            print(f"  {item['key']}  current={item['current_category']}  notes={item['notes']!r}")
        print("\nEdit metadata.yaml manually to fix categories, then re-run embed_assets.py.")
    else:
        print("No category reassignments needed.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python ml/apply_label_studio_export.py <export_file.json>")
    main(sys.argv[1])
