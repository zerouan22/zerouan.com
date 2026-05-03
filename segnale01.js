// ===============================
// SEGNALE 01 — SUPABASE + D3 GRAPH
// ===============================

const SUPABASE_URL = "https://ewmbfgosevasgnbzyodd.supabase.co";
const SUPABASE_KEY = "sb_publishable_gwREOykgdAH-CzlOT5kzmw_0wvI6jtf";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let cards = [];
let simulation = null;

const form = document.getElementById("soundCardForm");
const map = document.getElementById("soundMap");
const nodesLayer = document.getElementById("soundNodes");
const linksSvg = document.getElementById("soundLinks");
const genreFilter = document.getElementById("genreFilter");
const searchCards = document.getElementById("searchCards");
const resetViewBtn = document.getElementById("resetViewBtn");
const reloadBtn = document.getElementById("clearLocalBtn");
const modal = document.getElementById("cardModal");
const modalContent = document.getElementById("modalContent");
const closeModalBtn = document.getElementById("closeModalBtn");

init();

async function init() {
  setStatus("Connessione alla mappa condivisa...");
  await loadCards();
  subscribeRealtime();
  bindEvents();
  render();
}

async function loadCards() {
  const { data, error } = await supabaseClient
    .from("sound_cards")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    setStatus("Errore: controlla tabella, RLS policy e key Supabase.");
    return;
  }

  cards = data.map(row => ({
    id: row.id,
    trackTitle: row.track_title,
    artistName: row.artist_name,
    artistUrl: row.artist_url || "",
    artistPhoto: row.artist_photo || "",
    coverUrl: row.cover_url || "",
    primaryGenre: row.primary_genre || "",
    secondaryGenres: row.secondary_genres || "",
    moods: row.moods || "",
    description: row.description || "",
    personalComment: row.personal_comment || "",
    cardAuthor: row.card_author || "",
    authorContact: row.author_contact || "",
    createdAt: row.created_at ? row.created_at.slice(0, 10) : "",
    x: Number(row.x) || 50,
    y: Number(row.y) || 50
  }));

  setStatus(`Mappa caricata: ${cards.length} Sound Cards.`);
}

function subscribeRealtime() {
  supabaseClient
    .channel("sound_cards_live")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "sound_cards"
      },
      async () => {
        await loadCards();
        render();
      }
    )
    .subscribe();
}

function bindEvents() {
  form.addEventListener("submit", handleSubmit);
  genreFilter.addEventListener("change", render);
  searchCards.addEventListener("input", render);

  resetViewBtn.addEventListener("click", resetGraphLayout);

  reloadBtn.textContent = "Ricarica mappa";
  reloadBtn.addEventListener("click", async () => {
    await loadCards();
    render();
  });

  closeModalBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });

  window.addEventListener("keydown", event => {
    if (event.key === "Escape") closeModal();
  });

  window.addEventListener("resize", render);
}

async function handleSubmit(event) {
  event.preventDefault();

  const data = new FormData(form);
  const raw = Object.fromEntries(data.entries());

  const angle = cards.length * 0.9;
  const radius = 22 + Math.min(cards.length * 2, 32);

  const newCard = {
    track_title: clean(raw.trackTitle),
    artist_name: clean(raw.artistName),
    artist_url: clean(raw.artistUrl),
    artist_photo: clean(raw.artistPhoto),
    cover_url: clean(raw.coverUrl),
    primary_genre: clean(raw.primaryGenre),
    secondary_genres: clean(raw.secondaryGenres),
    moods: clean(raw.moods),
    description: clean(raw.description),
    personal_comment: clean(raw.personalComment),
    card_author: clean(raw.cardAuthor),
    author_contact: clean(raw.authorContact),
    x: 50 + Math.cos(angle) * radius,
    y: 50 + Math.sin(angle) * radius
  };

  const { error } = await supabaseClient
    .from("sound_cards")
    .insert(newCard);

  if (error) {
    console.error(error);
    setStatus("Errore inserimento card. Controlla policy INSERT.");
    return;
  }

  form.reset();
  setStatus("Sound Card depositata nella mappa condivisa.");
}

function render() {
  if (!map || !nodesLayer || !linksSvg) return;

  updateGenreFilter();

  const visibleCards = getVisibleCards();
  const links = buildLinks(visibleCards);

  nodesLayer.innerHTML = "";
  linksSvg.innerHTML = "";

  renderGraph(visibleCards, links);
}

