"""
Filter out non-product images from the asset catalog using CLIP similarity scoring.

For each overlay asset, computes cosine similarity against:
  - GOOD prompts (product-specific for its category)
  - BAD prompts (animals, people, landscapes, abstract)

Assets where the top bad-prompt score exceeds the top good-prompt score,
OR where the best good-prompt score falls below MIN_QUALITY_THRESHOLD,
are removed from asset_index.json, metadata.yaml, and optionally Supabase Storage.

Usage:
  python ml/filter_bad_assets.py               # dry run (shows what would be removed)
  python ml/filter_bad_assets.py --apply        # remove from asset_index.json + metadata.yaml
  python ml/filter_bad_assets.py --apply --delete-supabase  # also delete from Supabase

Requirements: open-clip-torch, torch, pyyaml, supabase, python-dotenv
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
import torch
import open_clip
import yaml
from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
ASSET_INDEX = ROOT / "decision-engine" / "asset_index.json"
METADATA_FILE = ROOT / "assets" / "metadata.yaml"

load_dotenv(ROOT / ".env")

MIN_QUALITY_THRESHOLD = 0.18   # min cosine similarity to any good prompt to keep an asset

GOOD_PROMPTS: dict[str, list[str]] = {
    "shoes": [
        "a running shoe product photo on white background",
        "athletic sneaker product image",
        "sports footwear product shot",
        "shoe isolated on white background",
    ],
    "apparel": [
        "a gym shirt product photo on white background",
        "athletic clothing product image",
        "sports t-shirt isolated",
        "workout apparel product shot",
    ],
    "wearable": [
        "a smartwatch product photo on white background",
        "fitness wristwatch isolated on white",
        "digital watch product image",
        "wearable fitness tracker product shot",
    ],
    "fashion": [
        "a handbag product photo on white background",
        "fashion jewelry earrings product image",
        "designer accessory isolated on white",
        "luxury fashion item product shot",
    ],
}

BAD_PROMPTS = [
    "an eagle bird in flight",
    "a wild animal in nature",
    "a person standing outdoors",
    "a landscape or scenery photo",
    "a portrait of a man or woman",
    "abstract art or colorful shapes",
    "a building or architecture",
    "food or drink product",
    "a cat or dog",
    "cartoon or illustration",
]


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    a = a / (np.linalg.norm(a) + 1e-8)
    b = b / (np.linalg.norm(b) + 1e-8)
    return float(np.dot(a, b))


def encode_texts(model, tokenizer, texts: list[str], device: str) -> np.ndarray:
    tokens = tokenizer(texts).to(device)
    with torch.no_grad():
        feats = model.encode_text(tokens)
        feats = feats / feats.norm(dim=-1, keepdim=True)
    return feats.cpu().numpy()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Write changes (default: dry run)")
    parser.add_argument("--delete-supabase", action="store_true", help="Also delete from Supabase Storage")
    parser.add_argument("--threshold", type=float, default=MIN_QUALITY_THRESHOLD)
    args = parser.parse_args()

    print("Loading CLIP model (ViT-B-32)…")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model, _, _ = open_clip.create_model_and_transforms("ViT-B-32", pretrained="openai")
    model = model.to(device).eval()
    tokenizer = open_clip.get_tokenizer("ViT-B-32")

    print("Encoding bad prompts…")
    bad_embs = encode_texts(model, tokenizer, BAD_PROMPTS, device)  # (n_bad, 512)

    print("Encoding good prompts per category…")
    good_embs: dict[str, np.ndarray] = {}
    for cat, prompts in GOOD_PROMPTS.items():
        good_embs[cat] = encode_texts(model, tokenizer, prompts, device)  # (n_good, 512)

    print("Loading asset index…")
    assets: list[dict] = json.loads(ASSET_INDEX.read_text())
    overlays = [a for a in assets if a.get("type") == "overlay"]

    bad_keys: list[str] = []
    print(f"\nScoring {len(overlays)} overlays…\n")

    for asset in overlays:
        emb = np.array(asset["embedding"], dtype=np.float32)
        cat = asset.get("category", "")
        key = asset["key"]

        good_scores = [cosine(emb, g) for g in good_embs.get(cat, [])]
        bad_scores = [cosine(emb, b) for b in bad_embs]

        best_good = max(good_scores) if good_scores else 0.0
        best_bad = max(bad_scores)

        is_bad = (best_bad > best_good) or (best_good < args.threshold)

        if is_bad:
            bad_keys.append(key)
            print(f"  REMOVE  {key}")
            print(f"          good={best_good:.3f}  bad={best_bad:.3f}  cat={cat}")

    print(f"\n{'─'*60}")
    print(f"Total assets: {len(overlays)}")
    print(f"Flagged for removal: {len(bad_keys)}")
    print(f"Remaining: {len(overlays) - len(bad_keys)}")

    if not bad_keys:
        print("\nNothing to remove.")
        return

    if not args.apply:
        print("\n[dry run] Pass --apply to actually remove these assets.")
        return

    bad_set = set(bad_keys)

    # Remove from asset_index.json
    kept = [a for a in assets if a["key"] not in bad_set]
    ASSET_INDEX.write_text(json.dumps(kept, indent=2, ensure_ascii=False))
    print(f"\nUpdated asset_index.json: {len(assets)} → {len(kept)} entries")

    # Remove from metadata.yaml
    with open(METADATA_FILE, "r", encoding="utf-8") as f:
        metadata = yaml.safe_load(f) or {}
    for k in bad_keys:
        metadata.pop(k, None)
    with open(METADATA_FILE, "w", encoding="utf-8") as f:
        yaml.dump(metadata, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    print(f"Updated metadata.yaml: removed {len(bad_keys)} entries")

    # Optionally delete from Supabase Storage
    if args.delete_supabase:
        try:
            from supabase import create_client
            url = os.environ["SUPABASE_URL"]
            key = os.environ["SUPABASE_SERVICE_KEY"]
            sb = create_client(url, key)
            bucket = "adverb-assets"
            deleted = 0
            for k in bad_keys:
                try:
                    sb.storage.from_(bucket).remove([k])
                    deleted += 1
                except Exception as e:
                    print(f"  [warn] Could not delete {k}: {e}")
            print(f"Deleted {deleted}/{len(bad_keys)} files from Supabase bucket '{bucket}'")
        except Exception as e:
            print(f"[error] Supabase deletion failed: {e}")

    print("\nDone. Restart the decision engine to reload the updated asset index.")


if __name__ == "__main__":
    main()
