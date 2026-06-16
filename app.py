"""
BigQuery Release Notes Viewer
Flask application that fetches and displays BigQuery release notes
from the official Google Cloud XML feed.
"""

import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime

import requests
from flask import Flask, jsonify, render_template

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# --- Simple in-memory cache (Phase 3, #17) ---
_cache = {"entries": None, "timestamp": 0}
CACHE_TTL = 300  # 5 minutes


def strip_html(html_str):
    """Remove HTML tags and return plain text."""
    text = re.sub(r"<[^>]+>", " ", html_str)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_subtitle(content_html):
    """Extract a short subtitle from the HTML content (Phase 3, #5).

    Looks for the first meaningful text snippet — a <li>, <p>, or heading —
    and returns up to 140 characters.
    """
    if not content_html:
        return ""

    # Try to grab first <li> or <p> content
    match = re.search(r"<(?:li|p)[^>]*>(.*?)</(?:li|p)>", content_html, re.DOTALL)
    if match:
        text = strip_html(match.group(1))
        if len(text) > 20:
            return text[:140].rstrip() + ("…" if len(text) > 140 else "")

    # Fallback: first 140 chars of plain text
    plain = strip_html(content_html)
    if len(plain) > 20:
        return plain[:140].rstrip() + ("…" if len(plain) > 140 else "")

    return ""


def fetch_release_notes(bypass_cache=False):
    """Fetch and parse the BigQuery release notes XML feed."""
    now = time.time()

    # Return cached data if still fresh
    if (
        not bypass_cache
        and _cache["entries"] is not None
        and (now - _cache["timestamp"]) < CACHE_TTL
    ):
        return _cache["entries"]

    response = requests.get(FEED_URL, timeout=30)
    response.raise_for_status()

    root = ET.fromstring(response.content)

    # The feed uses Atom namespace
    ns = {"atom": "http://www.w3.org/2005/Atom"}

    entries = []
    for entry in root.findall("atom:entry", ns):
        title = entry.find("atom:title", ns)
        link = entry.find("atom:link", ns)
        updated = entry.find("atom:updated", ns)
        content = entry.find("atom:content", ns)

        # Parse and format the date
        date_str = updated.text if updated is not None else ""
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            formatted_date = dt.strftime("%B %d, %Y")
            iso_date = dt.isoformat()
        except (ValueError, AttributeError):
            formatted_date = date_str
            iso_date = date_str

        content_html = content.text if content is not None else ""

        entries.append(
            {
                "title": title.text if title is not None else "No title",
                "subtitle": extract_subtitle(content_html),
                "link": link.get("href", "#") if link is not None else "#",
                "updated": formatted_date,
                "updated_raw": date_str,
                "updated_iso": iso_date,
                "content": content_html,
            }
        )

    # Update cache
    _cache["entries"] = entries
    _cache["timestamp"] = now

    return entries


@app.route("/")
def index():
    """Render the main page."""
    return render_template("index.html")


@app.route("/api/notes")
def get_notes():
    """API endpoint to fetch release notes."""
    try:
        entries = fetch_release_notes()
        return jsonify({"status": "ok", "entries": entries})
    except requests.RequestException as e:
        return jsonify({"status": "error", "message": str(e)}), 502
    except ET.ParseError as e:
        return jsonify({"status": "error", "message": f"XML parse error: {e}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
