"""
Extract product zip files from assets/overlays/, rename to semantic names,
and append entries to assets/metadata.yaml.

Run this once after adding new zip files to assets/overlays/.
Zips are left in place so they can be re-extracted if needed.

Then run:
  python ml/embed_assets.py --incremental
  python ml/upload_assets.py

Usage:
  python ml/organize_assets.py
  python ml/organize_assets.py --dry-run
"""

import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent
OVERLAYS_DIR = ROOT / "assets" / "overlays"
METADATA_FILE = ROOT / "assets" / "metadata.yaml"
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}

# Map each zip filename → category metadata.
# tags must be from the interest labels defined in recommend.go:
#   running, weightlifting, yoga, cycling, basketball, soccer,
#   nutrition, outdoor, fashion, tech, wellness, gaming
# NOTE: handbag and earring use category "fashion" — no catalog template exists yet.
#   Add a catalog entry in templates/catalog.json before these will be served.
ZIP_CONFIG: dict[str, dict] = {
    "running-shoesZ.zip": {
        "category": "shoes",
        "prefix": "shoes-running",
        "brand_hint": "generic",
        "tags": ["running", "outdoor", "sport"],
    },
    "watchZ.zip": {
        "category": "wearable",
        "prefix": "wearable-watch",
        "brand_hint": "generic",
        "tags": ["wellness", "tech", "fitness"],
    },
    "shirtZ.zip": {
        "category": "apparel",
        "prefix": "apparel-shirt",
        "brand_hint": "generic",
        "tags": ["weightlifting", "running", "fashion"],
    },
    "handbagZ.zip": {
        "category": "fashion",
        "prefix": "fashion-handbag",
        "brand_hint": "generic",
        "tags": ["fashion", "wellness"],
    },
    "earringZ.zip": {
        "category": "fashion",
        "prefix": "fashion-earring",
        "brand_hint": "generic",
        "tags": ["fashion", "wellness"],
    },
}


def load_metadata() -> dict:
    if not METADATA_FILE.exists():
        return {}
    with open(METADATA_FILE, "r") as f:
        return yaml.safe_load(f) or {}


def next_index(metadata: dict, prefix: str) -> int:
    """Return the next available N for files named {prefix}-NN.png already in metadata."""
    existing = [
        k for k in metadata
        if k.startswith(f"overlays/{prefix}-") and k.endswith((".png", ".jpg", ".jpeg", ".webp"))
    ]
    if not existing:
        return 1
    indices = []
    for k in existing:
        stem = Path(k).stem  # e.g. "shoes-running-03"
        parts = stem.rsplit("-", 1)
        if len(parts) == 2 and parts[1].isdigit():
            indices.append(int(parts[1]))
    return max(indices, default=0) + 1


def extract_images(zip_path: Path, tmp_dir: Path) -> list[Path]:
    """Extract all image files from a zip, return their paths sorted."""
    with zipfile.ZipFile(zip_path, "r") as zf:
        names = [
            n for n in zf.namelist()
            if not n.startswith("__MACOSX")
            and Path(n).suffix.lower() in IMAGE_EXTS
            and not Path(n).name.startswith(".")
        ]
        zf.extractall(tmp_dir, members=names)
    return sorted(tmp_dir / n for n in names)


def main(dry_run: bool = False) -> None:
    metadata = load_metadata()
    new_entries: dict = {}

    for zip_name, config in ZIP_CONFIG.items():
        zip_path = OVERLAYS_DIR / zip_name
        if not zip_path.exists():
            print(f"[skip] {zip_name} not found in overlays/")
            continue

        prefix = config["prefix"]
        idx = next_index(metadata, prefix)

        with tempfile.TemporaryDirectory() as tmp:
            images = extract_images(zip_path, Path(tmp))
            if not images:
                print(f"[warn] {zip_name}: no image files found inside")
                continue

            print(f"\n{zip_name} → category={config['category']}  ({len(images)} images)")

            for img_path in images:
                ext = img_path.suffix.lower()
                new_name = f"{prefix}-{idx:02d}{ext}"
                dst = OVERLAYS_DIR / new_name
                yaml_key = f"overlays/{new_name}"

                if dst.exists() or yaml_key in metadata:
                    print(f"  [skip] {new_name} already exists")
                    idx += 1
                    continue

                if not dry_run:
                    # Copy while the temp dir is still alive
                    shutil.copy2(img_path, dst)

                new_entries[yaml_key] = {
                    "category": config["category"],
                    "brand_hint": config["brand_hint"],
                    "tags": config["tags"],
                    "label_studio_id": None,
                }
                print(f"  {'(dry) ' if dry_run else ''}extract → {new_name}")
                idx += 1

    if not new_entries:
        print("\nNothing to do.")
        return

    if dry_run:
        print(f"\n[dry-run] Would add {len(new_entries)} files and {len(new_entries)} metadata entries.")
        return

    # Append new entries to metadata.yaml as plain text blocks,
    # preserving the existing file content (comments, formatting).
    with open(METADATA_FILE, "a") as f:
        for yaml_key, meta in new_entries.items():
            block = yaml.dump(
                {yaml_key: meta},
                default_flow_style=False,
                allow_unicode=True,
            )
            f.write("\n" + block)

    print(f"\nDone. Added {len(new_entries)} assets to overlays/ and metadata.yaml.")
    print("\nNext steps:")
    print("  python ml/embed_assets.py --incremental")
    print("  python ml/upload_assets.py")
    print("  python ml/gen_label_studio_tasks.py")

    new_fashion = [k for k in new_entries if new_entries[k]["category"] == "fashion"]
    if new_fashion:
        print(
            f"\n[note] {len(new_fashion)} assets have category='fashion' which has no catalog template yet.\n"
            "  Add an entry to templates/catalog.json with category='fashion' before these will be served."
        )


if __name__ == "__main__":
    main(dry_run="--dry-run" in sys.argv)
