"""
BigQuery Release Notes Viewer
Flask application that fetches and displays BigQuery release notes
from the official Google Cloud XML feed.
"""

import xml.etree.ElementTree as ET
from datetime import datetime

import requests
from flask import Flask, jsonify, render_template

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"


def fetch_release_notes():
    """Fetch and parse the BigQuery release notes XML feed."""
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
        except (ValueError, AttributeError):
            formatted_date = date_str

        entries.append(
            {
                "title": title.text if title is not None else "No title",
                "link": link.get("href", "#") if link is not None else "#",
                "updated": formatted_date,
                "updated_raw": date_str,
                "content": content.text if content is not None else "",
            }
        )

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
