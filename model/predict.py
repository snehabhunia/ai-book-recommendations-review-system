import pickle, os, re
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")

_cache = {}

def _load():
    if "payload" not in _cache:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                "model.pkl not found. Run  python model/train_model.py  first."
            )
        with open(MODEL_PATH, "rb") as f:
            _cache["payload"] = pickle.load(f)
    return _cache["payload"]


def get_recommendations(isbn: str, n: int = 8):
    """Return n similar books for the given ISBN."""
    p = _load()
    if isbn not in p["isbn_list"]:
        return []

    idx = p["isbn_list"].index(isbn)
    distances, indices = p["model"].kneighbors(
        p["sparse"][idx], n_neighbors=n + 1
    )

    results = []
    for dist, i in zip(distances.flatten()[1:], indices.flatten()[1:]):
        rec_isbn = p["isbn_list"][i]
        meta = p["books_meta"].get(rec_isbn, {})
        results.append({
            "isbn":   rec_isbn,
            "title":  meta.get("title",  "Unknown Title"),
            "author": meta.get("author", "Unknown Author"),
            "year":   meta.get("year",   ""),
            "image":  meta.get("image",  ""),
            "score":  round(float(1 - dist), 3),
        })
    return results


def search_books(query: str, limit: int = 12):
    """Case-insensitive title / author search."""
    p   = _load()
    q   = query.lower().strip()
    hits = []
    for isbn, meta in p["books_meta"].items():
        title  = meta.get("title",  "").lower()
        author = meta.get("author", "").lower()
        if q in title or q in author:
            hits.append({
                "isbn":   isbn,
                "title":  meta.get("title",  "Unknown Title"),
                "author": meta.get("author", "Unknown Author"),
                "year":   meta.get("year",   ""),
                "image":  meta.get("image",  ""),
            })
        if len(hits) >= limit:
            break
    return hits


def get_popular_books(n: int = 20):
    """Return n books with the highest number of ratings (proxy for popularity)."""
    p = _load()
    # pivot rows are ISBNs; sum of non-zero = rating count
    counts = (p["pivot"] != 0).sum(axis=1)
    top_idx = np.argsort(counts.values)[::-1][:n]
    results = []
    for i in top_idx:
        isbn = p["isbn_list"][i]
        meta = p["books_meta"].get(isbn, {})
        results.append({
            "isbn":   isbn,
            "title":  meta.get("title",  "Unknown Title"),
            "author": meta.get("author", "Unknown Author"),
            "year":   meta.get("year",   ""),
            "image":  meta.get("image",  ""),
        })
    return results


def get_book_by_isbn(isbn: str):
    p    = _load()
    meta = p["books_meta"].get(isbn)
    if meta is None:
        return None
    return {
        "isbn":   isbn,
        "title":  meta.get("title",  "Unknown Title"),
        "author": meta.get("author", "Unknown Author"),
        "year":   meta.get("year",   ""),
        "image":  meta.get("image",  ""),
    }