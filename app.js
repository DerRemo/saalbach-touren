// State Variables
let tours = [];
let filteredTours = [];

const filterState = {
  viewMode: "touren", // "touren" (tours only) or "trails" (bikepark lines only)
  searchQuery: "",
  category: "bike", // Default: all bike-related categories
  maxLength: 100,   // km
  maxDuration: 720, // minutes (12 hours)
  difficulties: {
    easy: true,     // difficulty 0, 1
    medium: true,   // difficulty 2
    hard: true      // difficulty 3+
  },
  sortBy: "default"
};

// Category Group Definitions
const BIKE_CATEGORIES = ["Mountain Biking", "E-Bike", "Freeride/ Downhill", "Gravel Bike"];

// German display labels for categories (the raw category field stays English
// because the filter logic above matches on it).
const CATEGORY_DE = {
  "Mountain Biking": "Mountainbike",
  "E-Bike": "E-Bike",
  "Freeride/ Downhill": "Freeride / Downhill",
  "Gravel Bike": "Gravelbike"
};

// A single trail / bikepark line is a short downhill segment, not a tour.
// Only the "Freeride/ Downhill" category mixes the two; everything under it
// shorter than 15 km is a park line, the rest (2 entries) are real tours.
function isSingleTrail(tour) {
  return tour.category === "Freeride/ Downhill" && tour.length_km < 15;
}

// DOM Elements
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const categoryChips = document.getElementById("categoryChips");
const categoryChipsWrapper = document.getElementById("categoryChipsWrapper");
const viewToggle = document.getElementById("viewToggle");
const introTitle = document.getElementById("introTitle");
const toursGrid = document.getElementById("toursGrid");
const resultsCount = document.getElementById("resultsCount");
const emptyState = document.getElementById("emptyState");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const filtersSummaryText = document.getElementById("filtersSummaryText");

// Drawer Elements
const filterDrawer = document.getElementById("filterDrawer");
const filterDrawerOverlay = document.getElementById("filterDrawerOverlay");
const openFiltersBtn = document.getElementById("openFiltersBtn");
const closeFiltersBtn = document.getElementById("closeFiltersBtn");
const applyFiltersBtn = document.getElementById("applyFiltersBtn");

// Filter Controls
const lengthSlider = document.getElementById("lengthSlider");
const lengthVal = document.getElementById("lengthVal");
const durationSlider = document.getElementById("durationSlider");
const durationVal = document.getElementById("durationVal");
const diffEasy = document.getElementById("diffEasy");
const diffMedium = document.getElementById("diffMedium");
const diffHard = document.getElementById("diffHard");
const sortSelect = document.getElementById("sortSelect");

// Help Modal Elements
const helpModal = document.getElementById("helpModal");
const helpModalOverlay = document.getElementById("helpModalOverlay");
const openHelpBtn = document.getElementById("openHelpBtn");
const closeHelpBtn = document.getElementById("closeHelpBtn");
const closeHelpFooterBtn = document.getElementById("closeHelpFooterBtn");

// Initialize Application
window.addEventListener("DOMContentLoaded", () => {
  loadToursData();
  setupEventListeners();
  registerServiceWorker();
});

// --- DATA FETCHING ---
async function loadToursData() {
  try {
    filtersSummaryText.textContent = "Lade Touren...";
    const response = await fetch("./tours_db.json");
    if (!response.ok) throw new Error("Netzwerk-Antwort war nicht ok");
    tours = await response.json();
    
    // Sort initial tours by ID just for consistency
    tours.sort((a, b) => a.title.localeCompare(b.title));
    
    filtersSummaryText.textContent = "Touren geladen";
    Quartier.init(tours);
    Quartier.onHomeChange(applyFilters);
    applyFilters();
  } catch (error) {
    console.error("Fehler beim Laden der Tourendaten:", error);
    filtersSummaryText.textContent = "Ladefehler";
    resultsCount.textContent = "Fehler beim Laden der Touren.";
  }
}

