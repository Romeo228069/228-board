// Tabellen mit Formeln (HyperFormula), Zelltypen, Autofill
import { h, A, ico, loadScript, mod, clamp, inkOn } from './util.js';
import { set, get, tx } from './store.js';

const HF = 'https://cdn.jsdelivr.net/npm/hyperformula@2.7.1/dist/hyperformula.full.min.js';
export const T = { id: null, r0: 0, c0: 0, r1: 0, c1: 0, edit: false, clip: null };
const cache = new Map();
const colName = c => { let s = ''; c++; while (c) { s = String.fromCharCode(65 + ((c - 1) % 26)) + s; c = Math.floor((c - 1) / 26); } return s; };
const range = () => ({ r0: Math.min(T.r0, T.r1), r1: Math.max(T.r0, T.r1), c0: Math.min(T.c0, T.c1), c1: Math.max(T.c0, T.c1) });
export const TYPES = [['auto', 'Automatisch'], ['number', 'Zahl'], ['currency', 'Währung'], ['percent', 'Prozent'], ['checkbox', 'Checkbox'], ['text', 'Text'], ['date', 'Datum'], ['datetime', 'Datum und Zeit']];

function compute(el) {
  const c = cache.get(el.id); if (c && c.m === el.modified && c.hf === !!window.HyperFormula) return c.v;
  let v;
  if (window.HyperFormula) {
    try { const hf = HyperFormula.buildFromArray(el.cells.map(r => r.map(x => (x === '' ? null : /^-?\d+(,\d+)?$/.test(x) ? +x.replace(',', '.') : isNaN(x) || x.trim() === '' ? x : +x))), { licenseKey: 'gpl-v3' }); v = hf.getSheetValues(0); hf.destroy(); }
    catch { v = el.cells; }
  } else { v = el.cells; if (el.cells.some(r => r.some(x => String(x)[0] === '='))) loadScript(HF).then(() => { cache.delete(el.id); A.rebuild(el.id); }).catch(() => {}); }
  cache.set(el.id, { m: el.modified, v, hf: !!window.HyperFormula }); return v;
}
const ERR = { '#DIV/0!': 'Division durch null', '#NAME?': 'Unbekannte Funktion', '#REF!': 'Ungültiger Bezug', '#VALUE!': 'Falscher Werttyp', '#N/A': 'Kein Wert gefunden', '#CYCLE!': 'Zirkelbezug', '#ERROR!': 'Fehler in der Formel', '#NUM!': 'Ungültige Zahl' };
function show(raw, val, type) {
  if (val && typeof val === 'object') return { t: val.value || '#ERROR!', err: ERR[val.value] || val.message || 'Fehler' };
  if (val == null || val === '') return { t: '' };
  const num = typeof val === 'number';
  const cur = A.setting('currency', 'EUR');
  if (type === 'text') return { t: String(raw) };
  if (type === 'checkbox') return { chk: val === true || /^(true|wahr|1|x)$/i.test(String(val)) };
  if (type === 'currency' && num) return { t: val.toLocaleString('de-DE', { style: 'currency', currency: cur }), num };
  if (type === 'percent' && num) return { t: (val * 100).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' %', num };
  if ((type === 'date' || type === 'datetime')) { const d = num ? new Date(Date.UTC(1899, 11, 30) + val * 864e5) : new Date(val); if (!isNaN(d)) return { t: d.toLocaleString('de-DE', type === 'date' ? { dateStyle: 'medium', timeZone: num ? 'UTC' : undefined } : { dateStyle: 'medium', timeStyle: 'short', timeZone: num ? 'UTC' : undefined }) }; }
  if (typeof val === 'boolean') return { t: val ? 'WAHR' : 'FALSCH' };
  if (num) return { t: val.toLocaleString('de-DE', { maximumFractionDigits: 6 }), num };
  if (type === 'auto' && /^https?:\/\/\S+$/.test(val)) return { link: val };
  return { t: String(val) };
}
const save = (el, patch) => tx(() => set(el.id, patch));
const typeOf = (el, r, c) => el.types?.[r + ',' + c] || 'auto';

