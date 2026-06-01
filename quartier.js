// quartier.js — Quartier (home base) state + overview map modal.
// Depends on geo.js globals: haversineKm, formatKm, parseLatLng, makeProjection.
// Exposes window.Quartier for app.js (distance badges, route button, sort).

const Quartier = (() => {
  const DEFAULT_HOME = { name: "Buchegg Resort", lat: 47.3663889, lng: 12.5966667 };
  const STORAGE_KEY = "saalbach.home";
  const NEAR_KM = 2; // "ab Quartier" threshold (air-line)

  let home = readHome();
  let tours = [];
  let meta = null; // overview.json projection params
  let proj = null; // makeProjection(meta)
  const listeners = [];
  let els = {};

  function readHome() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (Number.isFinite(o.lat) && Number.isFinite(o.lng)) {
          return { name: o.name || "Eigenes Quartier", lat: o.lat, lng: o.lng };
        }
      }
    } catch (e) { /* ignore corrupt storage */ }
    return { ...DEFAULT_HOME };
  }

  function getHome() { return home; }

  function setHome(next) {
    if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return;
    home = { name: next.name || "Eigenes Quartier", lat: next.lat, lng: next.lng };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(home)); } catch (e) {}
    renderCurrent();
    renderOverlay();
    listeners.forEach((cb) => cb());
  }

  function resetHome() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    home = { ...DEFAULT_HOME };
    renderCurrent();
    renderOverlay();
    listeners.forEach((cb) => cb());
  }

  function onHomeChange(cb) { listeners.push(cb); }

  // nearest point on this tour's coarse track to the current home (or null)
  function nearest(tour) {
    return nearestTrackPoint(home.lat, home.lng, tour.track);
  }

  // air-line distance from home to the nearest point of the tour; null if no track
  function distanceKm(tour) {
    const np = nearest(tour);
    return np === null ? null : np.km;
  }

  function isNear(tour) {
    const d = distanceKm(tour);
    return d !== null && d <= NEAR_KM;
  }

  function formatDistance(tour) {
    const d = distanceKm(tour);
    return d === null ? null : formatKm(d);
  }

  function routeUrl(tour) {
    const np = nearest(tour);
    if (np === null) return null;
    const origin = `${home.lat},${home.lng}`;
    const dest = `${np.lat},${np.lng}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`;
  }

  // --- DOM: overview modal, overlay rendering, draggable pin, setters ---
  const SVGNS = "http://www.w3.org/2000/svg";

  function cacheEls() {
    els = {
      openBtn: document.getElementById("openQuartierBtn"),
      modal: document.getElementById("quartierModal"),
      overlayBg: document.getElementById("quartierModalOverlay"),
      closeBtn: document.getElementById("closeQuartierBtn"),
      closeFooter: document.getElementById("closeQuartierFooterBtn"),
      svg: document.getElementById("quartierOverlay"),
      current: document.getElementById("quartierCurrent"),
      geoBtn: document.getElementById("quartierGeoBtn"),
      pasteInput: document.getElementById("quartierPasteInput"),
      pasteBtn: document.getElementById("quartierPasteBtn"),
      hint: document.getElementById("quartierHint"),
      resetBtn: document.getElementById("quartierResetBtn"),
    };
  }

  function openModal() {
    els.modal.classList.add("open");
    els.overlayBg.classList.add("open");
    document.body.style.overflow = "hidden";
    renderOverlay(); // the svg has a measurable size once visible
  }

  function closeModal() {
    els.modal.classList.remove("open");
    els.overlayBg.classList.remove("open");
    document.body.style.overflow = "";
  }

  function setHint(text, isError) {
    if (!els.hint) return;
    els.hint.textContent = text;
    els.hint.classList.toggle("error", !!isError);
  }

  function useGeolocation() {
    if (!navigator.geolocation) { setHint("Standort wird vom Gerät nicht unterstützt.", true); return; }
    setHint("Standort wird ermittelt …", false);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setHome({ name: "Mein Standort", lat: pos.coords.latitude, lng: pos.coords.longitude }); setHint("Quartier auf deinen Standort gesetzt.", false); },
      () => setHint("Standort nicht verfügbar – Erlaubnis verweigert oder kein GPS.", true),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function applyPaste() {
    const parsed = parseLatLng(els.pasteInput.value);
    if (!parsed) {
      setHint("Konnte keine Koordinaten lesen. Vollständige Karten-URL oder „47.366, 12.597“ einfügen – oder den Pin ziehen.", true);
      return;
    }
    setHome({ name: "Eigenes Quartier", lat: parsed.lat, lng: parsed.lng });
    els.pasteInput.value = "";
    setHint("Quartier gesetzt.", false);
  }

  function renderCurrent() {
    if (els.current) els.current.textContent = `Quartier: ${home.name}`;
  }

  function focusTour(tour) {
    const input = document.getElementById("searchInput");
    if (input) {
      input.value = tour.title;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const grid = document.getElementById("toursGrid");
    if (grid) grid.scrollIntoView({ behavior: "smooth" });
  }

  function clamp(v, max) { return Math.max(0, Math.min(max, v)); }

  function renderOverlay() {
    if (!els.svg || !proj || !meta) return;
    els.svg.setAttribute("viewBox", `0 0 ${meta.w} ${meta.h}`);
    els.svg.innerHTML = "";

    // clickable start dots (only those inside the overview bounds)
    tours.forEach((t) => {
      if (!Number.isFinite(t.start_lat) || !Number.isFinite(t.start_lng)) return;
      const { x, y } = proj.toXY(t.start_lng, t.start_lat);
      if (x < 0 || y < 0 || x > meta.w || y > meta.h) return;
      const c = document.createElementNS(SVGNS, "circle");
      c.setAttribute("cx", x);
      c.setAttribute("cy", y);
      c.setAttribute("r", 5);
      c.setAttribute("class", "ov-start");
      c.addEventListener("click", () => { closeModal(); focusTour(t); });
      els.svg.appendChild(c);
    });

    // draggable home pin (clamped into the visible area)
    const p = proj.toXY(home.lng, home.lat);
    const pin = document.createElementNS(SVGNS, "circle");
    pin.setAttribute("cx", clamp(p.x, meta.w));
    pin.setAttribute("cy", clamp(p.y, meta.h));
    pin.setAttribute("r", 9);
    pin.setAttribute("class", "ov-home");
    els.svg.appendChild(pin);
    makeDraggable(pin);
  }

  function makeDraggable(pin) {
    let dragging = false;
    const svg = els.svg;
    function toSvgXY(evt) {
      const rect = svg.getBoundingClientRect();
      return {
        x: ((evt.clientX - rect.left) / rect.width) * meta.w,
        y: ((evt.clientY - rect.top) / rect.height) * meta.h,
      };
    }
    pin.addEventListener("pointerdown", (e) => { dragging = true; pin.setPointerCapture(e.pointerId); e.preventDefault(); });
    pin.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const { x, y } = toSvgXY(e);
      pin.setAttribute("cx", clamp(x, meta.w));
      pin.setAttribute("cy", clamp(y, meta.h));
    });
    pin.addEventListener("pointerup", (e) => {
      if (!dragging) return;
      dragging = false;
      const { x, y } = toSvgXY(e);
      const ll = proj.toLngLat(clamp(x, meta.w), clamp(y, meta.h));
      setHome({ name: "Eigenes Quartier (Karte)", lat: ll.lat, lng: ll.lng });
    });
    pin.addEventListener("pointercancel", () => { dragging = false; });
  }

  function wireModal() {
    if (els.openBtn) els.openBtn.addEventListener("click", openModal);
    if (els.closeBtn) els.closeBtn.addEventListener("click", closeModal);
    if (els.closeFooter) els.closeFooter.addEventListener("click", closeModal);
    if (els.overlayBg) els.overlayBg.addEventListener("click", closeModal);
    if (els.geoBtn) els.geoBtn.addEventListener("click", useGeolocation);
    if (els.pasteBtn) els.pasteBtn.addEventListener("click", applyPaste);
    if (els.resetBtn) els.resetBtn.addEventListener("click", () => { resetHome(); setHint("Auf Buchegg Resort zurückgesetzt.", false); });
  }

  async function init(loadedTours) {
    tours = loadedTours || [];
    cacheEls();
    wireModal();
    try {
      const res = await fetch("./maps/overview.json");
      if (res.ok) { meta = await res.json(); proj = makeProjection(meta); }
    } catch (e) { meta = null; proj = null; }
    renderCurrent();
    renderOverlay();
  }

  return {
    init, getHome, setHome, resetHome, onHomeChange,
    distanceKm, isNear, formatDistance, routeUrl,
  };
})();

window.Quartier = Quartier;
