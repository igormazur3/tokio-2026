import fs from "fs";
import { marked } from "marked";
import { COORDS } from "./coords.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const src = fs.readFileSync(new URL("./fixed.md", import.meta.url), "utf8");

const ATLAS = {
  A: { short: "Yakuza i czarne rynki", color: "#ff5d6c" },
  B: { short: "Yoshiwara i akasen", color: "#ff8fc0" },
  C: { short: "Pachinko i hazard", color: "#ffc247" },
  D: { short: "Muzea, bary, sklepy", color: "#7fe08f" },
  E: { short: "Mroczna historia", color: "#b794ff" },
  F: { short: "Haikyo i znikające Tokio", color: "#5cc8ff" },
  G: { short: "Subkultury", color: "#ff9a3c" },
  H: { short: "Yokochō i dzielnice robotnicze", color: "#3fd6c4" },
  I: { short: "Nieoczywiste kategorie", color: "#c9cfdb" },
};
const TAG_TITLES = {
  "Ź": "Fakt sprawdzony w źródle otwartym",
  "W": "Wiedza ogólna, niesprawdzona w źródle; status do potwierdzenia przed wizytą",
  "A": "Relacja anegdotyczna",
  "L": "Legenda miejska lub folklor, nie fakt",
};
const SLUGS = [
  [/^Jak czytać/, "jak-czytac"], [/^Executive summary/, "summary"], [/^Tokyo Iceberg/, "iceberg"],
  [/^Mapa dzielnic/, "dzielnice"], [/^Tokyo True Crime/, "true-crime"], [/^Tokyo After Dark/, "after-dark"],
  [/^Hidden Gems/, "hidden-gems"], [/^Read Only/, "read-only"], [/^Ranking TOP/, "ranking"], [/^Bibliografia/, "bibliografia"],
];

marked.use({
  gfm: true,
  renderer: {
    link(href, title, text) {
      const ext = /^https?:/.test(href);
      return `<a href="${href}"${title ? ` title="${title}"` : ""}${ext ? ' target="_blank" rel="noopener"' : ""}>${text}</a>`;
    },
  },
});

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const strip = (s) => s.replace(/\\\[|\\\]/g, (m) => m[1]).replace(/\*\*/g, "");

/* ---------- Parsowanie ---------- */
const [head, ...rest] = src.split(/^## /m);
const blocks = rest.map((b) => {
  const nl = b.indexOf("\n");
  return { title: b.slice(0, nl).trim(), body: b.slice(nl + 1).trim() };
});

const places = [];
function parsePlace(raw, atlasLetter) {
  const nl = raw.indexOf("\n");
  const h = raw.slice(0, nl).trim();
  const m = h.match(/^([A-I]\d+)\.\s+(.*)$/);
  if (!m) throw new Error("Zły nagłówek: " + h);
  const code = m[1];
  let title = m[2], jp = "";
  const jm = title.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (jm && /[\u3000-\u30ff\u3400-\u9fff]/.test(jm[2])) { title = jm[1]; jp = jm[2]; }
  const paras = raw.slice(nl + 1).trim().split(/\n\s*\n/).map((p) => p.trim());
  const metaRaw = paras.shift();
  const statsIdx = paras.findIndex((p) => p.startsWith("Stan:"));
  const srcIdx = paras.findIndex((p) => p.startsWith("Źródła:"));
  const statsRaw = statsIdx >= 0 ? paras[statsIdx] : "";
  const srcRaw = srcIdx >= 0 ? paras[srcIdx] : "";
  const body = paras.filter((_, i) => i !== statsIdx && i !== srcIdx);

  const mp = metaRaw.split(" · ");
  const kind = mp[0];
  const last = mp[mp.length - 1];
  const lm = last.match(/\[mapa\]\(([^)]+)\)/);
  const gmaps = lm ? lm[1] : "";
  const loc = mp.slice(1, mp.length - 1).join(" · ");
  const metaTag = lm ? "" : last;

  const sp = statsRaw.split(" · ");
  const st = { stan: "", dostep: "", bezp: "", niet: 0, aut: 0, tur: "", rel: "", extra: [] };
  for (const part of sp) {
    let mm;
    if ((mm = part.match(/^Stan:\s*(.*)$/))) st.stan = mm[1];
    else if ((mm = part.match(/^Dostęp:\s*(.*)$/))) st.dostep = mm[1];
    else if ((mm = part.match(/^Bezpieczeństwo:\s*(.*)$/))) st.bezp = mm[1];
    else if ((mm = part.match(/^Nietypowość\s+(\d+)/))) st.niet = +mm[1];
    else if ((mm = part.match(/^Autentyczność\s+(\d+)/))) st.aut = +mm[1];
    else if ((mm = part.match(/^Turystyczność:\s*(.*)$/))) st.tur = mm[1];
    else if (part.startsWith("\\[")) st.rel = part;
    else if (part.trim()) st.extra.push(part);
  }
  const ro = /Read Only|tylko historia|tylko do czytania|tylko jako kontekst/i.test(metaTag + " " + st.dostep);
  const c = COORDS[code];
  if (!c) throw new Error("Brak współrzędnych: " + code);
  const pts = Array.isArray(c) ? [["", c[0], c[1]]] : c.pts;
  const p = {
    code, atlas: atlasLetter, title: strip(title), jp, kind: strip(kind), loc: strip(loc), gmaps, ro, pts,
    note: code === "E15" ? "Pinezka przy chramie Anamori Inari; sama brama stoi nad rzeką Ebitori, kawałek dalej." : "",
    _raw: { paras: body, st, srcRaw, metaTag },
  };
  places.push(p);
  return p;
}

