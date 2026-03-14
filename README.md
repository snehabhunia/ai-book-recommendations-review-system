# 📚 Folio — Book Reviews & Recommendations

A full-stack web application for book discovery, AI-powered recommendations, and community reviews.  
Built with **Flask**, **Bootstrap 5**, **jQuery**, **scikit-learn**, and **SQLite** — no external database server required.

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.0-000000?style=flat&logo=flask&logoColor=white)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?style=flat&logo=bootstrap&logoColor=white)
![jQuery](https://img.shields.io/badge/jQuery-3.7-0769AD?style=flat&logo=jquery&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-1.3-F7931E?style=flat&logo=scikit-learn&logoColor=white)

---

## ✨ Features

- 🤖 **AI Recommendations** — Collaborative filtering (KNN) suggests similar books based on reader behaviour
- 🔍 **Live Search** — Instant jQuery AJAX dropdown with cover thumbnails and star ratings
- ⭐ **Star Ratings & Reviews** — Interactive 5-star picker, client+server validation, live-updating averages
- 🗄️ **SQLite Storage** — Reviews persisted in a local SQLite database (no server needed)
- 📈 **Trending Books** — Home page shows the most-rated books from the dataset
- ✅ **Form Validation** — Both client-side (jQuery) and server-side (Flask) validation
- 🎨 **Literary UI** — Dark, warm-toned design with Bootstrap 5 grid and animated card grids

---

## 🗂️ Project Structure

```
project/
│
├── app.py                   # Flask routes, SQLite review storage, REST API
├── requirements.txt         # Python dependencies
├── reviews.db               # Auto-created SQLite database for reviews
│
├── model/
│   ├── train_model.py       # Loads CSVs, trains KNN, saves model.pkl
│   ├── predict.py           # get_recommendations(), search_books(), etc.
│   ├── model.pkl            # Generated after training (~50 MB)
│   ├── Books.csv            # ← you download this
│   ├── Ratings.csv          # ← you download this
│   └── Users.csv            # ← you download this
│
├── templates/
│   └── index.html           # Jinja2 template — all pages (home/search/detail)
│
└── static/
    ├── css/style.css        # Custom styles + Bootstrap overrides
    └── js/script.js         # jQuery: live search, star picker, AJAX review
```

---

## 📦 Dataset

This project uses the **Books Recommendation Dataset** by Möbius on Kaggle.

🔗 **[Download here](https://www.kaggle.com/datasets/arashnic/book-recommendation-dataset)**

| File | Rows | Key Columns |
|------|------|-------------|
| `Books.csv` | 271,360 | ISBN, title, author, year, image URLs |
| `Ratings.csv` | 1,149,780 | User-ID, ISBN, Book-Rating (0–10) |
| `Users.csv` | 278,858 | User-ID, Location, Age |

Download and place all three CSV files inside the `model/` folder before training.

---

## 🚀 Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/your-username/folio-book-recommender.git
cd folio-book-recommender
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Download the dataset

Get the three CSV files from Kaggle (link above) and copy them to `model/`.

### 4. Train the model

```bash
python model/train_model.py
```

This takes about 60–90 seconds and creates `model/model.pkl`. You should see:

```
✅  Model saved → model/model.pkl
    Books in pivot : 3,327
```

### 5. Run the app

```bash
python app.py
```

Open [http://localhost:5000](http://localhost:5000) in your browser.  
The SQLite database (`reviews.db`) is created automatically on first run.

---

## 🤖 How the ML Works

The recommendation engine uses **Collaborative Filtering** — the same technique used by Netflix and Spotify.

### Training Pipeline

1. Load `Books.csv` and `Ratings.csv` into pandas DataFrames
2. Filter to active users (≥ 50 ratings) and popular books (≥ 20 ratings)
3. Build a **Book × User pivot table** — rows = books, columns = users, values = ratings
4. Convert to a `scipy.sparse.csr_matrix`
5. Fit `sklearn.NearestNeighbors(metric='cosine', n_neighbors=11)`
6. Save model + metadata to `model.pkl` via pickle

### At Recommendation Time

1. Look up the selected book's row in the pivot table
2. Call `model.kneighbors()` → returns 8 most similar books + cosine distances
3. Convert distance to a match score: `score = 1 − cosine_distance`

---

## 🌐 API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/` | Home — 20 trending books |
| `GET` | `/search?q=<query>` | Full-page search results |
| `GET` | `/book/<isbn>` | Book detail + recommendations + reviews |
| `POST` | `/api/review` | Submit a review `{isbn, name, stars, comment}` |
| `GET` | `/api/reviews/<isbn>` | Get all reviews for a book (JSON) |
| `GET` | `/api/search?q=<query>` | Live search results (JSON) |
| `GET` | `/api/recommend/<isbn>` | Recommendations for a book (JSON) |
| `GET` | `/api/popular` | Top 20 popular books (JSON) |

---

## ⭐ Review System

Reviews are stored in **SQLite** (`reviews.db`) via a simple `reviews` table.

**Validation flow:**
- **Client-side (jQuery):** empty fields, star not selected, comment < 5 chars, name > 80 chars → inline error messages without page reload
- **Server-side (Flask):** same rules re-validated; returns JSON `{ok: false, errors: [...]}` on failure

**Submission flow:**
1. jQuery sends `POST /api/review` with JSON body
2. Flask validates + inserts into SQLite
3. New review card prepended via jQuery DOM manipulation
4. Rating summary updated in real time (no page reload)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Web framework | Flask 3.0 |
| Templating | Jinja2 (semantic HTML5 tags) |
| Frontend CSS | Bootstrap 5.3 + custom CSS variables |
| Frontend JS | jQuery 3.7 (AJAX, DOM, validation) |
| ML algorithm | scikit-learn — NearestNeighbors (cosine KNN) |
| Data wrangling | pandas, numpy |
| Sparse matrix | scipy.sparse.csr_matrix |
| Review storage | SQLite (via Python `sqlite3`) |
| Fonts | Playfair Display + DM Sans (Google Fonts) |
| Icons | Bootstrap Icons |

---

## 📋 Requirements

```
flask==3.0.0
pandas==2.1.4
numpy==1.26.2
scikit-learn==1.3.2
scipy==1.11.4
```

---

## 📁 .gitignore

```
model/model.pkl
model/Books.csv
model/Ratings.csv
model/Users.csv
reviews.db
__pycache__/
*.pyc
.env
env/
venv/
```

---

## 🔮 Ideas for Extending

- Add **user authentication** with Flask-Login
- Add **genre filters** via the Google Books API
- Switch to **Matrix Factorisation (SVD)** for better recommendations
- Deploy to **Render / Railway / Fly.io**

---

## 📄 License

MIT — free to use, modify, and distribute.
