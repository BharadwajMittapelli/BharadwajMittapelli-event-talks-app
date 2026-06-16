/**
 * BigQuery Release Notes - Frontend Logic
 * Handles fetching notes, rendering cards, selection, and tweeting.
 */

(function () {
  "use strict";

  // --- DOM refs ---
  const feedContainer = document.getElementById("feed");
  const refreshBtn = document.getElementById("refreshBtn");
  const refreshLabel = document.getElementById("refreshLabel");
  const refreshSpinner = document.getElementById("refreshSpinner");
  const noteCount = document.getElementById("noteCount");
  const lastUpdated = document.getElementById("lastUpdated");
  const tweetBar = document.getElementById("tweetBar");
  const tweetTitle = document.getElementById("tweetTitle");
  const tweetBtn = document.getElementById("tweetBtn");

  let selectedEntry = null;

  // --- Fetch & Render ---
  async function loadNotes() {
    setLoading(true);
    selectedEntry = null;
    hideTweetBar();

    try {
      const res = await fetch("/api/notes");
      const data = await res.json();

      if (data.status !== "ok") {
        throw new Error(data.message || "Failed to fetch notes.");
      }

      renderFeed(data.entries);
      noteCount.textContent = data.entries.length;
      lastUpdated.textContent = new Date().toLocaleTimeString();
    } catch (err) {
      renderError(err.message);
      noteCount.textContent = "0";
    } finally {
      setLoading(false);
    }
  }

  function renderFeed(entries) {
    if (!entries.length) {
      feedContainer.innerHTML = `
        <div class="state-message">
          <div class="state-message__icon">
            <svg viewBox="0 0 24 24"><path d="M20 6H4V4h16v2zm-2 6H6V8h12v4zm-4 6H8v-4h6v2z"/></svg>
          </div>
          <div class="state-message__title">No entries found</div>
          <div class="state-message__desc">The feed returned no release notes. Try refreshing later.</div>
        </div>`;
      return;
    }

    feedContainer.innerHTML = entries
      .map(
        (entry, i) => `
      <article class="feed-card" data-index="${i}" tabindex="0">
        <div class="feed-card__check">
          <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </div>
        <div class="feed-card__header">
          <h2 class="feed-card__title">
            <a href="${escapeHtml(entry.link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
              ${escapeHtml(entry.title)}
            </a>
          </h2>
          <span class="feed-card__date">${escapeHtml(entry.updated)}</span>
        </div>
        <div class="feed-card__content">${entry.content}</div>
      </article>`
      )
      .join("");

    // Bind click handlers
    feedContainer.querySelectorAll(".feed-card").forEach((card) => {
      card.addEventListener("click", () => selectCard(card, entries));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectCard(card, entries);
        }
      });
    });
  }

  function renderError(message) {
    feedContainer.innerHTML = `
      <div class="state-message">
        <div class="state-message__icon state-message__icon--error">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        </div>
        <div class="state-message__title">Something went wrong</div>
        <div class="state-message__desc">${escapeHtml(message)}</div>
      </div>`;
  }

  function renderSkeleton() {
    const cards = Array.from({ length: 5 })
      .map(
        () => `
      <div class="skeleton-card">
        <div class="skeleton-line skeleton-line--title"></div>
        <div class="skeleton-line skeleton-line--long"></div>
        <div class="skeleton-line skeleton-line--short"></div>
      </div>`
      )
      .join("");
    feedContainer.innerHTML = cards;
  }

  // --- Selection & Tweet ---
  function selectCard(card, entries) {
    const index = parseInt(card.dataset.index, 10);
    const entry = entries[index];

    // Deselect if already selected
    if (selectedEntry === entry) {
      card.classList.remove("feed-card--selected");
      selectedEntry = null;
      hideTweetBar();
      return;
    }

    // Clear previous selection
    feedContainer
      .querySelectorAll(".feed-card--selected")
      .forEach((c) => c.classList.remove("feed-card--selected"));

    card.classList.add("feed-card--selected");
    selectedEntry = entry;
    showTweetBar(entry);
  }

  function showTweetBar(entry) {
    tweetTitle.innerHTML = `Selected: <strong>${escapeHtml(entry.title)}</strong>`;
    tweetBar.classList.add("tweet-bar--visible");
  }

  function hideTweetBar() {
    tweetBar.classList.remove("tweet-bar--visible");
  }

  function composeTweet() {
    if (!selectedEntry) return;

    const text = `📢 BigQuery Update: ${selectedEntry.title}\n\nCheck it out 👇\n${selectedEntry.link}\n\n#BigQuery #GoogleCloud #DataEngineering`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, "_blank", "noopener,width=600,height=400");
  }

  // --- Helpers ---
  function setLoading(loading) {
    refreshBtn.disabled = loading;
    refreshLabel.textContent = loading ? "Refreshing…" : "Refresh Feed";
    refreshSpinner.style.display = loading ? "block" : "none";

    if (loading) {
      renderSkeleton();
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Events ---
  refreshBtn.addEventListener("click", loadNotes);
  tweetBtn.addEventListener("click", composeTweet);

  // Initial load
  loadNotes();
})();