// --- PWA SERVICE WORKER ---
// Registers the offline service worker. It uses a network-first strategy for
// the app shell, so an online reload always shows the latest version — no more
// stale-cache surprises — while still working offline in the mountains.
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js")
      .then((reg) => console.log("Service Worker registriert:", reg.scope))
      .catch((err) => console.log("Service Worker Registrierungsfehler:", err));
  }
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
  // View Mode Toggle (Touren / Trails)
  viewToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".view-btn");
    if (!btn || btn.dataset.view === filterState.viewMode) return;
    setViewMode(btn.dataset.view);
  });

  // Search Input
  searchInput.addEventListener("input", (e) => {
    filterState.searchQuery = e.target.value.toLowerCase().trim();
    clearSearchBtn.style.display = filterState.searchQuery ? "block" : "none";
    applyFilters();
  });
  
  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    filterState.searchQuery = "";
    clearSearchBtn.style.display = "none";
    applyFilters();
  });

  // Category Chips
  categoryChips.addEventListener("click", (e) => {
    const targetChip = e.target.closest(".chip");
    if (!targetChip) return;

    // Toggle active classes
    categoryChips.querySelectorAll(".chip").forEach(chip => chip.classList.remove("active"));
    targetChip.classList.add("active");

    // Update state
    filterState.category = targetChip.dataset.category;
    applyFilters();
  });

  // Drawer Toggles
  openFiltersBtn.addEventListener("click", openDrawer);
  closeFiltersBtn.addEventListener("click", closeDrawer);
  filterDrawerOverlay.addEventListener("click", closeDrawer);
  applyFiltersBtn.addEventListener("click", closeDrawer);

  // Filter Changes
  lengthSlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    filterState.maxLength = val;
    lengthVal.textContent = val === 100 ? "Alle" : `${val} km`;
    applyFilters();
  });

  durationSlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    filterState.maxDuration = val;
    if (val === 720) {
      durationVal.textContent = "Alle";
    } else {
      const hours = Math.floor(val / 60);
      const mins = val % 60;
      durationVal.textContent = mins > 0 ? `${hours}h ${mins}m` : `${hours} Std.`;
    }
    applyFilters();
  });

  diffEasy.addEventListener("change", (e) => {
    filterState.difficulties.easy = e.target.checked;
    applyFilters();
  });
  diffMedium.addEventListener("change", (e) => {
    filterState.difficulties.medium = e.target.checked;
    applyFilters();
  });
  diffHard.addEventListener("change", (e) => {
    filterState.difficulties.hard = e.target.checked;
    applyFilters();
  });

  // Sorting
  sortSelect.addEventListener("change", (e) => {
    filterState.sortBy = e.target.value;
    applyFilters();
  });

  // Empty State Reset Button
  resetFiltersBtn.addEventListener("click", resetAllFilters);

  // Help Modal Toggles
  openHelpBtn.addEventListener("click", openHelpModal);
  closeHelpBtn.addEventListener("click", closeHelpModal);
  closeHelpFooterBtn.addEventListener("click", closeHelpModal);
  helpModalOverlay.addEventListener("click", closeHelpModal);
}

// --- DRAWER ACTIONS ---
function openDrawer() {
  filterDrawer.classList.add("open");
  filterDrawerOverlay.classList.add("open");
  document.body.style.overflow = "hidden"; // Prevent background scroll
}

