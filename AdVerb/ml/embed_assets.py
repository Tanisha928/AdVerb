"""
Embed all product overlay and background images with CLIP.
Reads metadata from assets/metadata.yaml for category, brand_hint, and tags.
Outputs: decision-engine/asset_index.json

Usage:
  python embed_assets.py               # full rebuild
  python embed_assets.py --incremental # skip already-embedded files
"""

import json
import sys
from pathlib import Path

import open_clip
import torch
import yaml
from PIL import Image

MODEL_NAME = "ViT-B-32"
PRETRAINED = "openai"
ROOT = Path(__file__).parent.parent
ASSET_DIRS = {
    "overlay":    ROOT / "assets" / "overlays",
    "background": ROOT / "assets" / "backgrounds",
}
METADATA_FILE = ROOT / "assets" / "metadata.yaml"
OUTPUT = ROOT / "decision-engine" / "asset_index.json"
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def load_metadata() -> dict:
    if not METADATA_FILE.exists():
        print(f"Warning: {METADATA_FILE} not found — metadata fields will be empty")
        return {}
    with open(METADATA_FILE, "r") as f:
        data = yaml.safe_load(f) or {}
    return {k: v for k, v in data.items() if isinstance(v, dict)}


def load_existing() -> dict:
    if OUTPUT.exists():
        return {e["key"]: e for e in json.loads(OUTPUT.read_text())}
    return {}


def embed_assets(incremental: bool = False) -> None:
    print(f"Loading CLIP {MODEL_NAME} ({PRETRAINED})...")
    model, _, preprocess = open_clip.create_model_and_transforms(MODEL_NAME, pretrained=PRETRAINED)
    model.eval()

    metadata = load_metadata()
    existing = load_existing() if incremental else {}
    results: list[dict] = list(existing.values())
    added = 0

    for asset_type, folder in ASSET_DIRS.items():
        if not folder.exists():
            print(f"Skipping {folder} (directory not found)")
            continue
        images = sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_EXTS)
        print(f"\n{asset_type}s: {len(images)} images in {folder}")
        for img_path in images:
            key = f"{asset_type}s/{img_path.name}"
            if incremental and key in existing:
                print(f"  skip (cached): {img_path.name}")
                continue

            meta = metadata.get(key, {})
            img = preprocess(Image.open(img_path).convert("RGB")).unsqueeze(0)
            with torch.no_grad():
                emb = model.encode_image(img)
                emb = emb / emb.norm(dim=-1, keepdim=True)
            embedding = emb[0].tolist()

            entry = {
                "key": key,
                "type": asset_type,
                "category": meta.get("category", ""),
                "brand_hint": meta.get("brand_hint") or "",
                "tags": meta.get("tags") or [],
                "label_studio_id": meta.get("label_studio_id"),
                "embedding": embedding,
            }
            results.append(entry)
            print(f"  embedded: {img_path.name}  ({len(embedding)}-dim)  category={entry['category']}  tags={entry['tags']}")
            added += 1

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(results, indent=2))
    print(f"\nDone. {added} new embeddings. Total: {len(results)} entries -> {OUTPUT}")


if __name__ == "__main__":
    embed_assets(incremental="--incremental" in sys.argv)
