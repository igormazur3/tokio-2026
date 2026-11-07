(function () {
  "use strict";
  var DATA = JSON.parse(document.getElementById("data").textContent);
  var places = DATA.places, atlases = DATA.atlases;
  var byCode = {};
  places.forEach(function (p) { byCode[p.code] = p; });

  var PLAN_KEY = "tokio2026-plan";
  var plan = new Set();
  try { plan = new Set(JSON.parse(localStorage.getItem(PLAN_KEY) || "[]")); } catch (e) {}
  function savePlan() { try { localStorage.setItem(PLAN_KEY, JSON.stringify(Array.from(plan))); } catch (e) {} }

  var state = { atlases: new Set(Object.keys(atlases)), q: "", hideRO: false, onlyPlan: false };

  function norm(s) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").toLowerCase();
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  /* ---------- Mapa ---------- */
  var map = L.map("map", { zoomControl: true, preferCanvas: false }).setView([35.69, 139.76], 11);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(map);

  var cluster = L.markerClusterGroup({
    showCoverageOnHover: false, maxClusterRadius: 38, spiderfyOnMaxZoom: true,
    iconCreateFunction: function (c) {
      return L.divIcon({ html: "<div class='cl'>" + c.getChildCount() + "</div>", className: "", iconSize: [38, 38] });
    }
  });
  map.addLayer(cluster);

  var markers = {}; // code -> [L.Marker]
  places.forEach(function (p) {
    var color = atlases[p.atlas].color;
    markers[p.code] = p.pts.map(function (pt, i) {
      var icon = L.divIcon({
        className: "pin" + (p.ro ? " ro" : ""),
        html: "<span style='--c:" + color + "'>" + p.code + "</span>",
        iconSize: [34, 22], iconAnchor: [17, 11]
      });
      var m = L.marker([pt[1], pt[2]], { icon: icon, title: p.code + " " + p.title, keyboard: true });
      m.bindPopup(function () { return popupHtml(p, pt[0] && p.pts.length > 1 ? pt[0] : ""); }, { maxWidth: 280 });
      m.on("click", function () { flash(p.code); });
      return m;
    });
  });

  function popupHtml(p, ptLabel) {
    var inPlan = plan.has(p.code);
    var h = "<div class='pop-h'>" + esc(p.code) + " · " + esc(p.title) + "</div>";
    h += "<div class='pop-m'>" + esc(p.kind) + (ptLabel ? " · " + esc(ptLabel) : "") + (p.loc ? "<br>" + esc(p.loc) : "") + "</div>";
    if (p.note) h += "<div class='pop-m'>" + esc(p.note) + "</div>";
    if (p.ro) h += "<div class='pop-m'>Tylko do poznania z tekstów, bez wizyty na miejscu.</div>";
    h += "<div class='pop-a'><a href='#" + p.code + "' data-goto='" + p.code + "'>Czytaj opis</a>";
    if (p.gmaps) h += "<a href='" + esc(p.gmaps) + "' target='_blank' rel='noopener'>Google Maps</a>";
    h += "<button type='button' data-plan='" + p.code + "' class='" + (inPlan ? "on" : "") + "'>" + (inPlan ? "★ W planie" : "☆ Do planu") + "</button></div>";
    return h;
  }

  /* ---------- Filtry ---------- */
  var cards = Array.prototype.slice.call(document.querySelectorAll(".place"));
  var cardByCode = {};
  cards.forEach(function (c) { cardByCode[c.dataset.code] = c; });

  function visible(p) {
    if (!state.atlases.has(p.atlas)) return false;
    if (state.hideRO && p.ro) return false;
    if (state.onlyPlan && !plan.has(p.code)) return false;
    if (state.q && norm(cardByCode[p.code].dataset.q).indexOf(state.q) === -1) return false;
    return true;
  }

  function apply() {
    var shown = 0;
    cluster.clearLayers();
    var toAdd = [];
    places.forEach(function (p) {
      var v = visible(p);
      cardByCode[p.code].classList.toggle("is-hidden", !v);
      if (v) { shown++; toAdd = toAdd.concat(markers[p.code]); }
    });
    cluster.addLayers(toAdd);
    document.getElementById("count").textContent = shown + " / " + places.length;
    Object.keys(atlases).forEach(function (k) {
      var sec = document.getElementById("atlas-" + k);
      if (!sec) return;
      var any = sec.querySelector(".place:not(.is-hidden)");
      sec.querySelector(".empty").classList.toggle("show", !any);
    });
    document.querySelectorAll(".chip[data-atlas]").forEach(function (b) {
      b.setAttribute("aria-pressed", state.atlases.has(b.dataset.atlas) ? "true" : "false");
    });
    var planBtn = document.getElementById("plan-btn");
    planBtn.setAttribute("aria-pressed", state.onlyPlan ? "true" : "false");
    planBtn.textContent = "★ Mój plan (" + plan.size + ")";
  }

  function resetFilters() {
    state.atlases = new Set(Object.keys(atlases)); state.q = ""; state.hideRO = false; state.onlyPlan = false;
    document.getElementById("q").value = ""; document.getElementById("hide-ro").checked = false;
    apply();
  }

  document.querySelectorAll(".chip[data-atlas]").forEach(function (b) {
    b.addEventListener("click", function () {
      var k = b.dataset.atlas, total = Object.keys(atlases).length;
      if (state.atlases.size === total) state.atlases = new Set([k]); // pierwszy klik zawęża do jednego atlasu
      else if (state.atlases.has(k)) state.atlases.delete(k);
      else state.atlases.add(k);
      if (state.atlases.size === 0) state.atlases = new Set(Object.keys(atlases));
      apply();
    });
  });
  document.getElementById("chip-all").addEventListener("click", function () { state.atlases = new Set(Object.keys(atlases)); state.onlyPlan = false; apply(); });
  var qTimer;
  document.getElementById("q").addEventListener("input", function (e) {
    clearTimeout(qTimer);
    qTimer = setTimeout(function () { state.q = norm(e.target.value.trim()); apply(); }, 120);
  });
  document.getElementById("hide-ro").addEventListener("change", function (e) { state.hideRO = e.target.checked; apply(); });
  document.getElementById("plan-btn").addEventListener("click", function () { state.onlyPlan = !state.onlyPlan; apply(); });

  /* ---------- Plan ---------- */
  function togglePlan(code) {
    if (plan.has(code)) plan.delete(code); else plan.add(code);
    savePlan();
    var star = cardByCode[code] && cardByCode[code].querySelector(".star");
    if (star) { star.setAttribute("aria-pressed", plan.has(code) ? "true" : "false"); star.textContent = plan.has(code) ? "★" : "☆"; }
    apply();
  }
  cards.forEach(function (c) {
    var code = c.dataset.code, star = c.querySelector(".star");
    var on = plan.has(code);
    star.setAttribute("aria-pressed", on ? "true" : "false"); star.textContent = on ? "★" : "☆";
    star.addEventListener("click", function () { togglePlan(code); });
    c.querySelector(".onmap").addEventListener("click", function () { showOnMap(code); });
  });

  /* ---------- Akcje ---------- */
  var flashTimer;
  function flash(code) {
    var c = cardByCode[code]; if (!c) return;
    c.classList.add("flash"); clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { c.classList.remove("flash"); }, 2200);
  }
  function ensureVisible(code) {
    var p = byCode[code]; if (!p) return;
    if (!visible(p)) resetFilters();
  }
  function showOnMap(code) {
    ensureVisible(code);
    var ms = markers[code]; if (!ms || !ms.length) return;
    if (window.innerWidth < 1040) document.getElementById("mapcol").scrollIntoView({ behavior: "smooth", block: "start" });
    if (ms.length === 1) {
      map.setView(ms[0].getLatLng(), Math.max(map.getZoom(), 16), { animate: true });
      cluster.zoomToShowLayer(ms[0], function () { ms[0].openPopup(); });
    } else {
      map.fitBounds(L.latLngBounds(ms.map(function (m) { return m.getLatLng(); })).pad(0.4));
      setTimeout(function () { ms[0].openPopup(); }, 400);
    }
  }

  document.addEventListener("click", function (e) {
    var g = e.target.closest("[data-goto]");
    if (g) { ensureVisible(g.dataset.goto); setTimeout(function () { flash(g.dataset.goto); }, 50); }
    var pb = e.target.closest("[data-plan]");
    if (pb) {
      togglePlan(pb.dataset.plan);
      var on = plan.has(pb.dataset.plan);
      pb.classList.toggle("on", on); pb.textContent = on ? "★ W planie" : "☆ Do planu";
    }
    var cl = e.target.closest("a.code");
    if (cl) { var code = cl.getAttribute("href").slice(1); ensureVisible(code); setTimeout(function () { flash(code); }, 50); }
  });
  window.addEventListener("hashchange", function () {
    var code = location.hash.slice(1);
    if (byCode[code]) { ensureVisible(code); flash(code); }
  });

  window.addEventListener("resize", function () { map.invalidateSize(); });
  apply();
  setTimeout(function () { map.invalidateSize(); }, 200);
  if (byCode[location.hash.slice(1)]) {
    var c0 = location.hash.slice(1);
    setTimeout(function () { var el = cardByCode[c0]; if (el) el.scrollIntoView(); flash(c0); }, 300);
  }
})();
