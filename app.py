"""
app.py  —  Folio: Book Reviews & Recommendations
Flask entry-point: routes, SQLite review storage, REST API
"""

import os, json, sqlite3
from datetime import datetime
from flask import Flask, render_template, request, jsonify, redirect, url_for

# ── project paths ────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(__file__)
MODEL_DIR  = os.path.join(BASE_DIR, "model")
DB_PATH    = os.path.join(BASE_DIR, "reviews.db")

# ── add model/ to sys.path so we can import predict ──────────────────────────
import sys
sys.path.insert(0, MODEL_DIR)

app = Flask(__name__)

# DATABASE  (SQLite — no external server needed)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables if they don't exist."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS reviews (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                isbn      TEXT    NOT NULL,
                name      TEXT    NOT NULL DEFAULT 'Anonymous',
                stars     INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),
                comment   TEXT    NOT NULL,
                created   TEXT    NOT NULL
            )
        """)
        conn.commit()


def get_stats(isbn: str) -> dict:
    with get_db() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS cnt, AVG(stars) AS avg FROM reviews WHERE isbn=?",
            (isbn,)
        ).fetchone()
    count = row["cnt"] or 0
    avg   = round(row["avg"], 1) if row["avg"] else 0.0
    return {"count": count, "avg": avg}


# PREDICT HELPERS  (lazy-loads model)

def _try_import():
    try:
        import predict
        return predict
    except Exception:
        return None


# ROUTES

@app.route("/")
def index():
    """Home — show 20 trending books."""
    predict = _try_import()
    books   = predict.get_popular_books(20) if predict else []
    # attach rating stats to each book
    for b in books:
        b["stats"] = get_stats(b["isbn"])
    return render_template("index.html", page="home", books=books)


@app.route("/search")
def search():
    """Full-page search results."""
    q       = request.args.get("q", "").strip()
    predict = _try_import()
    books   = predict.search_books(q, limit=24) if (predict and q) else []
    for b in books:
        b["stats"] = get_stats(b["isbn"])
    return render_template("index.html", page="search", query=q, books=books)


@app.route("/book/<isbn>")
def book_detail(isbn):
    """Book detail page with recommendations and reviews."""
    predict = _try_import()
    if not predict:
        return render_template("index.html", page="setup")

    book = predict.get_book_by_isbn(isbn)
    if not book:
        return redirect(url_for("index"))

    recs = predict.get_recommendations(isbn, n=8)
    for r in recs:
        r["stats"] = get_stats(r["isbn"])

    book["stats"] = get_stats(isbn)

    # fetch reviews from SQLite
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM reviews WHERE isbn=? ORDER BY id DESC", (isbn,)
        ).fetchall()
    reviews = [dict(r) for r in rows]

    return render_template(
        "index.html",
        page="detail",
        book=book,
        recommendations=recs,
        reviews=reviews,
    )

# <---API--->

@app.route("/api/search")
def api_search():
    q       = request.args.get("q", "").strip()
    predict = _try_import()
    books   = predict.search_books(q, limit=8) if (predict and q) else []
    for b in books:
        b["stats"] = get_stats(b["isbn"])
    return jsonify(books)


@app.route("/api/recommend/<isbn>")
def api_recommend(isbn):
    predict = _try_import()
    recs    = predict.get_recommendations(isbn) if predict else []
    for r in recs:
        r["stats"] = get_stats(r["isbn"])
    return jsonify(recs)


@app.route("/api/popular")
def api_popular():
    predict = _try_import()
    books   = predict.get_popular_books(20) if predict else []
    for b in books:
        b["stats"] = get_stats(b["isbn"])
    return jsonify(books)


@app.route("/api/reviews/<isbn>")
def api_reviews(isbn):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM reviews WHERE isbn=? ORDER BY id DESC", (isbn,)
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/review", methods=["POST"])
def api_review():
    """Submit a review — validates input, stores in SQLite."""
    data    = request.get_json(silent=True) or {}
    isbn    = str(data.get("isbn",    "")).strip()
    name    = str(data.get("name",    "Anonymous")).strip() or "Anonymous"
    comment = str(data.get("comment", "")).strip()

    # ── server-side validation ───────────────────────────────────────────
    errors = []
    try:
        stars = int(data.get("stars", 0))
        assert 1 <= stars <= 5
    except Exception:
        errors.append("Stars must be an integer between 1 and 5.")

    if not isbn:
        errors.append("ISBN is required.")
    if len(comment) < 5:
        errors.append("Comment must be at least 5 characters.")
    if len(name) > 80:
        errors.append("Name is too long (max 80 chars).")

    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    created = datetime.now().strftime("%b %d, %Y")

    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO reviews (isbn, name, stars, comment, created) VALUES (?,?,?,?,?)",
            (isbn, name, stars, comment, created),
        )
        conn.commit()
        review_id = cur.lastrowid

    stats = get_stats(isbn)
    return jsonify({
        "ok": True,
        "review": {
            "id":      review_id,
            "isbn":    isbn,
            "name":    name,
            "stars":   stars,
            "comment": comment,
            "created": created,
        },
        "stats": stats,
    })

if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)