/**
 * BigQuery Release Notes - Frontend Logic
 * Handles fetching notes, rendering cards, selection, tweeting,
 * copy-to-clipboard, CSV export, and dark/light theme toggling.
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
  const exportCsvBtn = document.getElementById("exportCsvBtn");
  const themeTrack = document.getElementById("themeTrack");

  let selectedEntry = null;
  let currentEntries = [];

  // =============================================
  // THEME TOGGLE
  // =============================================
  function initTheme() {
    const saved = localStorage.getItem("bq-theme");
    if (saved === "light") {
      applyTheme("light");
    } else {
      applyTheme("dark");
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    themeTrack.classList.toggle("theme-toggle__track--light", theme === "light");
    themeTrack.setAttribute("aria-checked", theme === "light" ? "true" : "false");
    localStorage.setItem("bq-theme", theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "light" ? "dark" : "light");
  }

  themeTrack.addEventListener("click", toggleTheme);
  themeTrack.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleTheme();
    }
  });

  // =============================================
  // FETCH & RENDER
  // =============================================
  async function loadNotes() {
    setLoading(true);
    selectedEntry = null;
    currentEntries = [];
    hideTweetBar();
    exportCsvBtn.disabled = true;

    try {
      const res = await fetch("/api/notes");
      const data = await res.json();

      if (data.status !== "ok") {
        throw new Error(data.message || "Failed to fetch notes.");
      }

      currentEntries = data.entries;
      renderFeed(currentEntries);
      noteCount.textContent = currentEntries.length;
      lastUpdated.textContent = new Date().toLocaleTimeString();
      exportCsvBtn.disabled = currentEntries.length === 0;
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
        <button class="feed-card__copy" data-index="${i}" title="Copy to clipboard" type="button">
          <span class="feed-card__copy-tooltip">Copied!</span>
          <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
        </button>
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

    // Bind click handlers for selection
    feedContainer.querySelectorAll(".feed-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        // Don't select when clicking the copy button
        if (e.target.closest(".feed-card__copy")) return;
        selectCard(card, entries);
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectCard(card, entries);
        }
      });
    });

    // Bind copy button handlers
    feedContainer.querySelectorAll(".feed-card__copy").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index, 10);
        copyToClipboard(btn, entries[index]);
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

  // =============================================
  // SELECTION & TWEET
  // =============================================
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

  // =============================================
  // COPY TO CLIPBOARD
  // =============================================
  async function copyToClipboard(btn, entry) {
    const text = `${entry.title}\n${entry.updated}\n${entry.link}`;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    // Show tooltip
    const tooltip = btn.querySelector(".feed-card__copy-tooltip");
    tooltip.classList.add("feed-card__copy-tooltip--visible");
    setTimeout(() => {
      tooltip.classList.remove("feed-card__copy-tooltip--visible");
    }, 1500);
  }

  // =============================================
  // EXPORT TO CSV
  // =============================================
  function exportToCsv() {
    if (!currentEntries.length) return;

    const headers = ["Title", "Date", "Link"];
    const rows = currentEntries.map((entry) => [
      `"${entry.title.replace(/"/g, '""')}"`,
      `"${entry.updated}"`,
      `"${entry.link}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n"
    );

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bigquery-release-notes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // =============================================
  // HELPERS
  // =============================================
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

  // =============================================
  // EVENTS
  // =============================================
  refreshBtn.addEventListener("click", loadNotes);
  tweetBtn.addEventListener("click", composeTweet);
  exportCsvBtn.addEventListener("click", exportToCsv);

  // Initial setup
  initTheme();
  loadNotes();
})();