function renderGraph(visibleCards, links) {
  const rect = map.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  linksSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const d3Nodes = visibleCards.map(card => ({
    ...card,
    x: (card.x / 100) * width,
    y: (card.y / 100) * height
  }));

  const d3Links = links.map(link => ({
    source: link.source,
    target: link.target,
    strength: link.strength
  }));

  if (simulation) simulation.stop();

  simulation = d3.forceSimulation(d3Nodes)
    .force(
      "link",
      d3.forceLink(d3Links)
        .id(d => d.id)
        .distance(d => {
          if (d.strength === "strong") return 165;
          if (d.strength === "medium") return 230;
          return 315;
        })
        .strength(d => {
          if (d.strength === "strong") return 0.46;
          if (d.strength === "medium") return 0.22;
          return 0.08;
        })
    )
    .force("charge", d3.forceManyBody().strength(-760))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(125))
    .alpha(0.95)
    .alphaDecay(0.035);

  const linkSelection = d3.select(linksSvg)
    .selectAll("line")
    .data(d3Links)
    .enter()
    .append("line")
    .attr("class", d => `sound-link ${d.strength}`);

  const nodeSelection = d3.select(nodesLayer)
    .selectAll(".sound-node")
    .data(d3Nodes)
    .enter()
    .append("article")
    .attr("class", "sound-node")
    .attr("tabindex", "0")
    .attr("role", "button")
    .attr("aria-label", d => `Apri Sound Card ${d.trackTitle} di ${d.artistName}`)
    .html(d => nodeHtml(d))
    .on("click", (_, d) => openCard(d.id))
    .on("keydown", (event, d) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCard(d.id);
      }
    })
    .call(
      d3.drag()
        .on("start", dragStarted)
        .on("drag", dragged)
        .on("end", dragEnded)
    );

  simulation.on("tick", () => {
    linkSelection
      .attr("x1", d => clamp(d.source.x, 20, width - 20))
      .attr("y1", d => clamp(d.source.y, 20, height - 20))
      .attr("x2", d => clamp(d.target.x, 20, width - 20))
      .attr("y2", d => clamp(d.target.y, 20, height - 20));

    nodeSelection
      .style("left", d => `${clamp(d.x, 100, width - 100)}px`)
      .style("top", d => `${clamp(d.y, 130, height - 130)}px`);
  });

  function dragStarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.25).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = clamp(event.x, 90, width - 90);
    d.fy = clamp(event.y, 120, height - 120);
  }

  async function dragEnded(event, d) {
    if (!event.active) simulation.alphaTarget(0);

    d.fx = null;
    d.fy = null;

    const newX = clamp((d.x / width) * 100, 5, 95);
    const newY = clamp((d.y / height) * 100, 8, 92);

    const { error } = await supabaseClient
      .from("sound_cards")
      .update({ x: newX, y: newY })
      .eq("id", d.id);

    if (error) {
      console.error(error);
      setStatus("Posizione non salvata. Controlla policy UPDATE.");
    }
  }
}

function nodeHtml(card) {
  const initials = (card.trackTitle || "?").slice(0, 2).toUpperCase();

  return `
    <div class="sound-node-cover">
      ${
        card.coverUrl
          ? `<img src="${escapeAttr(card.coverUrl)}" alt="Cover di ${escapeAttr(card.trackTitle)}" loading="lazy">`
          : `<span>${escapeHtml(initials)}</span>`
      }
    </div>

    <div class="sound-node-body">
      <strong class="sound-node-title">${escapeHtml(card.trackTitle)}</strong>
      <span class="sound-node-artist">${escapeHtml(card.artistName)}</span>

      <div class="sound-node-tags">
        <span>${escapeHtml(card.primaryGenre)}</span>
        ${splitTerms(card.moods).slice(0, 2).map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}
      </div>
    </div>
  `;
}

function buildLinks(list) {
  const links = [];

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const strength = calculateLink(list[i], list[j]);

      if (strength) {
        links.push({
          source: list[i].id,
          target: list[j].id,
          strength
        });
      }
    }
  }

  return links;
}

function calculateLink(a, b) {
  const aPrimary = normalize(a.primaryGenre);
  const bPrimary = normalize(b.primaryGenre);

  const aSecondary = splitTerms(a.secondaryGenres);
  const bSecondary = splitTerms(b.secondaryGenres);

  const aMoods = splitTerms(a.moods);
  const bMoods = splitTerms(b.moods);

  if (aPrimary && aPrimary === bPrimary) return "strong";

  const aGenres = new Set([aPrimary, ...aSecondary].filter(Boolean));
  const bGenres = new Set([bPrimary, ...bSecondary].filter(Boolean));

  const sharedGenres = [...aGenres].filter(term => bGenres.has(term));
  if (sharedGenres.length > 0) return "medium";

  const moodOverlap = aMoods.filter(mood => bMoods.includes(mood));
  if (moodOverlap.length > 0) return "weak";

  return null;
}

