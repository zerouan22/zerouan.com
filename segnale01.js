// ======================================
// SEGNALE 01 — SUPABASE + SPOTIFY + D3
// ======================================

const SUPABASE_URL = "https://ewmbfgosevasgnbzyodd.supabase.co";
const SUPABASE_KEY = "sb_publishable_gwREOykgdAH-CzlOT5kzmw_0wvI6jtf";

const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

const WORLD_WIDTH = 2600;
const WORLD_HEIGHT = 1700;

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let cards = [];
let simulation = null;
let zoomBehavior = null;
let currentTransform = d3.zoomIdentity;
let selectedCardIds = new Set();

const form = document.getElementById("soundCardForm");
const map = document.getElementById("soundMap");
const graphViewport = document.getElementById("graphViewport");
const nodesLayer = document.getElementById("soundNodes");
const linksSvg = document.getElementById("soundLinks");

const genreFilter = document.getElementById("genreFilter");
const searchCards = document.getElementById("searchCards");
const resetViewBtn = document.getElementById("resetViewBtn");
const reloadBtn = document.getElementById("clearLocalBtn");
const centerMapBtn = document.getElementById("centerMapBtn");
const deleteSelectedBtn = document.getElementById("deleteSelectedBtn");
const mapModeSelect = document.getElementById("mapMode");

const spotifyLookupBtn = document.getElementById("spotifyLookupBtn");
const spotifyLookupStatus = document.getElementById("spotifyLookupStatus");

const modal = document.getElementById("cardModal");
const modalContent = document.getElementById("modalContent");
const closeModalBtn = document.getElementById("closeModalBtn");

let spotifyCache = null;

init();

async function init() {
  setStatus("Connessione alla Costellazione Segnale 01...");
  prepareMapDom();
  bindEvents();
  setupZoom();
  await loadCards();
  subscribeRealtime();
  render();
  centerMap();
}

function prepareMapDom() {
  if (!map || !graphViewport || !nodesLayer || !linksSvg) return;

  graphViewport.style.width = `${WORLD_WIDTH}px`;
  graphViewport.style.height = `${WORLD_HEIGHT}px`;

  linksSvg.setAttribute("width", WORLD_WIDTH);
  linksSvg.setAttribute("height", WORLD_HEIGHT);
  linksSvg.setAttribute("viewBox", `0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`);
}

function bindEvents() {
  form?.addEventListener("submit", handleSubmit);

  genreFilter?.addEventListener("change", render);
  searchCards?.addEventListener("input", render);
  mapModeSelect?.addEventListener("change", render);

  resetViewBtn?.addEventListener("click", resetGraphLayout);

  if (reloadBtn) {
    reloadBtn.textContent = "Ricarica mappa";
    reloadBtn.addEventListener("click", async () => {
      await loadCards();
      render();
    });
  }

  centerMapBtn?.addEventListener("click", centerMap);
  deleteSelectedBtn?.addEventListener("click", deleteSelectedCards);
  spotifyLookupBtn?.addEventListener("click", lookupSpotify);

  closeModalBtn?.addEventListener("click", closeModal);

  modal?.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });

  window.addEventListener("keydown", event => {
    if (event.key === "Escape") closeModal();
  });

  window.addEventListener("resize", () => {
    render();
  });
}

function setupZoom() {
  if (!map || !graphViewport) return;

  zoomBehavior = d3.zoom()
    .scaleExtent([0.18, 2.2])
    .on("zoom", event => {
      currentTransform = event.transform;
      graphViewport.style.transform = `translate(${currentTransform.x}px, ${currentTransform.y}px) scale(${currentTransform.k})`;
    });

  d3.select(map).call(zoomBehavior);
}

function centerMap() {
  if (!map || !zoomBehavior) return;

  const rect = map.getBoundingClientRect();
  const scale = 0.42;

  const x = rect.width / 2 - (WORLD_WIDTH * scale) / 2;
  const y = rect.height / 2 - (WORLD_HEIGHT * scale) / 2;

  d3.select(map)
    .transition()
    .duration(650)
    .call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate(x, y).scale(scale)
    );
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

  cards = data.map(normalizeDbCard);
  setStatus(`Mappa caricata: ${cards.length} Sound Cards.`);
}

