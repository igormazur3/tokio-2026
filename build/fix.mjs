import fs from 'fs';
import { FIXES } from './corrections.mjs';
let t = fs.readFileSync('source.md','utf8');
let bad = 0;
for (const [from, to, opt] of FIXES) {
  const n = t.split(from).length - 1;
  if (n === 0) { console.log('BRAK TRAFIENIA:', from.slice(0,70)); bad++; continue; }
  if (n > 1 && !opt?.all) { console.log('WIELE TRAFIEŃ (' + n + '):', from.slice(0,70)); bad++; continue; }
  t = t.split(from).join(to);
}
fs.writeFileSync('fixed.md', t);
console.log(bad ? `${bad} problemów` : 'OK, wszystkie poprawki zastosowane', FIXES.length);
