/* =========================
   ZEROUAN INC. — NEWS RENDERER
   File: news.js
   ========================= */

(function () {
  const STORAGE_KEY = "zerouan_news_items";

  const state = {
    category: "Tutte",
    search: ""
  };

  const fallbackNews = Array.isArray(window.ZEROUAN_NEWS_DATA) ? window.ZEROUAN_NEWS_DATA : [];

  function getLocalNews() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Impossibile leggere le news locali:", error);
      return [];
    }
  }

  function getAllNews() {
    const localNews = getLocalNews();
    const merged = [...localNews, ...fallbackNews];

    const unique = new Map();
    merged.forEach((item) => {
      if (!item || item.status === "draft") return;
      const id = item.id || slugify(item.title || String(Date.now()));
      if (!unique.has(id)) unique.set(id, { ...item, id });
    });

    return [...unique.values()].sort((a, b) => {
      const ad = new Date(a.date || 0).getTime();
      const bd = new Date(b.date || 0).getTime();
      return bd - ad;
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function slugify(value) {
    return String(value || "news")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
      .slice(0, 72) || `news-${Date.now()}`;
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);

    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  function youtubeEmbedUrl(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";

    try {
      const parsed = new URL(raw);
      let id = "";

      if (parsed.hostname.includes("youtu.be")) {
        id = parsed.pathname.replace("/", "");
      } else if (parsed.hostname.includes("youtube.com")) {
        id = parsed.searchParams.get("v") || "";
        if (!id && parsed.pathname.includes("/shorts/")) {
          id = parsed.pathname.split("/shorts/")[1]?.split("/")[0] || "";
        }
        if (!id && parsed.pathname.includes("/embed/")) {
          id = parsed.pathname.split("/embed/")[1]?.split("/")[0] || "";
        }
      }

      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : raw;
    } catch {
      return raw;
    }
  }

  function renderMedia(item) {
    const type = String(item.mediaType || "image").toLowerCase();
    const url = String(item.mediaUrl || "").trim();

    if (!url) {
      return `
        <div class="news-media" aria-hidden="true">
          <div class="news-empty-state">
            <span class="news-empty-icon">Z</span>
            <strong>ZEROUAN INC.</strong>
          </div>
        </div>
      `;
    }

    if (type === "youtube" || type === "video") {
      const embed = youtubeEmbedUrl(url);
      return `
        <div class="news-media">
          <iframe
            src="${escapeHtml(embed)}"
            title="${escapeHtml(item.title || "Video news Zerouan")}"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen>
          </iframe>
        </div>
      `;
    }

    return `
      <div class="news-media">
        <img src="${escapeHtml(url)}" alt="${escapeHtml(item.mediaAlt || item.title || "Immagine news Zerouan")}" loading="lazy">
      </div>
    `;
  }

  function renderTags(tags) {
    if (!Array.isArray(tags) || !tags.length) return "";
    return `
      <div class="news-tags" aria-label="Tag">
        ${tags.map((tag) => `<span class="news-tag">#${escapeHtml(tag)}</span>`).join("")}
      </div>
    `;
  }

  function renderLinks(item) {
    const links = Array.isArray(item.links) ? item.links.filter((link) => link && link.url) : [];
    const ctaUrl = String(item.ctaUrl || "").trim();

    const externalLinks = links.map((link) => `
      <a class="news-link" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(link.label || "Link esterno")} ↗
      </a>
    `);

    if (ctaUrl) {
      externalLinks.unshift(`
        <a class="news-read-more" href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(item.ctaLabel || "Leggi / Apri")} →
        </a>
      `);
    }

    if (!externalLinks.length) return "";
    return `<div class="news-links">${externalLinks.join("")}</div>`;
  }

  function renderArticle(item, featured = false) {
    return `
      ${renderMedia(item)}
      <div class="news-content">
        <div class="news-meta">
          <span class="news-category">${escapeHtml(item.category || "News")}</span>
          ${item.date ? `<span>${formatDate(item.date)}</span>` : ""}
          ${item.readingTime ? `<span>· ${escapeHtml(item.readingTime)}</span>` : ""}
          ${item.author ? `<span>· ${escapeHtml(item.author)}</span>` : ""}
        </div>

        <h3 class="news-title">${escapeHtml(item.title || "News senza titolo")}</h3>

        ${item.subtitle ? `<span class="release-kicker">${escapeHtml(item.subtitle)}</span>` : ""}

        <p class="news-excerpt">${escapeHtml(featured ? (item.body || item.excerpt || "") : (item.excerpt || item.body || ""))}</p>

        ${renderTags(item.tags)}
        ${renderLinks(item)}
      </div>
    `;
  }

  function normalizeSearchable(item) {
    return [
      item.title,
      item.subtitle,
      item.excerpt,
      item.body,
      item.category,
      item.author,
      Array.isArray(item.tags) ? item.tags.join(" ") : ""
    ].join(" ").toLowerCase();
  }

  function filteredNews(news) {
    const search = state.search.trim().toLowerCase();

    return news.filter((item) => {
      const categoryOk = state.category === "Tutte" || item.category === state.category;
      const searchOk = !search || normalizeSearchable(item).includes(search);
      return categoryOk && searchOk;
    });
  }

  function renderFilters(news) {
    const filterRoot = document.getElementById("newsFilters");
    if (!filterRoot) return;

    const categories = ["Tutte", ...new Set(news.map((item) => item.category || "News"))];

    filterRoot.innerHTML = categories.map((category) => `
      <button class="news-filter ${category === state.category ? "active" : ""}" type="button" data-category="${escapeHtml(category)}">
        ${escapeHtml(category)}
      </button>
    `).join("");

    filterRoot.querySelectorAll(".news-filter").forEach((button) => {
      button.addEventListener("click", () => {
        state.category = button.dataset.category || "Tutte";
        render();
      });
    });
  }

  function renderMiniList(news) {
    const root = document.getElementById("newsMiniList");
    if (!root) return;

    const items = news.slice(0, 5);

    root.innerHTML = items.length ? items.map((item) => `
      <a class="news-mini-item" href="#news" data-news-mini="${escapeHtml(item.id)}">
        <strong>${escapeHtml(item.title || "News")}</strong>
        <small>${escapeHtml(item.category || "News")} · ${formatDate(item.date)}</small>
      </a>
    `).join("") : `
      <div class="news-empty-state">
        <small>Nessun aggiornamento disponibile.</small>
      </div>
    `;
  }

  function renderTagCloud(news) {
    const root = document.getElementById("newsTagCloud");
    if (!root) return;

    const tags = new Map();

    news.forEach((item) => {
      (Array.isArray(item.tags) ? item.tags : []).forEach((tag) => {
        const clean = String(tag).trim();
        if (!clean) return;
        tags.set(clean, (tags.get(clean) || 0) + 1);
      });
    });

    const sorted = [...tags.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    root.innerHTML = sorted.length ? sorted.map(([tag, count]) => `
      <span class="news-chip">#${escapeHtml(tag)} <small>${count}</small></span>
    `).join("") : `<span class="news-chip">#zerouan</span>`;
  }

  function render() {
    const news = getAllNews();
    const filtered = filteredNews(news);

    renderFilters(news);
    renderMiniList(news);
    renderTagCloud(news);

    const featuredRoot = document.getElementById("featuredNews");
    const gridRoot = document.getElementById("newsGrid");

    if (!featuredRoot || !gridRoot) return;

    const featured = filtered.find((item) => item.featured) || filtered[0];

    if (!featured) {
      featuredRoot.innerHTML = `
        <div class="news-empty-state">
          <span class="news-empty-icon">⌁</span>
          <strong>Nessuna news pubblicata.</strong>
          <small>Vai in admin-news.html e genera la prima notizia.</small>
        </div>
      `;
      gridRoot.innerHTML = "";
      return;
    }

    featuredRoot.innerHTML = renderArticle(featured, true);

    const gridItems = filtered.filter((item) => item.id !== featured.id);
    gridRoot.innerHTML = gridItems.length ? gridItems.map((item) => `
      <article class="news-card">
        ${renderArticle(item, false)}
      </article>
    `).join("") : "";
  }

  document.addEventListener("DOMContentLoaded", () => {
    const search = document.getElementById("newsSearch");
    if (search) {
      search.addEventListener("input", (event) => {
        state.search = event.target.value || "";
        render();
      });
    }

    render();
  });

  window.ZerouanNews = {
    storageKey: STORAGE_KEY,
    getAllNews,
    render
  };
})();