function normalizeDbCard(row) {
  return {
    id: row.id,
    trackTitle: row.track_title || "",
    artistName: row.artist_name || "",
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
    originLocation: row.origin_location || "",
    mapNote: row.map_note || "",
    spotifyTrackId: row.spotify_track_id || "",
    spotifyArtistId: row.spotify_artist_id || "",
    spotifyAlbumId: row.spotify_album_id || "",
    spotifyUri: row.spotify_uri || "",
    spotifyPreviewUrl: row.spotify_preview_url || "",
    spotifyPopularity: Number(row.spotify_popularity) || 0,
    spotifyArtistPopularity: Number(row.spotify_artist_popularity) || 0,
    spotifyArtistGenres: row.spotify_artist_genres || "",
    createdAt: row.created_at ? row.created_at.slice(0, 10) : "",
    x: Number(row.x) || 50,
    y: Number(row.y) || 50
  };
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

async function lookupSpotify() {
  const trackTitle = getInputValue("trackTitle");
  const artistName = getInputValue("artistName");

  if (!trackTitle && !artistName) {
    setLookupStatus("Inserisci almeno titolo brano o artista.", true);
    return;
  }

  setLookupStatus("Ricerca Spotify in corso...", false);

  try {
    const res = await fetch(`${FUNCTIONS_BASE}/spotify-lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ trackTitle, artistName })
    });

    const payload = await res.json();

    if (!res.ok || payload.error) {
      throw new Error(payload.error || "Errore ricerca Spotify.");
    }

    spotifyCache = payload.result;
    applySpotifyResult(payload.result);

    setLookupStatus(`Trovato: ${payload.result.trackTitle} — ${payload.result.artistName}`, false);
  } catch (error) {
    console.error(error);
    setLookupStatus(`Errore Spotify: ${error.message}`, true);
  }
}

function applySpotifyResult(result) {
  setInputValue("trackTitle", result.trackTitle);
  setInputValue("artistName", result.artistName);
  setInputValue("artistUrl", result.artistUrl);
  setInputValue("artistPhoto", result.artistPhoto);
  setInputValue("coverUrl", result.coverUrl);

  if (!getInputValue("primaryGenre")) {
    const firstGenre = splitTerms(result.spotifyArtistGenres)[0] || "";
    setInputValue("primaryGenre", firstGenre);
  }

  if (!getInputValue("secondaryGenres")) {
    setInputValue("secondaryGenres", result.spotifyArtistGenres || "");
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const data = new FormData(form);
  const raw = Object.fromEntries(data.entries());

  const position = initialPositionForNewCard(cards.length);

  const row = {
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
    origin_location: clean(raw.originLocation),
    map_note: clean(raw.mapNote),

    spotify_track_id: spotifyCache?.spotifyTrackId || "",
    spotify_artist_id: spotifyCache?.spotifyArtistId || "",
    spotify_album_id: spotifyCache?.spotifyAlbumId || "",
    spotify_uri: spotifyCache?.spotifyUri || "",
    spotify_preview_url: spotifyCache?.spotifyPreviewUrl || "",
    spotify_popularity: spotifyCache?.spotifyPopularity ?? null,
    spotify_artist_popularity: spotifyCache?.spotifyArtistPopularity ?? null,
    spotify_artist_genres: spotifyCache?.spotifyArtistGenres || "",

    x: position.x,
    y: position.y
  };

  const { error } = await supabaseClient
    .from("sound_cards")
    .insert(row);

  if (error) {
    console.error(error);
    setStatus("Errore inserimento card. Controlla policy INSERT.");
    return;
  }

  spotifyCache = null;
  form.reset();
  setLookupStatus("Inserisci brano/artista e cerca.", false);
  setStatus("Sound Card depositata nella mappa condivisa.");
}

function initialPositionForNewCard(index) {
  const angle = index * 0.72;
  const radius = 260 + Math.min(index * 9, 420);

  return {
    x: WORLD_WIDTH / 2 + Math.cos(angle) * radius,
    y: WORLD_HEIGHT / 2 + Math.sin(angle) * radius
  };
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
  const mode = mapModeSelect?.value || "constellation";

  const d3Nodes = visibleCards.map(card => ({
    ...card,
    x: Number(card.x) || WORLD_WIDTH / 2,
    y: Number(card.y) || WORLD_HEIGHT / 2
  }));

  const d3Links = links.map(link => ({
    source: link.source,
    target: link.target,
    strength: link.strength
  }));

  if (simulation) simulation.stop();

  simulation = d3.forceSimulation(d3Nodes)
    .force("charge", d3.forceManyBody().strength(mode === "popularity" ? -620 : -860))
    .force("collision", d3.forceCollide().radius(138))
    .alpha(0.95)
    .alphaDecay(0.018);

  if (mode === "constellation") {
    simulation
      .force(
        "link",
        d3.forceLink(d3Links)
          .id(d => d.id)
          .distance(d => {
            if (d.strength === "strong") return 185;
            if (d.strength === "medium") return 270;
            return 390;
          })
          .strength(d => {
            if (d.strength === "strong") return 0.34;
            if (d.strength === "medium") return 0.16;
            return 0.055;
          })
      )
      .force("center", d3.forceCenter(WORLD_WIDTH / 2, WORLD_HEIGHT / 2));
  }

  if (mode === "popularity") {
    simulation
      .force("x", d3.forceX(d => popularityX(d)).strength(0.21))
      .force("y", d3.forceY(WORLD_HEIGHT / 2).strength(0.08))
      .force(
        "link",
        d3.forceLink(d3Links)
          .id(d => d.id)
          .distance(260)
          .strength(0.05)
      );
  }

  if (mode === "artist") {
    simulation
      .force("x", d3.forceX(d => hashToRange(normalize(d.artistName), 360, WORLD_WIDTH - 360)).strength(0.18))
      .force("y", d3.forceY(WORLD_HEIGHT / 2).strength(0.08))
      .force(
        "link",
        d3.forceLink(d3Links)
          .id(d => d.id)
          .distance(230)
          .strength(0.12)
      );
  }

  if (mode === "place") {
    simulation
      .force("x", d3.forceX(d => hashToRange(normalize(d.originLocation || "unknown"), 360, WORLD_WIDTH - 360)).strength(0.18))
      .force("y", d3.forceY(d => hashToRange(normalize(d.originLocation || "unknown-y"), 280, WORLD_HEIGHT - 280)).strength(0.16))
      .force(
        "link",
        d3.forceLink(d3Links)
          .id(d => d.id)
          .distance(260)
          .strength(0.07)
      );
  }

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
    .attr("class", d => selectedCardIds.has(d.id) ? "sound-node is-selected" : "sound-node")
    .attr("tabindex", "0")
    .attr("role", "button")
    .attr("aria-label", d => `Apri Sound Card ${d.trackTitle} di ${d.artistName}`)
    .html(d => nodeHtml(d))
    .on("click", (event, d) => {
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        toggleSelected(d.id);
        render();
        return;
      }

      openCard(d.id);
    })
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
      .attr("x1", d => clamp(d.source.x, 30, WORLD_WIDTH - 30))
      .attr("y1", d => clamp(d.source.y, 30, WORLD_HEIGHT - 30))
      .attr("x2", d => clamp(d.target.x, 30, WORLD_WIDTH - 30))
      .attr("y2", d => clamp(d.target.y, 30, WORLD_HEIGHT - 30));

    nodeSelection
      .style("left", d => `${clamp(d.x, 120, WORLD_WIDTH - 120)}px`)
      .style("top", d => `${clamp(d.y, 150, WORLD_HEIGHT - 150)}px`);
  });

  function dragStarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.18).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = clamp(event.x, 110, WORLD_WIDTH - 110);
    d.fy = clamp(event.y, 140, WORLD_HEIGHT - 140);
  }

  async function dragEnded(event, d) {
    if (!event.active) simulation.alphaTarget(0);

    d.fx = null;
    d.fy = null;

    const newX = clamp(d.x, 80, WORLD_WIDTH - 80);
    const newY = clamp(d.y, 80, WORLD_HEIGHT - 80);

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
        <span>${escapeHtml(card.primaryGenre || "unknown")}</span>
        ${
          card.spotifyPopularity
            ? `<span>pop ${escapeHtml(String(card.spotifyPopularity))}</span>`
            : ""
        }
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

  const aSecondary = splitTerms(`${a.secondaryGenres}, ${a.spotifyArtistGenres}`);
  const bSecondary = splitTerms(`${b.secondaryGenres}, ${b.spotifyArtistGenres}`);

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
  const selectedGenre = genreFilter?.value || "all";
  const query = normalize(searchCards?.value || "");

  return cards.filter(card => {
    const genreMatch =
      selectedGenre === "all" ||
      normalize(card.primaryGenre) === selectedGenre;

    const searchable = normalize([
      card.trackTitle,
      card.artistName,
      card.primaryGenre,
      card.secondaryGenres,
      card.spotifyArtistGenres,
      card.moods,
      card.cardAuthor,
      card.originLocation
    ].join(" "));

    const searchMatch = !query || searchable.includes(query);

    return genreMatch && searchMatch;
  });
}

function updateGenreFilter() {
  if (!genreFilter) return;

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
    const pos = initialPositionForNewCard(index);

    return {
      id: card.id,
      x: pos.x,
      y: pos.y
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
  centerMap();
}

function toggleSelected(id) {
  if (selectedCardIds.has(id)) {
    selectedCardIds.delete(id);
  } else {
    selectedCardIds.add(id);
  }
}

async function deleteSelectedCards() {
  if (selectedCardIds.size === 0) {
    alert("Seleziona almeno una card con CTRL+click o SHIFT+click.");
    return;
  }

  const password = prompt(`Password per cancellare ${selectedCardIds.size} card:`);

  if (!password) return;

  try {
    const res = await fetch(`${FUNCTIONS_BASE}/delete-card`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        cardIds: [...selectedCardIds],
        password
      })
    });

    const payload = await res.json();

    if (!res.ok || payload.error) {
      throw new Error(payload.error || "Errore cancellazione.");
    }

    selectedCardIds.clear();
    await loadCards();
    render();
    setStatus("Card cancellate correttamente.");
  } catch (error) {
    console.error(error);
    alert(`Cancellazione fallita: ${error.message}`);
  }
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
        ${card.spotifyArtistGenres ? `<span>Spotify genres: ${escapeHtml(card.spotifyArtistGenres)}</span>` : ""}
        ${card.moods ? `<span>Mood: ${escapeHtml(card.moods)}</span>` : ""}
        ${card.spotifyPopularity ? `<span>Popolarità brano: ${escapeHtml(String(card.spotifyPopularity))}/100</span>` : ""}
        ${card.spotifyArtistPopularity ? `<span>Popolarità artista: ${escapeHtml(String(card.spotifyArtistPopularity))}/100</span>` : ""}
        ${card.originLocation ? `<span>Luogo/scena: ${escapeHtml(card.originLocation)}</span>` : ""}
        ${card.mapNote ? `<span>Nota mappa: ${escapeHtml(card.mapNote)}</span>` : ""}
        <span>Autore card: ${escapeHtml(card.cardAuthor)}</span>
        ${formatContact(card.authorContact)}
        <span>Data: ${escapeHtml(card.createdAt)}</span>
      </div>

      <div class="release-actions">
        ${
          card.spotifyTrackId
            ? `<a class="hero-cta compact" href="https://open.spotify.com/track/${escapeAttr(card.spotifyTrackId)}" target="_blank" rel="noopener noreferrer">▶ Apri su Spotify</a>`
            : ""
        }

        <button class="ghost-button danger" type="button" onclick="window.segnale01SelectForDelete('${escapeAttr(card.id)}')">
          Seleziona per cancellazione
        </button>
      </div>
    </div>
  `;

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

window.segnale01SelectForDelete = function(id) {
  selectedCardIds.add(id);
  closeModal();
  render();
};

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
  modal?.classList.remove("is-open");
  modal?.setAttribute("aria-hidden", "true");
}

function popularityX(card) {
  const popularity = Number(card.spotifyPopularity || card.spotifyArtistPopularity || 0);
  return 260 + (clamp(popularity, 0, 100) / 100) * (WORLD_WIDTH - 520);
}

function hashToRange(value, min, max) {
  let hash = 0;
  const str = value || "unknown";

  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }

  const normalized = Math.abs(hash % 10000) / 10000;
  return min + normalized * (max - min);
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

function setLookupStatus(message, isError = false) {
  if (!spotifyLookupStatus) return;

  spotifyLookupStatus.textContent = message;
  spotifyLookupStatus.style.color = isError ? "#ff8a8a" : "";
}

function getInputValue(nameOrId) {
  const el =
    document.getElementById(nameOrId) ||
    form?.querySelector(`[name="${nameOrId}"]`);

  return el ? el.value.trim() : "";
}

function setInputValue(nameOrId, value) {
  const el =
    document.getElementById(nameOrId) ||
    form?.querySelector(`[name="${nameOrId}"]`);

  if (el && value !== undefined && value !== null) {
    el.value = value;
  }
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