function closeDrawer() {
  filterDrawer.classList.remove("open");
  filterDrawerOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

// --- HELP MODAL ACTIONS ---
function openHelpModal() {
  helpModal.classList.add("open");
  helpModalOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeHelpModal() {
  helpModal.classList.remove("open");
  helpModalOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

// --- VIEW MODE (Touren / Trails) ---
function setViewMode(mode) {
  filterState.viewMode = mode;
  const isTrails = mode === "trails";

  // Toggle button active states
  viewToggle.querySelectorAll(".view-btn").forEach((b) => {
    const active = b.dataset.view === mode;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", active ? "true" : "false");
  });

  // Trails have no sub-categories — hide the bike chips and reset selection.
  categoryChipsWrapper.style.display = isTrails ? "none" : "";
  if (isTrails) {
    filterState.category = "bike";
    categoryChips.querySelectorAll(".chip").forEach((c) =>
      c.classList.toggle("active", c.dataset.category === "bike")
    );
  }

  // Adapt copy to the active mode.
  introTitle.textContent = isTrails ? "Finde deinen nächsten Trail" : "Finde deine nächste Tour";
  searchInput.placeholder = isTrails ? "Trailname suchen..." : "Tourname suchen...";

  applyFilters();
}

// --- RESET FILTERS ---
function resetAllFilters() {
  filterState.searchQuery = "";
  filterState.category = "bike";
  filterState.maxLength = 100;
  filterState.maxDuration = 720;
  filterState.difficulties.easy = true;
  filterState.difficulties.medium = true;
  filterState.difficulties.hard = true;
  filterState.sortBy = "default";

  // Reset UI elements
  searchInput.value = "";
  clearSearchBtn.style.display = "none";
  
  categoryChips.querySelectorAll(".chip").forEach(chip => {
    chip.classList.toggle("active", chip.dataset.category === "bike");
  });

  lengthSlider.value = 100;
  lengthVal.textContent = "Alle";
  
  durationSlider.value = 720;
  durationVal.textContent = "Alle";

  diffEasy.checked = true;
  diffMedium.checked = true;
  diffHard.checked = true;
  
  sortSelect.value = "default";

  applyFilters();
}

// --- FILTERING & SORTING LOGIC ---
function applyFilters() {
  if (tours.length === 0) return;

  filteredTours = tours.filter((tour) => {
    // 1. Search Query filter (matches title or starting point)
    const matchSearch = 
      tour.title.toLowerCase().includes(filterState.searchQuery) ||
      tour.starting_point.toLowerCase().includes(filterState.searchQuery);
    if (!matchSearch) return false;

    // 2. View mode split. "Trails" shows only bikepark single trails/lines;
    // "Touren" shows everything except those. The "Freeride/ Downhill" category
    // holds both: ~22 short downhill lines (< 7 km) and 2 genuine long challenge
    // tours (56 & 88 km), cleanly separated by isSingleTrail()'s length threshold.
    if (filterState.viewMode === "trails") {
      if (!isSingleTrail(tour)) return false;
      // Trails have no sub-categories; skip the bike-chip filter below.
    } else {
      if (isSingleTrail(tour)) return false;

      // 3. Category Filter (Touren mode only)
      const cat = tour.category;
      if (filterState.category === "bike") {
        if (!BIKE_CATEGORIES.includes(cat)) return false;
      } else if (filterState.category === "mtb") {
        if (cat !== "Mountain Biking" && cat !== "Freeride/ Downhill") return false;
      } else if (filterState.category === "ebike") {
        if (cat !== "E-Bike") return false;
      } else if (filterState.category === "gravel") {
        if (cat !== "Gravel Bike") return false;
      }
    }

    // 3. Length Filter
    if (filterState.maxLength < 100 && tour.length_km > filterState.maxLength) return false;

    // 4. Duration Filter
    if (filterState.maxDuration < 720 && tour.duration_min > filterState.maxDuration) return false;

    // 5. Difficulty Filter
    // difficulty rating numbers mapping:
    // easy corresponds to difficulty values 0 and 1
    // medium corresponds to difficulty value 2
    // hard corresponds to difficulty value 3 and above
    const diff = tour.difficulty;
    if (diff <= 1) {
      if (!filterState.difficulties.easy) return false;
    } else if (diff === 2) {
      if (!filterState.difficulties.medium) return false;
    } else if (diff >= 3) {
      if (!filterState.difficulties.hard) return false;
    }

    return true;
  });

  // 6. Sorting Logic
  if (filterState.sortBy === "lengthAsc") {
    filteredTours.sort((a, b) => a.length_km - b.length_km);
  } else if (filterState.sortBy === "lengthDesc") {
    filteredTours.sort((a, b) => b.length_km - a.length_km);
  } else if (filterState.sortBy === "durationAsc") {
    filteredTours.sort((a, b) => a.duration_min - b.duration_min);
  } else if (filterState.sortBy === "ascentDesc") {
    // In Trails mode the relevant elevation metric is descent, not ascent.
    const metric = (t) => (filterState.viewMode === "trails" ? t.descent_m : t.ascent_m);
    filteredTours.sort((a, b) => metric(b) - metric(a));
  } else if (filterState.sortBy === "distanceAsc") {
    // Nearest start point to the Quartier first; tours without coords go last.
    filteredTours.sort((a, b) => {
      const da = Quartier.distanceKm(a);
      const db = Quartier.distanceKm(b);
      if (da === null && db === null) return a.title.localeCompare(b.title);
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  } else {
    // Default sorting: alphabetically by title
    filteredTours.sort((a, b) => a.title.localeCompare(b.title));
  }

  renderTours();
  updateFiltersSummary();
}

// --- RENDER DYNAMIC CARD CONTENT ---
function renderTours() {
  toursGrid.innerHTML = "";
  
  if (filteredTours.length === 0) {
    emptyState.style.display = "flex";
    resultsCount.style.display = "none";
    return;
  }
  
  emptyState.style.display = "none";
  resultsCount.style.display = "block";
  const noun = filterState.viewMode === "trails"
    ? (filteredTours.length === 1 ? 'Trail' : 'Trails')
    : (filteredTours.length === 1 ? 'Tour' : 'Touren');
  resultsCount.textContent = `${filteredTours.length} ${noun} gefunden`;

  // Render cards
  filteredTours.forEach(tour => {
    const card = document.createElement("div");
    card.className = "tour-card";
    
    // Format difficulty text & badge type
    let diffClass = "easy";
    let diffName = "Leicht";
    if (tour.difficulty === 2) {
      diffClass = "medium";
      diffName = "Mittel";
    } else if (tour.difficulty >= 3) {
      diffClass = "hard";
      diffName = "Schwer";
    }
    
    // Format duration text
    const durationHours = Math.floor(tour.duration_min / 60);
    const durationMins = tour.duration_min % 60;
    const durationStr = durationHours > 0 
      ? (durationMins > 0 ? `${durationHours}h ${durationMins}m` : `${durationHours} Std.`)
      : `${durationMins} Min.`;

    // Category Emoji Mapping
    let catEmoji = "🚲";
    if (tour.category === "Mountain Biking") catEmoji = "🏔️";
    else if (tour.category === "E-Bike") catEmoji = "⚡";
    else if (tour.category === "Freeride/ Downhill") catEmoji = "🤘";
    else if (tour.category === "Gravel Bike") catEmoji = "🪨";
    else if (tour.category.includes("Hiking") || tour.category.includes("Trail")) catEmoji = "🥾";
    
    // Image content (uses scraped images or default illustration if empty)
    const hasImage = tour.images && tour.images.length > 0;
    const imageHtml = hasImage
      ? `<img src="${tour.images[0]}" alt="${tour.title}" class="tour-image" loading="lazy">`
      : `<div class="tour-image-placeholder">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="5.5" cy="17.5" r="2.5"></circle>
            <circle cx="18.5" cy="17.5" r="2.5"></circle>
            <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h4"></path>
          </svg>
          <span style="font-size:0.75rem;">Kein Bild vorhanden</span>
        </div>`;

    // Quartier-based extras (only when the tour has a start coordinate)
    const distStr = Quartier.formatDistance(tour);
    const distHtml = distStr
      ? `<div class="tour-distance" title="Luftlinie vom Quartier">${Quartier.isNear(tour) ? '<span class="near-tag">🏠 ab Quartier</span> · ' : ''}📍 ${distStr} Luftlinie</div>`
      : '';
    const rUrl = Quartier.routeUrl(tour);
    const routeHtml = rUrl
      ? `<a class="route-btn" href="${rUrl}" target="_blank" rel="noopener" aria-label="Route zum Startpunkt">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
          Route
        </a>`
      : '';

    card.innerHTML = `
      <div class="card-media-wrapper">
        ${imageHtml}
        <span class="tour-category-badge">${catEmoji} ${CATEGORY_DE[tour.category] || tour.category}</span>
        <span class="tour-difficulty-badge ${diffClass}">${diffName}</span>
      </div>
      <div class="card-content">
        <h3 class="tour-title" title="${tour.title}">${tour.title}</h3>
        <div class="tour-start-point" title="Startpunkt: ${tour.starting_point || 'Unbekannt'}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span class="start-text">${tour.starting_point || 'Startpunkt unbekannt'}</span>
        </div>
        ${distHtml}
        <div class="tour-stats">
          <div class="stat-item">
            <span class="stat-label">Länge</span>
            <span class="stat-val">${tour.length_km.toFixed(1)} km</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">${isSingleTrail(tour) ? 'Abfahrt' : 'Anstieg'}</span>
            <span class="stat-val">${isSingleTrail(tour) ? '▼ ' + tour.descent_m : '▲ ' + tour.ascent_m}m</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Dauer</span>
            <span class="stat-val">${durationStr}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="download-gpx-btn" onclick="downloadGPX('${tour.id}', '${tour.title.replace(/'/g, "\\'")}')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            GPX Herunterladen
          </button>
          ${routeHtml}
        </div>
      </div>
    `;
    toursGrid.appendChild(card);
  });
}

// --- UPDATE ACTIVE FILTERS BANNER ---
function updateFiltersSummary() {
  const activeChips = {
    bike: "Alle Bikes",
    mtb: "Mountainbike",
    ebike: "E-Bike",
    gravel: "Gravelbike"
  };

  // In Trails mode there are no bike sub-categories — label it simply "Trails".
  const currentCat = filterState.viewMode === "trails" ? "Trails" : activeChips[filterState.category];
  let filterDesc = `${currentCat}`;

  if (filterState.maxLength < 100) {
    filterDesc += ` • max. ${filterState.maxLength}km`;
  }
  if (filterState.maxDuration < 720) {
    const hours = Math.round(filterState.maxDuration / 60);
    filterDesc += ` • max. ${hours}h`;
  }

  const activeDiffs = [];
  if (filterState.difficulties.easy) activeDiffs.push("Leicht");
  if (filterState.difficulties.medium) activeDiffs.push("Mittel");
  if (filterState.difficulties.hard) activeDiffs.push("Schwer");

  if (activeDiffs.length < 3) {
    if (activeDiffs.length === 0) {
      filterDesc += " • Keine Schwierigkeit";
    } else {
      filterDesc += ` • ${activeDiffs.join(",")}`;
    }
  }

  filtersSummaryText.textContent = filterDesc;
}

// --- GPX DOWNLOAD TRIGGER ---
window.downloadGPX = function(tourId, tourTitle) {
  // Direct GPX download endpoint on Outdooractive API for project saalbach
  const key = 'IMBSMP7G-EMWGKTHO-4OSSYIOS';
  const proj = 'api-saalbach';
  const url = `https://api-oa.com/download.tour.gpx?i=${tourId}&project=${proj}&key=${key}`;
  
  // Create an invisible hyperlink to trigger standard iOS Safari download dialogue
  const a = document.createElement("a");
  a.href = url;
  // Clean filename for the GPX file
  const safeFilename = tourTitle.toLowerCase().replace(/[^a-z0-9]/g, "-") + ".gpx";
  a.download = safeFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};
