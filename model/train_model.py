"""
train_model.py  — Book Recommendation Model (Collaborative Filtering)

Dataset: Books dataset from Kaggle
  https://www.kaggle.com/datasets/arashnic/book-recommendation-dataset

Download the 3 CSV files (Books.csv, Users.csv, Ratings.csv) and place them
in the model/ folder, then run:
    python model/train_model.py

This will create model/model.pkl used by the Flask app.
"""

import pandas as pd
import numpy as np
from scipy.sparse import csr_matrix
from sklearn.neighbors import NearestNeighbors
import pickle
import os

DATA_DIR = os.path.dirname(__file__)

def load_data():
    books   = pd.read_csv(os.path.join(DATA_DIR, "Books.csv"),   low_memory=False)
    ratings = pd.read_csv(os.path.join(DATA_DIR, "Ratings.csv"), low_memory=False)
    return books, ratings

def build_model(books, ratings):
    # ── filter for active users and popular books ──────────────────────────
    user_counts = ratings["User-ID"].value_counts()
    active_users = user_counts[user_counts >= 50].index
    ratings_filtered = ratings[ratings["User-ID"].isin(active_users)]

    book_counts = ratings_filtered["ISBN"].value_counts()
    popular_books = book_counts[book_counts >= 20].index
    ratings_filtered = ratings_filtered[ratings_filtered["ISBN"].isin(popular_books)]

    # ── keep only books that exist in the Books table ─────────────────────
    ratings_filtered = ratings_filtered[ratings_filtered["ISBN"].isin(books["ISBN"])]

    # ── pivot: rows = books, cols = users ─────────────────────────────────
    pivot = ratings_filtered.pivot_table(
        index="ISBN", columns="User-ID", values="Book-Rating"
    ).fillna(0)

    sparse_matrix = csr_matrix(pivot.values)

    # ── KNN model ─────────────────────────────────────────────────────────
    model = NearestNeighbors(metric="cosine", algorithm="brute", n_neighbors=11, n_jobs=-1)
    model.fit(sparse_matrix)

    # ── book metadata dict: isbn → {title, author, year, image_url} ───────
    books_clean = books[["ISBN","Book-Title","Book-Author",
                          "Year-Of-Publication","Image-URL-M"]].copy()
    books_clean.columns = ["isbn","title","author","year","image"]
    books_clean = books_clean.drop_duplicates("isbn").set_index("isbn")
    books_meta  = books_clean.to_dict("index")

    # ── map pivot-row-index → isbn ────────────────────────────────────────
    isbn_list = list(pivot.index)

    payload = {
        "model":      model,
        "pivot":      pivot,
        "sparse":     sparse_matrix,
        "isbn_list":  isbn_list,
        "books_meta": books_meta,
    }

    out_path = os.path.join(DATA_DIR, "model.pkl")
    with open(out_path, "wb") as f:
        pickle.dump(payload, f)

    print(f"✅  Model saved → {out_path}")
    print(f"    Books in pivot : {len(isbn_list):,}")
    return payload

if __name__ == "__main__":
    print("Loading data …")
    books, ratings = load_data()
    print(f"  Books   : {len(books):,}")
    print(f"  Ratings : {len(ratings):,}")
    print("Training model …")
    build_model(books, ratings)