function getVisibleCards() {
  const selectedGenre = genreFilter.value || "all";
  const query = normalize(searchCards.value);

  return cards.filter(card => {
    const genreMatch =
      selectedGenre === "all" ||
      normalize(card.primaryGenre) === selectedGenre;

    const searchable = normalize([
      card.trackTitle,
      card.artistName,
      card.primaryGenre,
      card.secondaryGenres,
      card.moods,
      card.cardAuthor
    ].join(" "));

    const searchMatch = !query || searchable.includes(query);

    return genreMatch && searchMatch;
  });
}

function updateGenreFilter() {
  const current = genreFilter.value || "all";

  const genres = [...new Set(
    cards
      .map(card => normalize(card.primaryGenre))
      .filter(Boolean)
  )].sort();

  genreFilter.innerHTML = `<option value="all">Tutti i generi</option>`;

  genres.forEach(genre => {
    const option = document.createElement("option");
    option.value = genre;
    option.textContent = genre.charAt(0).toUpperCase() + genre.slice(1);
    genreFilter.appendChild(option);
  });

  genreFilter.value = genres.includes(current) ? current : "all";
}

async function resetGraphLayout() {
  const updates = cards.map((card, index) => {
    const angle = (index / Math.max(cards.length, 1)) * Math.PI * 2;
    const radius = cards.length < 4 ? 22 : 34;

    return {
      id: card.id,
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius
    };
  });

  for (const update of updates) {
    await supabaseClient
      .from("sound_cards")
      .update({ x: update.x, y: update.y })
      .eq("id", update.id);
  }

  await loadCards();
  render();
}

function openCard(id) {
  const card = cards.find(item => item.id === id);
  if (!card) return;

  const artistBlock = card.artistUrl
    ? `
      <a class="artist-mini" href="${escapeAttr(card.artistUrl)}" target="_blank" rel="noopener noreferrer">
        ${artistPhotoHtml(card)}
        <span>${escapeHtml(card.artistName)}</span>
      </a>
    `
    : `
      <span class="artist-mini">
        ${artistPhotoHtml(card)}
        <span>${escapeHtml(card.artistName)}</span>
      </span>
    `;

  modalContent.innerHTML = `
    <div class="sound-card-detail-cover">
      ${
        card.coverUrl
          ? `<img src="${escapeAttr(card.coverUrl)}" alt="Cover di ${escapeAttr(card.trackTitle)}">`
          : `<div class="empty-cover">✦</div>`
      }
    </div>

    <div class="sound-card-detail-body">
      <span class="release-kicker">Sound Card</span>
      <h2>${escapeHtml(card.trackTitle)}</h2>

      ${artistBlock}

      <div class="detail-section">
        <strong>Descrizione</strong>
        <p>${escapeHtml(card.description)}</p>
      </div>

      ${
        card.personalComment
          ? `
            <div class="detail-section">
              <strong>Commento personale</strong>
              <p>${escapeHtml(card.personalComment)}</p>
            </div>
          `
          : ""
      }

      <div class="detail-meta">
        <span>Genere: ${escapeHtml(card.primaryGenre)}</span>
        ${card.secondaryGenres ? `<span>Affinità: ${escapeHtml(card.secondaryGenres)}</span>` : ""}
        ${card.moods ? `<span>Mood: ${escapeHtml(card.moods)}</span>` : ""}
        <span>Autore card: ${escapeHtml(card.cardAuthor)}</span>
        ${formatContact(card.authorContact)}
        <span>Data: ${escapeHtml(card.createdAt)}</span>
      </div>
    </div>
  `;

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

function artistPhotoHtml(card) {
  if (!card.artistPhoto) return `<span>◎</span>`;

  return `<img src="${escapeAttr(card.artistPhoto)}" alt="Foto di ${escapeAttr(card.artistName)}">`;
}

function formatContact(contact = "") {
  const value = contact.trim();
  if (!value) return "";

  if (value.includes("@") && value.includes(".")) {
    return `<a href="mailto:${escapeAttr(value)}">Contatto autore</a>`;
  }

  if (value.startsWith("http")) {
    return `<a href="${escapeAttr(value)}" target="_blank" rel="noopener noreferrer">Contatto autore</a>`;
  }

  if (value.startsWith("@")) {
    return `<a href="https://www.instagram.com/${escapeAttr(value.slice(1))}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a>`;
  }

  return `<span>${escapeHtml(value)}</span>`;
}

function closeModal() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

function setStatus(message) {
  let status = document.getElementById("signalStatus");

  if (!status && form) {
    status = document.createElement("p");
    status.id = "signalStatus";
    status.className = "form-note";
    form.prepend(status);
  }

  if (status) status.textContent = message;
}

function splitTerms(value = "") {
  return String(value)
    .split(",")
    .map(term => term.trim().toLowerCase())
    .filter(Boolean);
}

function normalize(value = "") {
  return String(value).trim().toLowerCase();
}

function clean(value = "") {
  return String(value).trim();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}