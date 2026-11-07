import fs from 'fs';
import { COORDS } from './coords.mjs';
const src = fs.readFileSync('source.md','utf8');
const re = /^### ([A-I]\d+)\. (.+)$/gm;
const items = []; let m;
while ((m = re.exec(src))) {
  const seg = src.slice(m.index, src.indexOf('\n### ', m.index + 5) > 0 ? src.indexOf('\n### ', m.index + 5) : undefined);
  const q = seg.match(/query=([^)\s]+)/);
  items.push({ code: m[1], q: q ? decodeURIComponent(q[1]).replace(/\+/g,' ') : null });
}
const dist = (a,b)=>{const R=6371e3,t=Math.PI/180;const dLa=(b[0]-a[0])*t,dLo=(b[1]-a[1])*t;const x=Math.sin(dLa/2)**2+Math.cos(a[0]*t)*Math.cos(b[0]*t)*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(x));};
const out = {};
for (const it of items) {
  if (!it.q) { console.log(it.code, '— brak zapytania'); continue; }
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(it.q)}&format=json&limit=1&countrycodes=jp&viewbox=139.2,35.9,140.0,35.4`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'tokio-2026-guide/1.0 (private trip guide)' } });
    const j = await r.json();
    const c = COORDS[it.code]; const mine = Array.isArray(c) ? c : c.pts[0].slice(1);
    if (!j.length) { console.log(it.code, it.q, '→ brak wyniku'); }
    else { const g=[+j[0].lat,+j[0].lon]; const d=Math.round(dist(mine,g)); out[it.code]={g,d,name:j[0].display_name.slice(0,60)}; console.log(it.code, it.q, '→', g.join(','), d+'m', j[0].display_name.slice(0,50)); }
  } catch(e){ console.log(it.code,'błąd',e.message); }
  await new Promise(r=>setTimeout(r,1100));
}
fs.writeFileSync('geo-check.json', JSON.stringify(out,null,1));
