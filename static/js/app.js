/**
 * BigQuery Release Notes - Frontend Logic
 * All 3 phases of UX improvements:
 *   Phase 1: Toast, onboarding, retry, focus, mobile copy
 *   Phase 2: Search, expand/collapse, relative dates, timeout warning
 *   Phase 3: Filter chips, sort, localStorage cache, subtitle display
 */

(function () {
  "use strict";

  // --- DOM refs ---
  const appContainer = document.getElementById("appContainer");
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
  const toastContainer = document.getElementById("toastContainer");
  const onboardingHint = document.getElementById("onboardingHint");
  const searchInput = document.getElementById("searchInput");
  const sortBtn = document.getElementById("sortBtn");

  let selectedEntry = null;
  let currentEntries = [];
  let filteredEntries = [];
  let activeFilter = "all";
  let sortAsc = false; // false = newest first
  let searchQuery = "";
  let loadingTimer = null;

  const CACHE_KEY = "bq-notes-cache";
  const ONBOARDING_KEY = "bq-onboarding-dismissed";

  // =============================================
  // TOAST SYSTEM (#7, #8)
  // =============================================
  function showToast(message, type = "info", duration = 3000) {
    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;

    const iconPaths = {
      success: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
      info: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z",
      warning: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
    };

    toast.innerHTML = `
      <svg class="toast__icon" viewBox="0 0 24 24"><path d="${iconPaths[type]}"/></svg>
      <span>${message}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("toast--exit");
      toast.addEventListener("animationend", () => toast.remove());
    }, duration);
  }

  // =============================================
  // THEME TOGGLE
  // =============================================
  function initTheme() {
    const saved = localStorage.getItem("bq-theme");
    applyTheme(saved === "light" ? "light" : "dark");
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    themeTrack.classList.toggle("theme-toggle__track--light", theme === "light");
    themeTrack.setAttribute("aria-checked", theme === "light" ? "true" : "false");
    localStorage.setItem("bq-theme", theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "light" ? "dark" : "light";
    applyTheme(next);
    showToast(`Switched to ${next} mode`, "info", 1500);
  }

  themeTrack.addEventListener("click", toggleTheme);
  themeTrack.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleTheme();
    }
  });

  // =============================================
  // ONBOARDING HINT (#1)
  // =============================================
  function initOnboarding() {
    if (localStorage.getItem(ONBOARDING_KEY)) {
      onboardingHint.classList.add("onboarding-hint--hidden");
    }
  }

  function dismissOnboarding() {
    onboardingHint.classList.add("onboarding-hint--hidden");
    localStorage.setItem(ONBOARDING_KEY, "true");
  }

  // =============================================
  // RELATIVE DATES (#6)
  // =============================================
  function getRelativeDate(isoDateStr) {
    try {
      const date = new Date(isoDateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
      }
      if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} month${months > 1 ? "s" : ""} ago`;
      }
      const years = Math.floor(diffDays / 365);
      return `${years} year${years > 1 ? "s" : ""} ago`;
    } catch {
      return "";
    }
  }

  // =============================================
  // CLIENT-SIDE CACHE (#18)
  // =============================================
  function getCachedEntries() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      // Cache valid for 10 minutes on client side
      if (Date.now() - data.timestamp > 600000) return null;
      return data.entries;
    } catch {
      return null;
    }
  }

  function setCachedEntries(entries) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        entries,
        timestamp: Date.now(),
      }));
    } catch {
      // Storage full, ignore
    }
  }

  // =============================================
  // FETCH & RENDER
  // =============================================
  async function loadNotes() {
    setLoading(true);
    selectedEntry = null;
    hideTweetBar();
    exportCsvBtn.disabled = true;

    // Start timeout warning timer (#19)
    clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => {
      const existing = feedContainer.querySelector(".timeout-warning");
      if (!existing && refreshBtn.disabled) {
        const warning = document.createElement("div");
        warning.className = "timeout-warning";
        warning.innerHTML = `
          <svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
          <span>Still loading — the feed may be slow. Please wait...</span>
        `;
        feedContainer.appendChild(warning);
      }
    }, 10000);

    try {
      const res = await fetch("/api/notes");
      const data = await res.json();

      if (data.status !== "ok") {
        throw new Error(data.message || "Failed to fetch notes.");
      }

      currentEntries = data.entries;
      setCachedEntries(currentEntries);
      applyFiltersAndRender();
      noteCount.textContent = currentEntries.length;
      lastUpdated.textContent = new Date().toLocaleTimeString();
      exportCsvBtn.disabled = currentEntries.length === 0;
      showToast(`Feed refreshed with ${currentEntries.length} entries`, "success", 2500);
    } catch (err) {
      // Try client-side cache as fallback (#18)
      const cached = getCachedEntries();
      if (cached && cached.length) {
        currentEntries = cached;
        applyFiltersAndRender();
        noteCount.textContent = currentEntries.length;
        lastUpdated.textContent = "cached";
        exportCsvBtn.disabled = false;
        showToast("Network error — showing cached data", "warning", 4000);
      } else {
        renderError(err.message);
        noteCount.textContent = "0";
      }
    } finally {
      clearTimeout(loadingTimer);
      setLoading(false);
    }
  }

  // =============================================
  // FILTERING, SEARCHING, SORTING (#10, #11, #12)
  // =============================================
  function applyFiltersAndRender() {
    let entries = [...currentEntries];

    // Date filter (#11)
    if (activeFilter !== "all") {
      const days = parseInt(activeFilter, 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      entries = entries.filter((e) => {
        try {
          return new Date(e.updated_iso) >= cutoff;
        } catch {
          return true;
        }
      });
    }

    // Search filter (#10)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      entries = entries.filter(
        (e) =>
          (e.title && e.title.toLowerCase().includes(q)) ||
          (e.subtitle && e.subtitle.toLowerCase().includes(q)) ||
          (e.content && e.content.toLowerCase().includes(q))
      );
    }

    // Sort (#12)
    if (sortAsc) {
      entries.sort((a, b) => new Date(a.updated_iso) - new Date(b.updated_iso));
    }
    // Default: newest first (feed order from server)

    filteredEntries = entries;
    renderFeed(filteredEntries);
  }

  function renderFeed(entries) {
    if (!entries.length && (searchQuery || activeFilter !== "all")) {
      feedContainer.innerHTML = `
        <div class="no-results">
          <svg class="no-results__icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <p>No results found. Try adjusting your search or filters.</p>
        </div>`;
      return;
    }

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
          <div class="feed-card__date-group">
            <span class="feed-card__date">${escapeHtml(entry.updated)}</span>
            <span class="feed-card__relative-date">${getRelativeDate(entry.updated_iso)}</span>
          </div>
        </div>
        ${entry.subtitle ? `<p class="feed-card__subtitle">${escapeHtml(entry.subtitle)}</p>` : ""}
        <div class="feed-card__content" id="content-${i}">${entry.content}</div>
        <button class="feed-card__expand" data-index="${i}" type="button" onclick="event.stopPropagation()">
          <svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
          <span>Show more</span>
        </button>
      </article>`
      )
      .join("");

    bindCardHandlers(entries);
  }

  function bindCardHandlers(entries) {
    // Selection
    feedContainer.querySelectorAll(".feed-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".feed-card__copy") || e.target.closest(".feed-card__expand")) return;
        selectCard(card, entries);
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectCard(card, entries);
        }
      });
    });

    // Copy buttons
    feedContainer.querySelectorAll(".feed-card__copy").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index, 10);
        copyToClipboard(btn, entries[index]);
      });
    });

    // Expand/Collapse buttons (#4)
    feedContainer.querySelectorAll(".feed-card__expand").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const index = btn.dataset.index;
        const contentEl = document.getElementById(`content-${index}`);
        const isExpanded = contentEl.classList.toggle("feed-card__content--expanded");
        btn.classList.toggle("feed-card__expand--expanded", isExpanded);
        btn.querySelector("span").textContent = isExpanded ? "Show less" : "Show more";
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
        <button class="btn btn--primary state-message__retry" id="retryBtn" type="button">
          <svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
          Try Again
        </button>
      </div>`;

    // Bind retry (#9)
    const retryBtn = document.getElementById("retryBtn");
    if (retryBtn) {
      retryBtn.addEventListener("click", loadNotes);
    }
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

    if (selectedEntry === entry) {
      card.classList.remove("feed-card--selected");
      selectedEntry = null;
      hideTweetBar();
      return;
    }

    feedContainer
      .querySelectorAll(".feed-card--selected")
      .forEach((c) => c.classList.remove("feed-card--selected"));

    card.classList.add("feed-card--selected");
    selectedEntry = entry;
    showTweetBar(entry);

    // Dismiss onboarding on first selection (#1)
    dismissOnboarding();
  }

  function showTweetBar(entry) {
    tweetTitle.innerHTML = `Selected: <strong>${escapeHtml(entry.title)}</strong>`;
    tweetBar.classList.add("tweet-bar--visible");
    appContainer.classList.add("app-container--bar-visible"); // #20
  }

  function hideTweetBar() {
    tweetBar.classList.remove("tweet-bar--visible");
    appContainer.classList.remove("app-container--bar-visible"); // #20
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
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

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
    const entries = filteredEntries.length ? filteredEntries : currentEntries;
    if (!entries.length) return;

    const headers = ["Title", "Date", "Link"];
    const rows = entries.map((entry) => [
      `"${entry.title.replace(/"/g, '""')}"`,
      `"${entry.updated}"`,
      `"${entry.link}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bigquery-release-notes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast("CSV downloaded successfully", "success", 2500); // #7
  }

  // =============================================
  // SEARCH (#10)
  // =============================================
  let searchDebounce = null;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      searchQuery = searchInput.value.trim();
      applyFiltersAndRender();
    }, 250);
  });

  // =============================================
  // DATE FILTER CHIPS (#11)
  // =============================================
  document.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("filter-chip--active"));
      chip.classList.add("filter-chip--active");
      activeFilter = chip.dataset.filter;
      applyFiltersAndRender();
    });
  });

  // =============================================
  // SORT TOGGLE (#12)
  // =============================================
  sortBtn.addEventListener("click", () => {
    sortAsc = !sortAsc;
    sortBtn.classList.toggle("sort-btn--asc", sortAsc);
    sortBtn.querySelector("span") ||
      (sortBtn.childNodes.forEach((n) => {
        if (n.nodeType === 3 && n.textContent.trim()) {
          n.textContent = sortAsc ? " Oldest first" : " Newest first";
        }
      }));
    // Update button text
    const textNodes = Array.from(sortBtn.childNodes).filter(
      (n) => n.nodeType === 3 && n.textContent.trim()
    );
    if (textNodes.length) {
      textNodes[0].textContent = sortAsc ? "\n        Oldest first\n      " : "\n        Newest first\n      ";
    }
    applyFiltersAndRender();
  });

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
  initOnboarding();
  loadNotes();
})();
