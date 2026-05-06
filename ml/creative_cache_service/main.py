"""
Distributed creative cache: FAISS index over user profile embeddings (CLIP query vectors),
Redis for serialized creative payloads (image URLs + metadata).

Similar users (high cosine similarity on normalized embeddings) reuse a stored creative
instead of regenerating layout/image URLs on each request.
"""

from __future__ import annotations

import json
import os
import time
import uuid
from typing import Any

import faiss
import numpy as np
import redis
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

DIM = 512

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
DATA_DIR = os.environ.get("DATA_DIR", ".")
THRESHOLD = float(os.environ.get("SIMILARITY_THRESHOLD", "0.88"))
TOP_K = int(os.environ.get("FAISS_TOP_K", "3"))
INDEX_PATH = os.path.join(DATA_DIR, "creative_faiss.index")
META_PATH = os.path.join(DATA_DIR, "creative_faiss_ids.json")

r = redis.Redis.from_url(REDIS_URL, decode_responses=True)
app = FastAPI(title="adverb FAISS Creative Cache", version="1.0.0")

index = faiss.IndexFlatIP(DIM)
id_list: list[str] = []


class LookupRequest(BaseModel):
    embedding: list[float] = Field(..., min_length=DIM, max_length=DIM)


class CreativePayload(BaseModel):
    logo_url: str
    background_url: str
    overlay_url: str
    template_slug: str | None = None
    brand: str | None = None


class StoreRequest(BaseModel):
    embedding: list[float] = Field(..., min_length=DIM, max_length=DIM)
    creative: CreativePayload


def _normalize(v: np.ndarray) -> np.ndarray:
    x = v.astype("float32", copy=False).reshape(1, -1)
    faiss.normalize_L2(x)
    return x


def _persist() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    faiss.write_index(index, INDEX_PATH)
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(id_list, f)


def _load_state() -> None:
    global index, id_list
    index = faiss.IndexFlatIP(DIM)
    id_list = []
    if os.path.isfile(INDEX_PATH) and os.path.isfile(META_PATH):
        index = faiss.read_index(INDEX_PATH)
        with open(META_PATH, encoding="utf-8") as f:
            id_list = json.load(f)
        if index.ntotal != len(id_list):
            raise RuntimeError("FAISS index size does not match id list")


@app.on_event("startup")
def _startup() -> None:
    # Compose may start Redis slightly after this container.
    deadline = time.perf_counter() + 30.0
    while time.perf_counter() < deadline:
        try:
            r.ping()
            break
        except Exception:
            time.sleep(0.3)
    else:
        raise RuntimeError("Redis unavailable for creative-cache service")
    _load_state()


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "index_vectors": int(index.ntotal), "dim": DIM}


@app.post("/v1/lookup")
def lookup(body: LookupRequest) -> dict[str, Any]:
    t0 = time.perf_counter()
    if len(body.embedding) != DIM:
        raise HTTPException(status_code=400, detail=f"embedding must have {DIM} dimensions")
    if index.ntotal == 0:
        return {
            "hit": False,
            "search_ms": round((time.perf_counter() - t0) * 1000, 2),
        }

    xq = _normalize(np.array(body.embedding, dtype=np.float32))
    k = min(TOP_K, index.ntotal)
    sims, inds = index.search(xq, k)
    search_ms = round((time.perf_counter() - t0) * 1000, 2)

    for j in range(k):
        sim = float(sims[0][j])
        if sim < THRESHOLD:
            break
        row = int(inds[0][j])
        if row < 0 or row >= len(id_list):
            continue
        uid = id_list[row]
        raw = r.get(f"creative:{uid}")
        if not raw:
            continue
        creative = json.loads(raw)
        return {
            "hit": True,
            "similarity": sim,
            "creative": creative,
            "neighbor_id": uid,
            "search_ms": search_ms,
        }

    best_sim = float(sims[0][0]) if k > 0 else 0.0
    return {
        "hit": False,
        "similarity": best_sim,
        "search_ms": search_ms,
    }


@app.post("/v1/store")
def store(body: StoreRequest) -> dict[str, Any]:
    if len(body.embedding) != DIM:
        raise HTTPException(status_code=400, detail=f"embedding must have {DIM} dimensions")
    uid = str(uuid.uuid4())
    xq = _normalize(np.array(body.embedding, dtype=np.float32))
    index.add(xq)
    id_list.append(uid)
    payload = body.creative.model_dump(exclude_none=True)
    r.set(f"creative:{uid}", json.dumps(payload))
    _persist()
    return {"id": uid, "index_size": int(index.ntotal)}
