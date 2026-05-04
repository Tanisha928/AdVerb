"""
Precompute CLIP text embeddings for every (age_group, interest) combination.
At serving time the Go service does a lookup → pure dot products, zero model inference.

Outputs: decision-engine/query_embeddings.json
"""

import json
from pathlib import Path

import open_clip
import torch

MODEL_NAME = "ViT-B-32"
PRETRAINED = "openai"
OUTPUT = Path(__file__).parent.parent / "decision-engine" / "query_embeddings.json"

AGE_GROUPS = ["18-24", "25-34", "35-44", "45-54", "55+"]
INTERESTS = [
    "running", "weightlifting", "yoga", "cycling", "basketball",
    "soccer", "nutrition", "outdoor", "fashion", "tech", "wellness", "gaming",
]


def embed_queries() -> None:
    print(f"Loading CLIP {MODEL_NAME} ({PRETRAINED})...")
    model, _, _ = open_clip.create_model_and_transforms(MODEL_NAME, pretrained=PRETRAINED)
    tokenizer = open_clip.get_tokenizer(MODEL_NAME)
    model.eval()

    results = []
    total = len(AGE_GROUPS) * len(INTERESTS)
    print(f"Embedding {total} (age_group × interest) queries...\n")

    for age in AGE_GROUPS:
        for interest in INTERESTS:
            query = f"{age} person interested in {interest}"
            tokens = tokenizer([query])
            with torch.no_grad():
                emb = model.encode_text(tokens)
                emb = emb / emb.norm(dim=-1, keepdim=True)
            embedding = emb[0].tolist()
            results.append({
                "age_group": age,
                "interest":  interest,
                "query":     query,
                "embedding": embedding,
            })
            print(f"  {query}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(results, indent=2))
    print(f"\nDone. {len(results)} query embeddings -> {OUTPUT}")


if __name__ == "__main__":
    embed_queries()
