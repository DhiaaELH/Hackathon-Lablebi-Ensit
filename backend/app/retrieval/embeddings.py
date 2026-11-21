"""Embedding providers behind one interface.

- `hash` (default): deterministic, offline feature-hashing of character n-grams. Language-agnostic
  (works for French, Arabic script and Arabizi), no model download, but only lexical similarity.
- `fastembed`: real multilingual sentence embeddings (pip install fastembed), same 384 dims.
Hybrid retrieval (FTS + vectors, fused with RRF) compensates for the hash embedder's limits.
"""
import hashlib
import math
import re
import unicodedata
from functools import lru_cache

from ..config import get_settings

_AR_DIACRITICS = re.compile(r"[ً-ٰٟ]")


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFKC", text.lower())
    text = _AR_DIACRITICS.sub("", text)
    text = text.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه").replace("ى", "ي")
    return re.sub(r"\s+", " ", text)


class HashEmbedder:
    name = "hash-ngram-v1"

    def __init__(self, dim: int) -> None:
        self.dim = dim

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._one(t) for t in texts]

    def _one(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        t = _norm(text)
        feats = re.findall(r"\w+", t)
        grams = []
        for w in feats:
            grams.append("w:" + w)
            padded = f" {w} "
            for n in (3, 4):
                grams.extend(padded[i : i + n] for i in range(max(1, len(padded) - n + 1)))
        for g in grams:
            h = hashlib.blake2b(g.encode(), digest_size=8).digest()
            idx = int.from_bytes(h[:4], "little") % self.dim
            vec[idx] += 1.0 if h[4] & 1 else -1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]


class FastEmbedder:
    def __init__(self) -> None:
        from fastembed import TextEmbedding  # optional dependency

        self.name = "paraphrase-multilingual-MiniLM-L12-v2"
        self._model = TextEmbedding("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [list(map(float, v)) for v in self._model.embed(texts)]


@lru_cache
def get_embedder():
    s = get_settings()
    if s.embeddings_provider == "fastembed":
        return FastEmbedder()
    return HashEmbedder(s.embedding_dim)
