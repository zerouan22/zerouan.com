// ======================================
// SEGNALE 01 — SUPABASE + SPOTIFY + D3
// Versione: grafo fluido + selezione delete + focus ultimo update
// ======================================

const SUPABASE_URL = "https://ewmbfgosevasgnbzyodd.supabase.co";
const SUPABASE_KEY = "sb_publishable_gwREOykgdAH-CzlOT5kzmw_0wvI6jtf";

const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 2000;

const DEFAULT_ZOOM = 0.48;
const FOCUS_ZOOM = 0.72;

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let cards = [];
let simulation = null;
let zoomBehavior = null;
let currentTransform = d3.zoomIdentity;

let selectedCardIds = new Set();
let selectionMode = false;
let spotifyCache = null;
let hasFocusedInitialUpdate = false;

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

init();

async function init() {
  setStatus("Connessione alla Costellazione Segnale 01...");

  prepareMapDom();
  bindEvents();
  setupZoom();

  await loadCards();
  subscribeRealtime();
  render();

  setTimeout(() => {
    focusLatestCardOrCenter();
    hasFocusedInitialUpdate = true;
  }, 700);
}

// ===============================
// SETUP DOM / EVENTI
// ===============================

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

  genreFilter?.addEventListener("change", () => {
    selectedCardIds.clear();
    render();
  });

  searchCards?.addEventListener("input", () => {
    selectedCardIds.clear();
    render();
  });

  mapModeSelect?.addEventListener("change", () => {
    selectedCardIds.clear();
    render();

    setTimeout(() => {
      centerVisibleGraph();
    }, 500);
  });

  resetViewBtn?.addEventListener("click", resetGraphLayout);

  if (reloadBtn) {
    reloadBtn.textContent = "Ricarica mappa";
    reloadBtn.addEventListener("click", async () => {
      await loadCards();
      selectedCardIds.clear();
      render();
      setTimeout(focusLatestCardOrCenter, 500);
    });
  }

  centerMapBtn?.addEventListener("click", centerVisibleGraph);
  deleteSelectedBtn?.addEventListener("click", handleDeleteButton);

  spotifyLookupBtn?.addEventListener("click", lookupSpotify);

  closeModalBtn?.addEventListener("click", closeModal);

  modal?.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });

  window.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeModal();

      if (selectionMode) {
        selectionMode = false;
        selectedCardIds.clear();
        updateDeleteButtonLabel();
        render();
        setStatus("Modalità selezione annullata.");
      }
    }
  });

  window.addEventListener("resize", () => {
    render();
  });
}

function setupZoom() {
  if (!map || !graphViewport) return;

  zoomBehavior = d3.zoom()
    .scaleExtent([0.16, 2.4])
    .filter(event => {
      if (event.target.closest?.(".sound-node")) return false;
      return true;
    })
    .on("zoom", event => {
      currentTransform = event.transform;
      graphViewport.style.transform =
        `translate(${currentTransform.x}px, ${currentTransform.y}px) scale(${currentTransform.k})`;
    });

  d3.select(map).call(zoomBehavior);
}

// ===============================
// SUPABASE
// ===============================

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
    createdAt: row.created_at || "",
    x: Number(row.x) || WORLD_WIDTH / 2,
    y: Number(row.y) || WORLD_HEIGHT / 2
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
      async payload => {
        await loadCards();

        if (payload.eventType === "DELETE") {
          selectedCardIds.delete(payload.old?.id);
        }

        render();

        if (!hasFocusedInitialUpdate) {
          setTimeout(focusLatestCardOrCenter, 500);
          hasFocusedInitialUpdate = true;
        }
      }
    )
    .subscribe();
}

// ===============================
// SPOTIFY LOOKUP
// ===============================

async function lookupSpotify() {
  const trackTitle = getInputValue("trackTitle");
  const artistName = getInputValue("artistName");

  if (!trackTitle && !artistName) {
    setLookupStatus("Inserisci almeno titolo brano o artista.", true);
    return;
  }

  setLookupStatus("Ricerca Spotify in corso...", false);

  try {
    const { data, error } = await supabaseClient.functions.invoke("spotify-lookup", {
      body: {
        trackTitle,
        artistName
      }
    });

    if (error) {
      throw error;
    }

    if (!data || data.error) {
      throw new Error(data?.error || "Risposta Spotify non valida.");
    }

    spotifyCache = data.result;
    applySpotifyResult(data.result);

    setLookupStatus(
      `Trovato: ${data.result.trackTitle} — ${data.result.artistName}`,
      false
    );
  } catch (error) {
    console.error("Errore spotify-lookup:", error);
    setLookupStatus(
      "Errore Spotify: Edge Function non raggiungibile o non configurata.",
      true
    );
  }
}

