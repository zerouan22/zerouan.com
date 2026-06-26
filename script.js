// ===== ZEROUAN INC. CORE SCRIPT =====

// Debug init
console.log("ZEROUAN INC. loaded");

const FORUM_SUPABASE_URL = "https://vxnlycbuacrielnhjqqi.supabase.co";
const FORUM_SUPABASE_ANON_KEY = "sb_publishable_rwF9RZvjKHXtB1fjCTkzfw_x8xrwKQH";
const HOMEPAGE_NEWS_TAG = "homepage-news";

// ===== Smooth interactions =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener("click", function (e) {
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});

// ===== Gallery Lightbox =====
const buttons = document.querySelectorAll(".social-button, .nav-cta, .hero-cta");

buttons.forEach(btn => {
  btn.addEventListener("mouseenter", () => {
    btn.style.transform = "scale(1.05)";
  });

  btn.addEventListener("mouseleave", () => {
    btn.style.transform = "";
  });
});

document.addEventListener("DOMContentLoaded", () => {
  loadHomepageForumNews();

  const triggers = document.querySelectorAll(".gallery-lightbox-trigger");
  const lightbox = document.getElementById("galleryLightbox");
  const lightboxImage = document.getElementById("lightboxImage");
  const closeButton = document.querySelector(".lightbox-close");

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const fullImage = trigger.dataset.full;

      if (!fullImage) return;

      lightboxImage.src = fullImage;
      lightbox.classList.add("is-open");
      lightbox.setAttribute("aria-hidden", "false");
    });
  });

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    lightboxImage.src = "";
  }

  closeButton.addEventListener("click", closeLightbox);

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLightbox();
    }
  });
});

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNewsDate(value) {
  if (!value) return "Forum";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Forum";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function excerpt(value = "", max = 170) {
  const clean = String(value).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}...`;
}

function threadTags(thread) {
  if (Array.isArray(thread.tags)) return thread.tags.map(String);
  if (typeof thread.tags === "string") return thread.tags.split(",").map(tag => tag.trim());
  return [];
}

async function loadHomepageForumNews() {
  const board = document.getElementById("homepageNewsBoard");
  if (!board) return;

  if (!window.supabase) {
    renderHomepageNewsEmpty(board, "Bacheca News non disponibile in questa sessione.");
    return;
  }

  try {
    const client = window.supabase.createClient(FORUM_SUPABASE_URL, FORUM_SUPABASE_ANON_KEY);
    let { data, error } = await client
      .from("thread_overview")
      .select("*")
      .contains("tags", [HOMEPAGE_NEWS_TAG])
      .order("last_activity_at", { ascending: false })
      .limit(6);

    if (error) {
      const fallback = await client
        .from("threads")
        .select("id,title,body,created_at,last_activity_at,tags")
        .contains("tags", [HOMEPAGE_NEWS_TAG])
        .order("last_activity_at", { ascending: false })
        .limit(6);

      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;

    const items = (data || []).filter(thread => threadTags(thread).includes(HOMEPAGE_NEWS_TAG));
    if (!items.length) {
      renderHomepageNewsEmpty(board, "Nessuna discussione risulta ancora selezionata per la bacheca News.");
      return;
    }

    renderHomepageNews(board, items);
  } catch (error) {
    console.warn("Homepage forum news:", error.message || error);
    renderHomepageNewsEmpty(board, "La bacheca News si aggiorna appena selezioni i contenuti dal forum.");
  }
}

function renderHomepageNews(board, items) {
  const [featured, ...rest] = items;
  const secondary = rest.slice(0, 4);
  const featuredUrl = `forum.html?thread=${encodeURIComponent(featured.id)}`;

  board.innerHTML = `
    <a class="homepage-news-feature" href="${featuredUrl}" aria-label="Apri nel forum: ${escapeHtml(featured.title)}">
      <span class="news-kicker">${escapeHtml(featured.category_name || "Dal forum")}</span>
      <h3>${escapeHtml(featured.title || "Discussione selezionata")}</h3>
      <p>${escapeHtml(excerpt(featured.body || "Apri il forum per leggere e partecipare alla discussione."))}</p>
      <div class="homepage-news-meta">
        <span>${escapeHtml(featured.author_name || "Zerouan INC.")}</span>
        <span>${escapeHtml(formatNewsDate(featured.created_at || featured.last_activity_at))}</span>
        <span>${Number(featured.reply_count || 0)} risposte</span>
      </div>
      <span class="homepage-news-cta">Apri nel forum</span>
    </a>

    <div class="homepage-news-list" aria-label="Altre news selezionate">
      ${secondary.map(thread => {
        const url = `forum.html?thread=${encodeURIComponent(thread.id)}`;
        return `
          <a class="homepage-news-item" href="${url}">
            <span class="news-kicker">${escapeHtml(thread.category_name || "Forum")}</span>
            <strong>${escapeHtml(thread.title || "Discussione")}</strong>
            <small>${escapeHtml(formatNewsDate(thread.created_at || thread.last_activity_at))} · ${Number(thread.reply_count || 0)} risposte</small>
          </a>
        `;
      }).join("")}
    </div>
  `;
}

function renderHomepageNewsEmpty(board, message) {
  board.innerHTML = `
    <article class="homepage-news-feature homepage-news-empty">
      <span class="news-kicker">News</span>
      <h3>Bacheca in preparazione</h3>
      <p>${escapeHtml(message)}</p>
      <a class="homepage-news-cta" href="forum.html">Vai al forum</a>
    </article>
  `;
}