export function buildTable(el, n) {
  const vals = compute(el), on = T.id === el.id, R = range();
  const tbl = h('table.tbl.nodrag', { style: { width: 22 + el.cells[0].reduce((t, _, c) => t + (el.colW?.[c] || 110), 0) + 'px' } });
  tbl.append(h('colgroup', h('col', { style: { width: '22px' } }), el.cells[0].map((_, c) => h('col', { style: { width: (el.colW?.[c] || 110) + 'px' } }))));
  tbl.append(h('tr.heads', h('th.corner'), el.cells[0].map((_, c) => h('th.colh', { data: { c } }, colName(c), h('i.colrz', { data: { c } })))));
  el.cells.forEach((row, r) => tbl.append(h('tr', h('th.rowh', { data: { r } }, r + 1), row.map((raw, c) => {
    const type = typeOf(el, r, c), s = show(raw, vals[r]?.[c], type), f = el.fmt?.[r + ',' + c] || {};
    const td = h('td', { data: { r, c }, style: { color: f.color || (f.bg ? inkOn(f.bg) : ''), background: f.bg || '' }, title: s.err || null });
    if (s.chk != null) td.append(h('input', { type: 'checkbox', checked: s.chk || null, onchange: e => setCell(el, r, c, e.target.checked ? 'TRUE' : 'FALSE') }));
    else if (s.link) td.append(h('a', { href: s.link, target: '_blank', rel: 'noopener' }, s.link));
    else td.textContent = s.t;
    if (s.num) td.classList.add('num'); if (s.err) td.classList.add('err');
    if (on && r >= R.r0 && r <= R.r1 && c >= R.c0 && c <= R.c1) td.classList.add('in');
    if (on && r === T.r0 && c === T.c0) td.classList.add('cur');
    if (on && r === R.r1 && c === R.c1 && !A.readonly()) td.append(h('i.fill'));
    return td;
  }))));
  tbl.addEventListener('pointerdown', e => down(e, el, tbl));
  tbl.addEventListener('dblclick', e => { const td = e.target.closest('td'); if (td && !A.readonly()) edit(el, +td.dataset.r, +td.dataset.c); });
  tbl.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); const td = e.target.closest('td,th'); if (td?.dataset.r != null && td.dataset.c != null && !(on && td.classList.contains('in'))) select(el, +td.dataset.r, +td.dataset.c); menu(el, e, td); });
  n.append(h('div.tbl-wrap', tbl), A.readonly() ? null : h('div.tbl-add.nodrag', h('button', { title: 'Zeile hinzufügen', onclick: () => addRow(el, el.cells.length) }, '+ Zeile'), h('button', { title: 'Spalte hinzufügen', onclick: () => addCol(el, el.cells[0].length) }, '+ Spalte')));
}
function select(el, r, c, extend) { if (T.edit) commit(); T.id = el.id; if (!extend) { T.r0 = r; T.c0 = c; } T.r1 = r; T.c1 = c; A.select([el.id]); A.rebuild(el.id); }
export function clearSel() { if (T.id) { const id = T.id; if (T.edit) commit(); T.id = null; A.rebuild(id); } }