function applySpotifyResult(result) {
  setInputValue("trackTitle", result.trackTitle);
  setInputValue("artistName", result.artistName);
  setInputValue("artistUrl", result.artistUrl);
  setInputValue("artistPhoto", result.artistPhoto);
  setInputValue("coverUrl", result.coverUrl);

  const spotifyGenres = result.spotifyArtistGenres || "";

  if (!getInputValue("primaryGenre")) {
    const firstGenre = splitTerms(spotifyGenres)[0] || "";
    setInputValue("primaryGenre", firstGenre);
  }

  if (!getInputValue("secondaryGenres")) {
    setInputValue("secondaryGenres", spotifyGenres);
  }
}

// ===============================
// SUBMIT CARD
// ===============================

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

  setTimeout(focusLatestCardOrCenter, 900);
}

function initialPositionForNewCard(index) {
  const latest = getLatestCard();

  if (latest) {
    const angle = index * 0.82;
    const radius = 260 + Math.min(index * 8, 460);

    return {
      x: clamp(latest.x + Math.cos(angle) * radius, 180, WORLD_WIDTH - 180),
      y: clamp(latest.y + Math.sin(angle) * radius, 180, WORLD_HEIGHT - 180)
    };
  }

  const angle = index * 0.72;
  const radius = 260 + Math.min(index * 9, 420);

  return {
    x: WORLD_WIDTH / 2 + Math.cos(angle) * radius,
    y: WORLD_HEIGHT / 2 + Math.sin(angle) * radius
  };
}

// ===============================
// RENDER GRAFO
// ===============================

function render() {
  if (!map || !nodesLayer || !linksSvg) return;

  updateGenreFilter();

  const visibleCards = getVisibleCards();
  const links = buildLinks(visibleCards);

  nodesLayer.innerHTML = "";
  linksSvg.innerHTML = "";

  renderGraph(visibleCards, links);
  updateDeleteButtonLabel();
}