const sections = [];
for (const b of blocks) {
  const am = b.title.match(/^Atlas ([A-I]):\s*(.*)$/);
  if (am) {
    const parts = b.body.split(/^### /m);
    const intro = parts.shift().trim();
    const ps = parts.map((x) => parsePlace(x, am[1]));
    sections.push({ type: "atlas", letter: am[1], title: am[2], intro, places: ps });
  } else {
    const slug = (SLUGS.find(([re]) => re.test(b.title)) || [])[1];
    if (!slug) throw new Error("Nieznana sekcja: " + b.title);
    sections.push({ type: "plain", slug, title: b.title, body: b.body });
  }
}

/* ---------- Weryfikacje ---------- */
const codes = new Set(places.map((p) => p.code));
const problems = [];
if (places.length !== 106) problems.push(`Miejsc: ${places.length}, oczekiwano 106`);
for (const p of places) {
  if (!p._raw.st.stan) problems.push(`${p.code}: brak linii Stan`);
  if (!p.gmaps && !p.ro) problems.push(`${p.code}: brak linku mapy, a nie jest Read Only`);
  if (!p._raw.paras.length) problems.push(`${p.code}: brak opisu`);
}
// Iceberg: każdy kod dokładnie raz, liczby zgodne z wierszami tabeli
const ice = sections.find((s) => s.slug === "iceberg");
const iceRows = ice.body.split("\n").filter((l) => /^\| \*\*\d\./.test(l));
const iceCodes = [];
for (const row of iceRows) {
  const cells = row.split("|").map((x) => x.trim());
  const n = +cells[2];
  const cs = (cells[3].match(/\b[A-I]\d{1,2}\b/g) || []);
  if (cs.length !== n) problems.push(`Iceberg ${cells[1]}: deklarowane ${n}, wypisane ${cs.length}`);
  iceCodes.push(...cs);
}
const dup = iceCodes.filter((c, i) => iceCodes.indexOf(c) !== i);
const miss = [...codes].filter((c) => !iceCodes.includes(c));
if (dup.length) problems.push("Iceberg: duplikaty " + dup.join(", "));
if (miss.length) problems.push("Iceberg: brakuje " + miss.join(", "));
// Odwołania do nieistniejących kodów
const allText = src.replace(/https?:\/\/\S+/g, "");
const refs = new Set(allText.match(/\b[A-I]\d{1,2}\b/g) || []);
const unknown = [...refs].filter((c) => !codes.has(c));
if (unknown.length) problems.push("Odwołania do nieistniejących kodów: " + unknown.join(", "));

/* ---------- Render ---------- */
const CJK = /[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]+(?:[ ・·][\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]+)*/g;
const titleOf = Object.fromEntries(places.map((p) => [p.code, p.title]));
function decorate(html) {
  let inA = 0;
  return html
    .split(/(<[^>]+>)/)
    .map((tok) => {
      if (tok.startsWith("<")) {
        if (/^<a[\s>]/i.test(tok)) inA++;
        else if (/^<\/a>/i.test(tok)) inA--;
        return tok;
      }
      let t = tok.replace(/\[(Ź|W|A|L)\]/g, (_, k) => `<span class="tag t-${k}" title="${TAG_TITLES[k]}">${k}</span>`);
      t = t.replace(CJK, (s) => `<span lang="ja">${s}</span>`);
      if (!inA) {
        // kody nie wchodzą do znaczników już wstawionych (CJK/tag nie zawierają kodów)
        t = t.replace(/\b([A-I])(\d{1,2})\b/g, (s) => (codes.has(s) ? `<a class="code" href="#${s}" title="${s} ${esc(titleOf[s])}">${s}</a>` : s));
      }
      return t;
    })
    .join("");
}
const md = (s) => decorate(marked.parse(s));

function meter(label, n) {
  const bars = Array.from({ length: 10 }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("");
  return `<div class="meter" role="img" aria-label="${label} ${n} na 10"><span>${label}</span><span class="bars">${bars}</span><b>${n}</b></div>`;
}

function card(p) {
  const { paras, st, srcRaw } = p._raw;
  const color = ATLAS[p.atlas].color;
  const turLevel = /^wysok/i.test(st.tur) ? "high" : /^średni/i.test(st.tur) ? "mid" : "";
  const facts = [["Stan", st.stan], ["Dostęp", st.dostep], ["Bezpieczeństwo", st.bezp]]
    .filter(([, v]) => v)
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${decorate(marked.parseInline(v))}</dd></div>`)
    .join("");
  const rel = st.rel ? `<div class="rel">Wiarygodność: ${decorate(marked.parseInline(st.rel))}</div>` : "";
  const srcHtml = srcRaw ? `<div class="src">Źródła: ${decorate(marked.parseInline(srcRaw.replace(/^Źródła:\s*/, "")))}</div>` : "";
  const search = [p.code, p.title, p.jp, p.kind, p.loc, ...paras.map(strip)].join(" ");
  const metaBits = [`<span class="kind">${esc(p.kind)}</span>`];
  if (p.loc) metaBits.push(`<span>${esc(p.loc)}</span>`);
  if (p.ro) metaBits.push(`<span class="ro-badge">Read Only</span>`);
  return `<article class="place${p.ro ? " ro" : ""}" id="${p.code}" data-code="${p.code}" data-atlas="${p.atlas}" data-q="${esc(search)}" style="--c:${color}">
<header class="p-head"><span class="p-code">${p.code}</span><div class="p-title"><h3>${esc(p.title)}</h3>${p.jp ? `<div class="jp" lang="ja">${esc(p.jp)}</div>` : ""}</div><button type="button" class="star" aria-label="Dodaj ${esc(p.title)} do planu" aria-pressed="false">☆</button></header>
<div class="p-meta">${metaBits.join("")}</div>
<div class="p-body">${paras.map((x) => md(x)).join("")}</div>
<dl class="facts">${facts}</dl>
<div class="scales">${meter("Nietypowość", st.niet)}${meter("Autentyczność", st.aut)}${st.tur ? `<span class="tur ${turLevel}">Turystyczność: ${esc(st.tur)}</span>` : ""}</div>
${rel}${srcHtml}
<div class="p-foot"><button type="button" class="onmap primary">Pokaż na mapie</button>${p.gmaps ? `<a href="${p.gmaps}" target="_blank" rel="noopener">Otwórz w Google Maps</a>` : ""}</div>
</article>`;
}

function wrapTables(html) {
  return html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, "</table></div>");
}

const counts = {};
places.forEach((p) => (counts[p.atlas] = (counts[p.atlas] || 0) + 1));
const roCount = places.filter((p) => p.ro).length;

let sectionsHtml = "";
for (const s of sections) {
  if (s.type === "atlas") {
    sectionsHtml += `<section class="section" id="atlas-${s.letter}" style="--c:${ATLAS[s.letter].color}">
<div class="kicker" style="color:${ATLAS[s.letter].color}">Atlas ${s.letter} · ${counts[s.letter]} miejsc</div>
<h2>${esc(s.title[0].toUpperCase() + s.title.slice(1))}</h2>
<div class="prose">${wrapTables(md(s.intro))}</div>
<div class="cards">${s.places.map(card).join("\n")}</div>
<div class="empty">Brak miejsc z tego atlasu przy aktualnych filtrach.</div>
</section>`;
  } else {
    const wide = ["iceberg", "dzielnice", "after-dark", "ranking"].includes(s.slug);
    sectionsHtml += `<section class="section${wide ? " wide" : ""}" id="${s.slug}">
<h2>${esc(s.title)}</h2>
<div class="prose">${wrapTables(md(s.body))}</div>
</section>`;
  }
}

const chips = Object.entries(ATLAS)
  .map(([k, a]) => `<button type="button" class="chip" data-atlas="${k}" aria-pressed="true" style="--c:${a.color}" title="${esc(a.short)}">${k}<small>${counts[k]}</small></button>`)
  .join("");
const navAtlas = Object.entries(ATLAS)
  .map(([k, a]) => `<a class="nl" href="#atlas-${k}" title="${esc(a.short)}"><span class="atlas-dot" style="--c:${a.color}"></span>${k}</a>`)
  .join("");

const dataJson = JSON.stringify({
  atlases: Object.fromEntries(Object.entries(ATLAS).map(([k, a]) => [k, { name: a.short, color: a.color }])),
  places: places.map((p) => ({ code: p.code, atlas: p.atlas, title: p.title, jp: p.jp, kind: p.kind, loc: p.loc, gmaps: p.gmaps, ro: p.ro, pts: p.pts, note: p.note })),
}).replace(/</g, "\\u003c");

const html = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tokio Underground 2026</title>
<meta name="description" content="Alternatywny atlas Tokio: 106 miejsc z mapą. Przewodnik na wyjazd 2026.">
<meta name="theme-color" content="#0d0c11">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230d0c11'/%3E%3Ccircle cx='16' cy='16' r='7' fill='%23ff4458'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&family=Shippori+Mincho+B1:wght@600;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.min.css">
<link rel="stylesheet" href="assets/style.css?v=${Date.now()}">
</head>
<body>
<header class="hero">
  <div class="hero-inner">
    <div class="kicker">Tokio · wyjazd 2026</div>
    <h1>Tokyo Underground<span class="jp" lang="ja">東京アンダーグラウンド</span></h1>
    <p class="lead">Alternatywny atlas Tokio: czarne rynki, dawne dzielnice rozrywki, miejsca kary i katastrofy, dziwne muzea i sceny, które nie trafiają do przewodników. Wszystkie ${places.length} miejsc z raportu, każde z pinezką na mapie.</p>
    <ul class="hero-stats">
      <li><b>${places.length}</b> miejsc</li><li><b>9</b> atlasów</li><li><b>${places.length - roCount}</b> do odwiedzenia</li><li><b>${roCount}</b> tylko do czytania</li><li><b>30</b> historii true crime</li>
    </ul>
    <div class="btns"><a class="btn primary" href="#mapcol">Otwórz mapę</a><a class="btn" href="#atlas-A">Przejdź do atlasu</a><a class="btn" href="#ranking">Ranking TOP 50</a></div>
  </div>
</header>
<nav class="topnav" aria-label="Nawigacja"><div class="topnav-inner">
  <a class="brand" href="#top">Tokio 2026</a>
  <a class="nl" href="#mapcol">Mapa</a><a class="nl" href="#jak-czytac">Jak czytać</a><a class="nl" href="#summary">Odkrycia</a><a class="nl" href="#iceberg">Iceberg</a>
  <span class="sep"></span>${navAtlas}<span class="sep"></span>
  <a class="nl" href="#dzielnice">Dzielnice</a><a class="nl" href="#true-crime">True crime</a><a class="nl" href="#after-dark">Nocą</a><a class="nl" href="#hidden-gems">Hidden gems</a><a class="nl" href="#read-only">Read Only</a><a class="nl" href="#ranking">TOP 50</a><a class="nl" href="#bibliografia">Źródła</a>
  <button type="button" class="plan-btn" id="plan-btn" aria-pressed="false">★ Mój plan (0)</button>
</div></nav>
<div class="shell" id="top">
  <aside class="mapcol" id="mapcol" aria-label="Mapa miejsc">
    <div class="maptools">
      <div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="q" type="search" placeholder="Szukaj: nazwa, dzielnica, kod…" aria-label="Szukaj miejsca" autocomplete="off"></div>
      <div class="chips"><button type="button" class="chip" id="chip-all">Wszystkie</button>${chips}</div>
      <div class="toolrow"><label><input type="checkbox" id="hide-ro"> Ukryj „tylko do czytania”</label><span class="count" id="count" aria-live="polite"></span></div>
    </div>
    <div id="map" role="application" aria-label="Mapa Tokio z pinezkami miejsc"></div>
  </aside>
  <main class="content">
${sectionsHtml}
  </main>
</div>
<footer class="site">
  <p>Treść: raport „Tokyo Underground: alternatywny atlas Tokio” z 7 listopada 2026, zredagowany. Oznaczenia wiarygodności: <span class="tag t-Ź">Ź</span> sprawdzone, <span class="tag t-W">W</span> wiedza ogólna, <span class="tag t-A">A</span> anegdota, <span class="tag t-L">L</span> legenda.</p>
  <p>Pinezki są orientacyjne (zwykle do ok. 300 m) i nie zastępują linków do Google Maps. Przed wizytą sprawdź godziny i status miejsca. Mapa: © OpenStreetMap.</p>
</footer>
<script id="data" type="application/json">${dataJson}</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.min.js"></script>
<script src="assets/app.js?v=${Date.now()}"></script>
</body>
</html>
`;

fs.writeFileSync(ROOT + "index.html", html);
fs.writeFileSync(ROOT + "tokyo-underground-atlas.md", src);
fs.writeFileSync(
  ROOT + "data/places.json",
  JSON.stringify(places.map((p) => ({ code: p.code, atlas: p.atlas, title: p.title, jp: p.jp, kind: p.kind, loc: p.loc, google_maps: p.gmaps, read_only: p.ro, points: p.pts.map(([l, a, b]) => ({ label: l, lat: a, lng: b })) })), null, 1)
);
console.log(`Miejsc: ${places.length} (Read Only: ${roCount}), sekcji: ${sections.length}`);
console.log(problems.length ? "PROBLEMY:\n- " + problems.join("\n- ") : "Weryfikacje OK");