function down(e, el, tbl) {
  if (e.button === 2) return;
  const t = e.target;
  if (t.classList.contains('colrz')) { e.preventDefault(); e.stopPropagation(); const c = +t.dataset.c, x0 = e.clientX, w0 = el.colW?.[c] || 110, col = tbl.querySelectorAll('col')[c + 1];
    const mv = ev => { const nw = Math.max(40, w0 + (ev.clientX - x0) / A.zoom()); col.style.width = nw + 'px'; tbl.style.width = 22 + el.cells[0].reduce((t, _, i) => t + (i === c ? nw : el.colW?.[i] || 110), 0) + 'px'; }, up = ev => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); const cw = [...(el.colW || el.cells[0].map(() => 110))]; cw[c] = Math.max(40, Math.round(w0 + (ev.clientX - x0) / A.zoom())); save(el, { colW: cw }); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); return; }
  if (t.classList.contains('fill')) { e.preventDefault(); e.stopPropagation(); const src = range(); let last = null;
    const mv = ev => { const td = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('td'); if (td && tbl.contains(td)) { last = [+td.dataset.r, +td.dataset.c]; tbl.querySelectorAll('td.filling').forEach(x => x.classList.remove('filling')); tbl.querySelectorAll('td').forEach(x => { const r = +x.dataset.r, c = +x.dataset.c; if (r >= src.r0 && r <= Math.max(src.r1, last[0]) && c >= src.c0 && c <= Math.max(src.c1, last[1])) x.classList.add('filling'); }); } },
      up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (last) fill(el, src, Math.max(src.r1, last[0]), Math.max(src.c1, last[1])); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); return; }
  const colh = t.closest('.colh'), rowh = t.closest('.rowh');
  if (colh) { T.id = el.id; if (T.edit) commit(); T.r0 = 0; T.r1 = el.cells.length - 1; T.c0 = T.c1 = +colh.dataset.c; A.select([el.id]); A.rebuild(el.id); return; }
  if (rowh) { T.id = el.id; if (T.edit) commit(); T.c0 = 0; T.c1 = el.cells[0].length - 1; T.r0 = T.r1 = +rowh.dataset.r; A.select([el.id]); A.rebuild(el.id); return; }
  const td = t.closest('td'); if (!td || t.matches('input,a') || td.isContentEditable) return;
  e.stopPropagation(); select(el, +td.dataset.r, +td.dataset.c, e.shiftKey);
  const mv = ev => { const x = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('td'); if (x && x.dataset.r != null && (T.r1 !== +x.dataset.r || T.c1 !== +x.dataset.c) && document.querySelector(`[data-id="${el.id}"]`)?.contains(x)) { T.r1 = +x.dataset.r; T.c1 = +x.dataset.c; A.rebuild(el.id); } },
    up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
}
function cellNode(r, c) { return document.querySelector(`.el[data-id="${T.id}"] td[data-r="${r}"][data-c="${c}"]`); }
function edit(el, r, c, initial) {
  if (A.readonly() || typeOf(el, r, c) === 'checkbox') return;
  select(el, r, c); const td = cellNode(r, c); if (!td) return;
  T.edit = true; td.textContent = initial ?? el.cells[r][c]; td.contentEditable = 'plaintext-only'; if (td.contentEditable !== 'plaintext-only') td.contentEditable = 'true';
  td.classList.add('editing'); td.focus(); const s = getSelection(); s.selectAllChildren(td); s.collapseToEnd();
  td.addEventListener('blur', () => { if (T.edit) commit(); }, { once: true });
  if ((initial ?? el.cells[r][c])[0] === '=') loadScript(HF).catch(() => {});
}
function commit(cancel) {
  const el = get(T.id), td = document.querySelector(`.el[data-id="${T.id}"] td.editing`); T.edit = false; if (!el || !td) return;
  const v = td.innerText.replace(/\n$/, ''); td.contentEditable = 'false'; td.classList.remove('editing');
  if (!cancel && v !== el.cells[T.r0][T.c0]) setCell(el, T.r0, T.c0, v); else A.rebuild(el.id);
}
function setCell(el, r, c, v) { const cells = el.cells.map(x => [...x]); cells[r][c] = v; const types = { ...(el.types || {}) }; if (!types[r + ',' + c] && /^(TRUE|FALSE)$/.test(v)) types[r + ',' + c] = 'checkbox'; save(el, { cells, types }); }
const shiftRef = (f, dr, dc) => (f[0] !== '=' ? f : f.replace(/(\$?)([A-Z]{1,2})(\$?)(\d+)/g, (m, a, col, b, row) => { let ci = [...col].reduce((s, ch) => s * 26 + ch.charCodeAt(0) - 64, 0) - 1; if (!a) ci += dc; const ri = b ? +row : +row + dr; return ci < 0 || ri < 1 ? '#REF!' : a + colName(ci) + b + ri; }));
function fill(el, src, r1, c1) {
  const cells = el.cells.map(x => [...x]); const hh = src.r1 - src.r0 + 1, ww = src.c1 - src.c0 + 1;
  for (let r = src.r0; r <= r1; r++) for (let c = src.c0; c <= c1; c++) { if (r <= src.r1 && c <= src.c1) continue; const sr = src.r0 + ((r - src.r0) % hh), sc = src.c0 + ((c - src.c0) % ww); let v = el.cells[sr][sc];
    if (v[0] === '=') v = shiftRef(v, r - sr, c - sc); else if (hh === 1 && ww === 1 && /^-?\d+$/.test(v) && false) v = String(+v + (r - sr) + (c - sc));
    else if (v !== '' && !isNaN(v) && (r - sr || c - sc)) { const nxt = c > src.c1 ? el.cells[sr][src.c0 + 1 < src.c0 + ww ? src.c0 + 1 : sc] : el.cells[src.r0 + 1 < src.r0 + hh ? src.r0 + 1 : sr][sc]; const step = (c > src.c1 ? ww : hh) > 1 && !isNaN(nxt) ? +nxt - +el.cells[c > src.c1 ? sr : src.r0][c > src.c1 ? src.c0 : sc] : 0; if (step) v = String(+el.cells[c > src.c1 ? sr : src.r1][c > src.c1 ? src.c1 : sc] + step * (c > src.c1 ? c - src.c1 : r - src.r1)); }
    cells[r][c] = v; }
  T.r0 = src.r0; T.c0 = src.c0; T.r1 = r1; T.c1 = c1; save(el, { cells });
}
const remap = (obj, fn) => { const o = {}; for (const k in obj || {}) { const [r, c] = k.split(',').map(Number); const n = fn(r, c); if (n) o[n[0] + ',' + n[1]] = obj[k]; } return o; };
function addRow(el, at) { const cells = el.cells.map(x => [...x]); cells.splice(at, 0, el.cells[0].map(() => '')); const f = (r, c) => [r >= at ? r + 1 : r, c]; save(el, { cells, types: remap(el.types, f), fmt: remap(el.fmt, f) }); }
function addCol(el, at) { const cw = [...(el.colW || el.cells[0].map(() => 110))]; cw.splice(at, 0, 110); const f = (r, c) => [r, c >= at ? c + 1 : c]; save(el, { cells: el.cells.map(x => { const y = [...x]; y.splice(at, 0, ''); return y; }), colW: cw, types: remap(el.types, f), fmt: remap(el.fmt, f) }); }
function delRows(el, a, b) { if (el.cells.length - (b - a + 1) < 1) return; const f = (r, c) => (r >= a && r <= b ? null : [r > b ? r - (b - a + 1) : r, c]); T.r0 = T.r1 = clamp(a, 0, el.cells.length - (b - a + 1) - 1); save(el, { cells: el.cells.filter((_, i) => i < a || i > b), types: remap(el.types, f), fmt: remap(el.fmt, f) }); }
function delCols(el, a, b) { if (el.cells[0].length - (b - a + 1) < 1) return; const f = (r, c) => (c >= a && c <= b ? null : [r, c > b ? c - (b - a + 1) : c]); T.c0 = T.c1 = clamp(a, 0, el.cells[0].length - (b - a + 1) - 1); save(el, { cells: el.cells.map(x => x.filter((_, i) => i < a || i > b)), colW: (el.colW || el.cells[0].map(() => 110)).filter((_, i) => i < a || i > b), types: remap(el.types, f), fmt: remap(el.fmt, f) }); }
function moveRow(el, r, d) { const t = r + d; if (t < 0 || t >= el.cells.length) return; const cells = el.cells.map(x => [...x]); [cells[r], cells[t]] = [cells[t], cells[r]]; const f = (rr, c) => [rr === r ? t : rr === t ? r : rr, c]; T.r0 = T.r1 = t; save(el, { cells, types: remap(el.types, f), fmt: remap(el.fmt, f) }); }
function moveCol(el, c, d) { const t = c + d; if (t < 0 || t >= el.cells[0].length) return; const cells = el.cells.map(x => { const y = [...x]; [y[c], y[t]] = [y[t], y[c]]; return y; }); const cw = [...(el.colW || el.cells[0].map(() => 110))]; [cw[c], cw[t]] = [cw[t], cw[c]]; const f = (r, cc) => [r, cc === c ? t : cc === t ? c : cc]; T.c0 = T.c1 = t; save(el, { cells, colW: cw, types: remap(el.types, f), fmt: remap(el.fmt, f) }); }
export function setType(el, type) { const R = range(), types = { ...(el.types || {}) }; for (let r = R.r0; r <= R.r1; r++) for (let c = R.c0; c <= R.c1; c++) types[r + ',' + c] = type; save(el, { types }); }
export function setFmt(el, patch) { const R = range(), fmt = { ...(el.fmt || {}) }; for (let r = R.r0; r <= R.r1; r++) for (let c = R.c0; c <= R.c1; c++) fmt[r + ',' + c] = { ...(fmt[r + ',' + c] || {}), ...patch }; save(el, { fmt }); }
export async function formula(el, x, y) {
  await loadScript(HF).catch(() => {}); const names = window.HyperFormula ? HyperFormula.getRegisteredFunctionNames('enGB').sort() : ['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'IF'];
  A.menu(names.map(nm => ({ label: nm, act: () => { const R = range(); edit(el, T.r0, T.c0, `=${nm}(`); } })), x, y, { search: 'Funktion suchen' });
}
function copy(cut) {
  const el = get(T.id), R = range(), v = compute(el); const raw = [], val = [];
  for (let r = R.r0; r <= R.r1; r++) { raw.push(el.cells[r].slice(R.c0, R.c1 + 1)); val.push((v[r] || []).slice(R.c0, R.c1 + 1).map(x => (x == null ? '' : typeof x === 'object' ? '' : String(x)))); }
  T.clip = { raw, val, r: R.r0, c: R.c0 }; navigator.clipboard?.writeText(val.map(r => r.join('\t')).join('\n')).catch(() => {});
  if (cut) clear();
}
function clear() { const el = get(T.id), R = range(), cells = el.cells.map(x => [...x]); for (let r = R.r0; r <= R.r1; r++) for (let c = R.c0; c <= R.c1; c++) cells[r][c] = ''; save(el, { cells }); }
export function pasteGrid(el, grid, rel) {
  const R = range(); let cells = el.cells.map(x => [...x]); const cw = [...(el.colW || el.cells[0].map(() => 110))];
  grid.forEach((row, i) => row.forEach((v, j) => { const r = R.r0 + i, c = R.c0 + j; while (cells.length <= r) cells.push(cells[0].map(() => '')); while (cells[0].length <= c) { cells.forEach(x => x.push('')); cw.push(110); } cells[r][c] = rel ? shiftRef(v, r - (rel.r + i), c - (rel.c + j)) : v; }));
  T.r1 = R.r0 + grid.length - 1; T.c1 = R.c0 + Math.max(...grid.map(r => r.length)) - 1; T.r0 = R.r0; T.c0 = R.c0; save(el, { cells, colW: cw });
}
export function paste(text, valuesOnly) {
  const el = get(T.id); if (!el) return false;
  const tsv = text && text.replace(/\r/g, '').replace(/\n$/, '');
  if (T.clip && (!tsv || tsv === T.clip.val.map(r => r.join('\t')).join('\n'))) pasteGrid(el, valuesOnly ? T.clip.val : T.clip.raw, valuesOnly ? null : T.clip);
  else if (tsv) pasteGrid(el, tsv.split('\n').map(r => r.split('\t')));
  return true;
}
function menu(el, e, cell) {
  if (A.readonly()) return; const R = range(), items = [];
  const one = (l, act, extra) => items.push({ label: l, act, ...extra });
  one('Kopieren', () => copy()); one('Ausschneiden', () => copy(true));
  one('Einfügen', async () => paste(await navigator.clipboard?.readText().catch(() => ''))); one('Nur Werte einfügen', async () => paste(await navigator.clipboard?.readText().catch(() => ''), true));
  items.push('-');
  one('Zeile darüber einfügen', () => addRow(el, R.r0)); one('Zeile darunter einfügen', () => addRow(el, R.r1 + 1));
  one('Spalte links einfügen', () => addCol(el, R.c0)); one('Spalte rechts einfügen', () => addCol(el, R.c1 + 1));
  items.push('-');
  one('Zeile nach oben', () => moveRow(el, T.r0, -1)); one('Zeile nach unten', () => moveRow(el, T.r0, 1)); one('Spalte nach links', () => moveCol(el, T.c0, -1)); one('Spalte nach rechts', () => moveCol(el, T.c0, 1));
  items.push('-');
  one(R.r1 > R.r0 ? 'Zeilen löschen' : 'Zeile löschen', () => delRows(el, R.r0, R.r1), { danger: true }); one(R.c1 > R.c0 ? 'Spalten löschen' : 'Spalte löschen', () => delCols(el, R.c0, R.c1), { danger: true });
  A.menu(items, e.clientX, e.clientY);
}
// Tastatur, wenn eine Zelle ausgewählt ist
export function key(e) {
  const el = get(T.id); if (!el) return false; const rows = el.cells.length, cols = el.cells[0].length, k = e.key;
  if (T.edit) {
    if (k === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); const r = Math.min(rows - 1, T.r0 + 1); select(get(T.id), r, T.c0); return true; }
    if (k === 'Tab') { e.preventDefault(); commit(); select(get(T.id), T.r0, clamp(T.c0 + (e.shiftKey ? -1 : 1), 0, cols - 1)); return true; }
    if (k === 'Escape') { e.preventDefault(); commit(true); return true; }
    return true;
  }
  if (A.readonly()) return false;
  const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (arrows[k]) { e.preventDefault(); const [dr, dc] = arrows[k];
    if (e.altKey) { dr ? addRow(el, dr > 0 ? T.r0 + 1 : T.r0) : addCol(el, dc > 0 ? T.c0 + 1 : T.c0); return true; }
    if (e.shiftKey) { T.r1 = clamp(T.r1 + dr, 0, rows - 1); T.c1 = clamp(T.c1 + dc, 0, cols - 1); A.rebuild(el.id); return true; }
    if (mod(e)) select(el, dr ? (dr > 0 ? rows - 1 : 0) : T.r0, dc ? (dc > 0 ? cols - 1 : 0) : T.c0); else select(el, clamp(T.r0 + dr, 0, rows - 1), clamp(T.c0 + dc, 0, cols - 1));
    return true; }
  if (k === 'Enter' || k === 'F2') { e.preventDefault(); edit(el, T.r0, T.c0); return true; }
  if (k === 'Tab') { e.preventDefault(); select(el, T.r0, clamp(T.c0 + (e.shiftKey ? -1 : 1), 0, cols - 1)); return true; }
  if (k === 'Backspace' || k === 'Delete') { e.preventDefault(); clear(); return true; }
  if (k === 'Escape') { clearSel(); return true; }
  if (mod(e) && k.toLowerCase() === 'c') { copy(); return true; } if (mod(e) && k.toLowerCase() === 'x') { copy(true); return true; }
  if (mod(e) && k.toLowerCase() === 'a') { e.preventDefault(); T.r0 = T.c0 = 0; T.r1 = rows - 1; T.c1 = cols - 1; A.rebuild(el.id); return true; }
  if (k.length === 1 && !mod(e) && !e.altKey) { e.preventDefault(); edit(el, T.r0, T.c0, k); return true; }
  return false;
}
