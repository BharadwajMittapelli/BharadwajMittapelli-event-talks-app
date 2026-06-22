# BigQuery Release Notes Viewer

A Flask web application that fetches and displays the latest [Google BigQuery release notes](https://cloud.google.com/bigquery/docs/release-notes) from the official XML feed — with the ability to tweet about any update.

![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.x-lightgrey?logo=flask)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

- **Live Feed** — Fetches release notes directly from Google's Atom feed (`bigquery-release-notes.xml`).
- **Refresh with Spinner** — One-click refresh button with a loading spinner and skeleton card animations.
- **Select & Tweet** — Click any release note card to select it, then hit the Tweet button to compose a pre-filled tweet with the title, link, and relevant hashtags.
- **Premium Dark UI** — Modern dark-mode design with glassmorphism, ambient glows, and staggered entrance animations.
- **Responsive** — Fully responsive layout that works on desktop, tablet, and mobile.

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- [uv](https://docs.astral.sh/uv/) (recommended) or pip

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/BharadwajMittapelli/BharadwajMittapelli-event-talks-app.git
   cd BharadwajMittapelli-event-talks-app
   ```

2. **Create a virtual environment and install dependencies**

   Using `uv`:
   ```bash
   uv venv .venv
   source .venv/bin/activate   # Linux/macOS
   .venv\Scripts\activate      # Windows
   uv pip install -r requirements.txt
   ```

   Or using `pip`:
   ```bash
   python -m venv .venv
   source .venv/bin/activate   # Linux/macOS
   .venv\Scripts\activate      # Windows
   pip install -r requirements.txt
   ```

3. **Run the application**
   ```bash
   python app.py
   ```

4. **Open your browser** and navigate to `http://127.0.0.1:5000`

---

## 📂 Project Structure

```
├── app.py                  # Flask backend — fetches & parses the XML feed
├── requirements.txt        # Python dependencies
├── .gitignore
├── templates/
│   └── index.html          # Main HTML template
└── static/
    ├── css/
    │   └── style.css       # Dark-mode styling with animations
    └── js/
        └── app.js          # Frontend logic — fetch, render, select, tweet
```

---

## 🐦 Tweet Integration

When you select a release note card, a floating tweet bar appears at the bottom. Clicking **Tweet** opens Twitter's compose window pre-filled with :

```
📢 BigQuery Update: <Title>

Check it out 👇
<Link>

#BigQuery #GoogleCloud #DataEngineering
```

---

## 🛠️ Tech Stack

| Layer    | Technology              |
|----------|-------------------------|
| Backend  | Python, Flask           |
| Frontend | HTML, CSS, JavaScript   |
| Feed     | Google Cloud Atom/XML   |

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