function renderGraph(visibleCards, links) {
  const mode = mapModeSelect?.value || "constellation";

  const d3Nodes = visibleCards.map(card => ({
    ...card,
    x: Number(card.x) || WORLD_WIDTH / 2,
    y: Number(card.y) || WORLD_HEIGHT / 2,
    wasDragged: false
  }));

  const d3Links = links.map(link => ({
    source: link.source,
    target: link.target,
    strength: link.strength
  }));

  if (simulation) simulation.stop();

  simulation = d3.forceSimulation(d3Nodes)
    .force("charge", d3.forceManyBody().strength(getChargeStrength(mode)))
    .force("collision", d3.forceCollide().radius(150).strength(0.82))
    .velocityDecay(0.34)
    .alpha(0.92)
    .alphaDecay(0.010);

  if (mode === "constellation") {
    simulation
      .force(
        "link",
        d3.forceLink(d3Links)
          .id(d => d.id)
          .distance(d => {
            if (d.strength === "strong") return 260;
            if (d.strength === "medium") return 360;
            return 520;
          })
          .strength(d => {
            if (d.strength === "strong") return 0.11;
            if (d.strength === "medium") return 0.055;
            return 0.018;
          })
      )
      .force("x", d3.forceX(WORLD_WIDTH / 2).strength(0.018))
      .force("y", d3.forceY(WORLD_HEIGHT / 2).strength(0.018));
  }

  if (mode === "popularity") {
    simulation
      .force("x", d3.forceX(d => popularityX(d)).strength(0.12))
      .force("y", d3.forceY(WORLD_HEIGHT / 2).strength(0.045))
      .force(
        "link",
        d3.forceLink(d3Links)
          .id(d => d.id)
          .distance(340)
          .strength(0.025)
      );
  }

  if (mode === "artist") {
    simulation
      .force("x", d3.forceX(d => hashToRange(normalize(d.artistName), 380, WORLD_WIDTH - 380)).strength(0.11))
      .force("y", d3.forceY(WORLD_HEIGHT / 2).strength(0.05))
      .force(
        "link",
        d3.forceLink(d3Links)
          .id(d => d.id)
          .distance(320)
          .strength(0.045)
      );
  }

  if (mode === "place") {
    simulation
      .force("x", d3.forceX(d => hashToRange(normalize(d.originLocation || "unknown"), 380, WORLD_WIDTH - 380)).strength(0.11))
      .force("y", d3.forceY(d => hashToRange(normalize(d.originLocation || "unknown-y"), 300, WORLD_HEIGHT - 300)).strength(0.10))
      .force(
        "link",
        d3.forceLink(d3Links)
          .id(d => d.id)
          .distance(350)
          .strength(0.025)
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
      event.stopPropagation();

      if (d.wasDragged) {
        d.wasDragged = false;
        return;
      }

      if (selectionMode || event.shiftKey || event.ctrlKey || event.metaKey) {
        toggleSelected(d.id);
        render();
        return;
      }

      openCard(d.id);
    })
    .on("keydown", (event, d) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();

        if (selectionMode) {
          toggleSelected(d.id);
          render();
        } else {
          openCard(d.id);
        }
      }
    })
    .call(
      d3.drag()
        .filter(event => {
          return !event.button && !selectionMode;
        })
        .on("start", dragStarted)
        .on("drag", dragged)
        .on("end", dragEnded)
    );

  simulation.on("tick", () => {
    linkSelection
      .attr("x1", d => clamp(d.source.x, 40, WORLD_WIDTH - 40))
      .attr("y1", d => clamp(d.source.y, 40, WORLD_HEIGHT - 40))
      .attr("x2", d => clamp(d.target.x, 40, WORLD_WIDTH - 40))
      .attr("y2", d => clamp(d.target.y, 40, WORLD_HEIGHT - 40));

    nodeSelection
      .style("left", d => `${clamp(d.x, 130, WORLD_WIDTH - 130)}px`)
      .style("top", d => `${clamp(d.y, 160, WORLD_HEIGHT - 160)}px`);
  });

  function dragStarted(event, d) {
    event.sourceEvent?.stopPropagation?.();

    if (!event.active) {
      simulation.alphaTarget(0.06).restart();
    }

    d.startX = d.x;
    d.startY = d.y;
    d.fx = d.x;
    d.fy = d.y;
    d.wasDragged = false;
  }

  function dragged(event, d) {
    event.sourceEvent?.stopPropagation?.();

    const dx = Math.abs(event.x - d.startX);
    const dy = Math.abs(event.y - d.startY);

    if (dx + dy > 5) {
      d.wasDragged = true;
    }

    d.fx = clamp(event.x, 120, WORLD_WIDTH - 120);
    d.fy = clamp(event.y, 150, WORLD_HEIGHT - 150);

    d.x = d.fx;
    d.y = d.fy;
  }

  async function dragEnded(event, d) {
    event.sourceEvent?.stopPropagation?.();

    if (!event.active) {
      simulation.alphaTarget(0);
    }

    const newX = clamp(d.x, 100, WORLD_WIDTH - 100);
    const newY = clamp(d.y, 100, WORLD_HEIGHT - 100);

    d.fx = null;
    d.fy = null;

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

function getChargeStrength(mode) {
  if (mode === "constellation") return -980;
  if (mode === "popularity") return -760;
  if (mode === "artist") return -820;
  if (mode === "place") return -820;
  return -900;
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

      ${
        selectedCardIds.has(card.id)
          ? `<div class="selected-badge">Selezionata</div>`
          : ""
      }
    </div>
  `;
}

// ===============================
// LINK / CONNESSIONI
// ===============================

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

// ===============================
// FILTRI / MODALITÀ MAPPA
// ===============================

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

// ===============================
// CENTRATURA / FOCUS
// ===============================

function focusLatestCardOrCenter() {
  const latest = getLatestCard();

  if (!latest) {
    centerMap();
    return;
  }

  focusWorldPoint(latest.x, latest.y, FOCUS_ZOOM);
  setStatus(`Mappa centrata sull’ultimo segnale: ${latest.trackTitle} — ${latest.artistName}`);
}

function getLatestCard() {
  if (!cards.length) return null;

  return [...cards].sort((a, b) => {
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  })[0];
}

function centerMap() {
  focusWorldPoint(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, DEFAULT_ZOOM);
}

function centerVisibleGraph() {
  const visible = getVisibleCards();

  if (!visible.length) {
    centerMap();
    return;
  }

  const avgX = d3.mean(visible, d => Number(d.x) || WORLD_WIDTH / 2);
  const avgY = d3.mean(visible, d => Number(d.y) || WORLD_HEIGHT / 2);

  focusWorldPoint(avgX, avgY, DEFAULT_ZOOM);
}

function focusWorldPoint(worldX, worldY, scale = DEFAULT_ZOOM) {
  if (!map || !zoomBehavior) return;

  const rect = map.getBoundingClientRect();

  const x = rect.width / 2 - worldX * scale;
  const y = rect.height / 2 - worldY * scale;

  d3.select(map)
    .transition()
    .duration(760)
    .ease(d3.easeCubicOut)
    .call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate(x, y).scale(scale)
    );
}

// ===============================
// RESET LAYOUT
// ===============================

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
  selectedCardIds.clear();
  render();

  setTimeout(focusLatestCardOrCenter, 600);
}

// ===============================
// SELEZIONE / CANCELLAZIONE
// ===============================

function handleDeleteButton() {
  if (!selectionMode && selectedCardIds.size === 0) {
    selectionMode = true;
    updateDeleteButtonLabel();
    setStatus("Modalità cancellazione attiva: clicca le card da selezionare, poi ripremi il bottone Cancella.");
    render();
    return;
  }

  if (selectionMode && selectedCardIds.size === 0) {
    selectionMode = false;
    updateDeleteButtonLabel();
    setStatus("Modalità cancellazione annullata: nessuna card selezionata.");
    render();
    return;
  }

  deleteSelectedCards();
}

function toggleSelected(id) {
  if (selectedCardIds.has(id)) {
    selectedCardIds.delete(id);
  } else {
    selectedCardIds.add(id);
  }

  updateDeleteButtonLabel();

  if (selectedCardIds.size > 0) {
    setStatus(`${selectedCardIds.size} card selezionata/e per cancellazione.`);
  } else if (selectionMode) {
    setStatus("Modalità cancellazione attiva: seleziona una o più card.");
  }
}

function updateDeleteButtonLabel() {
  if (!deleteSelectedBtn) return;

  if (selectedCardIds.size > 0) {
    deleteSelectedBtn.textContent = `Cancella ${selectedCardIds.size} selezionata/e`;
    deleteSelectedBtn.classList.add("danger");
    return;
  }

  if (selectionMode) {
    deleteSelectedBtn.textContent = "Annulla selezione";
    deleteSelectedBtn.classList.add("danger");
    return;
  }

  deleteSelectedBtn.textContent = "Cancella selezionate";
  deleteSelectedBtn.classList.add("danger");
}

async function deleteSelectedCards() {
  if (selectedCardIds.size === 0) {
    setStatus("Nessuna card selezionata.");
    return;
  }

  const password = prompt(`Password per cancellare ${selectedCardIds.size} card:`);

  if (!password) return;

  try {
    const { data, error } = await supabaseClient.functions.invoke("delete-card", {
      body: {
        cardIds: [...selectedCardIds],
        password
      }
    });

    if (error) throw error;

    if (!data || data.error) {
      throw new Error(data?.error || "Errore cancellazione.");
    }

    selectedCardIds.clear();
    selectionMode = false;

    await loadCards();
    render();

    setStatus("Card cancellate correttamente.");
  } catch (error) {
    console.error("Errore delete-card:", error);
    alert(`Cancellazione fallita: ${error.message || "Edge Function non raggiungibile."}`);
  }
}

// ===============================
// MODALE CARD
// ===============================

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
        <span>Data: ${formatDate(card.createdAt)}</span>
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
  selectionMode = true;
  closeModal();
  render();
  setStatus(`${selectedCardIds.size} card selezionata/e per cancellazione.`);
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

// ===============================
// UTILITY MAPPE
// ===============================

function popularityX(card) {
  const popularity = Number(card.spotifyPopularity || card.spotifyArtistPopularity || 0);
  return 280 + (clamp(popularity, 0, 100) / 100) * (WORLD_WIDTH - 560);
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

// ===============================
// UTILITY FORM / TESTI
// ===============================

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

function formatDate(value = "") {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("it-IT");
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