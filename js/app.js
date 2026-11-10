// Kern: Leinwand, Darstellung, Auswahl, Ziehen, Linien, Tastatur, Zwischenablage
import { A, $, $$, h, ico, clamp, mod, debounce, isUrl, fixUrl, hexNorm, esc, textOf, palette, colorName } from './util.js';
import { S, open, tx, set, get, add, del, kids, colKids, all, path, uid, now, kv, kvSet, seal, undo, redo, maxZ, cloneEls, putBlob, realBoard, descendants } from './store.js';
import { build, sig, DEF_W, NAMES } from './cards.js';
import { richKey, toggleCheck, pastePlain, hexChips } from './rich.js';
import * as table from './table.js';
import { openPad } from './sketch.js';
import { initUI, refreshUI } from './ui.js';
import { initActions } from './actions.js';
import { initSync } from './sync.js';

const stage = $('#stage'), world = $('#world'), cards = $('#cards'), svg = $('#lines'), labels = $('#labels'), marq = $('#marquee');
const V = (A.view = { x: 0, y: 0, z: 1 });
A.sel = new Set(); A.board = 'home'; A.editing = null; A.mode = { present: false, lockEdit: true, hideComments: false, focus: false }; A.hist = []; A.hpos = -1; A.role = 'edit';
const GRID = () => [10, 20, 30][A.setting('gridSize', 1)];
const snap = v => (A.setting('snap', true) ? Math.round(v / GRID()) * GRID() : Math.round(v));

/* Einstellungen und Personen */
A.setting = (k, d) => { const s = kv('settings', {}); return k in s ? s[k] : d; };
A.setSetting = (k, v) => { kvSet('settings', { ...kv('settings', {}), [k]: v }); applySettings(); };
A.me = () => kv('me', 'Ich');
A.people = () => [...new Set([A.me(), ...kv('people', [])])];
A.addPerson = p => kvSet('people', [...new Set([...kv('people', []), p.trim()])]);
A.avatarColor = name => `hsl(${[...(name || '?')].reduce((s, c) => s + c.charCodeAt(0) * 7, 0) % 360} 65% 50%)`;
A.readonly = () => A.role === 'view' || A.role === 'comment' || (A.mode.present && A.mode.lockEdit);
A.canComment = () => A.role !== 'view' && !(A.mode.present && A.mode.lockEdit);
A.hideComments = () => A.mode.present && A.mode.hideComments;
A.zoom = () => V.z;
A.activity = () => null;
function applySettings() {
  const d = document.documentElement;
  const dark = A.setting('dark', 'auto'); d.dataset.theme = dark === 'auto' ? '' : dark ? 'dark' : 'light';
  d.style.setProperty('--ui', [0.9, 1, 1.12, 1.25][A.setting('uiSize', 1)]);
  d.classList.toggle('nogrid', !A.setting('showGrid', true)); d.classList.toggle('serif', !A.setting('sans', true)); d.classList.toggle('nohelp', !A.setting('helpers', true));
  applyView();
}

/* Ansicht */
const saveView = debounce(() => kvSet('views', { ...kv('views', {}), [A.board]: { ...V } }), 400);
function applyView() {
  world.style.transform = `translate(${V.x}px,${V.y}px) scale(${V.z})`;
  const g = GRID() * 2 * V.z; stage.style.backgroundSize = `${g}px ${g}px`; stage.style.backgroundPosition = `${V.x}px ${V.y}px`;
  stage.style.setProperty('--dot', clamp(V.z, 0.5, 1.5) + 'px'); stage.style.setProperty('--iz', 1 / V.z);
  const zl = $('#zoomLabel'); if (zl) zl.textContent = Math.round(V.z * 100) + ' %';
  saveView();
}
A.toWorld = (cx, cy) => { const r = stage.getBoundingClientRect(); return [(cx - r.left - V.x) / V.z, (cy - r.top - V.y) / V.z]; };
A.zoomAt = (f, cx, cy, abs) => { const r = stage.getBoundingClientRect(); cx ??= r.left + r.width / 2; cy ??= r.top + r.height / 2; const nz = clamp(abs ? f : V.z * f, 0.05, 4), px = cx - r.left, py = cy - r.top; V.x = px - ((px - V.x) * nz) / V.z; V.y = py - ((py - V.y) * nz) / V.z; V.z = nz; applyView(); };
const wrect = n => { const r = n.getBoundingClientRect(), s = stage.getBoundingClientRect(); return { x: (r.left - s.left - V.x) / V.z, y: (r.top - s.top - V.y) / V.z, w: r.width / V.z, h: r.height / V.z }; };
A.wrect = wrect;
A.fit = (ids) => {
  const ns = ids ? ids.map(node).filter(Boolean) : $$('#cards > .el'); const r = stage.getBoundingClientRect();
  if (!ns.length) { V.x = r.width / 2 - 200; V.y = 120; V.z = 1; return applyView(); }
  let b = [1e9, 1e9, -1e9, -1e9]; ns.forEach(n => { const w = wrect(n); b = [Math.min(b[0], w.x), Math.min(b[1], w.y), Math.max(b[2], w.x + w.w), Math.max(b[3], w.y + w.h)]; });
  all().filter(e => e.type === 'line' && e.board === A.board && e.loc === 'canvas' && !ids).forEach(l => ['a', 'b'].forEach(k => { if (l[k].el == null) b = [Math.min(b[0], l[k].x), Math.min(b[1], l[k].y), Math.max(b[2], l[k].x), Math.max(b[3], l[k].y)]; }));
  const pad = innerWidth < 700 ? 24 : 90, z = clamp(Math.min((r.width - pad * 2) / (b[2] - b[0] || 1), (r.height - pad * 2 - 40) / (b[3] - b[1] || 1)), 0.05, ids ? 2 : 1);
  V.z = z; V.x = (r.width - (b[2] - b[0]) * z) / 2 - b[0] * z; V.y = (r.height - (b[3] - b[1]) * z) / 2 - b[1] * z + 16; applyView();
};
A.center = () => { const r = stage.getBoundingClientRect(); return A.toWorld(r.left + r.width / 2, r.top + r.height / 2); };

/* Darstellung */
const node = id => cards.querySelector(`.el[data-id="${id}"]`) || $(`.el[data-id="${id}"]`);
A.node = node;
function reconcile(container, els, abs) {
  const have = new Map(); for (const c of container.children) if (c.dataset.id) have.set(c.dataset.id, c);
  let prev = null;
  for (const el of els) {
    let n = have.get(el.id); have.delete(el.id);
    if (!n || n._force || (n._m !== sig(el) && !(A.editing && n.contains(A.editing)))) { const nn = build(el); if (n) n.replaceWith(nn); n = nn; }
    if (abs) { n.style.left = (el.x || 0) + 'px'; n.style.top = (el.y || 0) + 'px'; n.style.zIndex = el.type === 'column' ? 0 : 1; } else { n.style.left = n.style.top = ''; }
    if (n.parentNode !== container || n.previousElementSibling !== prev) prev ? prev.after(n) : container.prepend(n);
    prev = n;
    const cb = n.querySelector(':scope > .col-body'); if (cb) reconcile(cb, colKids(el.id), false);
  }
  have.forEach(n => n.remove());
}
A.render = function render() {
  let b = get(A.board); if (!b || b.type !== 'board') { A.board = 'home'; b = get('home'); }
  const list = kids(A.board).filter(e => e.type !== 'line' && !(e.pin && get(e.pin) && !A.hideComments()) && !(A.hideComments() && e.type === 'comment')).sort((a, c) => (a.z || 0) - (c.z || 0));
  reconcile(cards, list, true);
  const up = $('#unsortedList'); if (up && !$('#unsorted').hidden) reconcile(up, kids(A.board, 'unsorted').sort((a, c) => (c.modified || 0) - (a.modified || 0)), false);
  stage.style.backgroundColor = b.bg || '';
  stage.classList.toggle('darkbg', !!b.bg && parseInt(b.bg.slice(1, 3), 16) * 0.3 + parseInt(b.bg.slice(3, 5), 16) * 0.59 + parseInt(b.bg.slice(5, 7), 16) * 0.11 < 110);
  for (const id of [...A.sel]) if (!get(id) || get(id).loc === 'trash') A.sel.delete(id);
  $$('.el.sel').forEach(n => !A.sel.has(n.dataset.id) && n.classList.remove('sel')); A.sel.forEach(id => $$(`.el[data-id="${id}"]`).forEach(n => n.classList.add('sel')));
  drawLines(); A.paintPeers?.(); refreshUI();
};
A.rebuild = (id, focus) => { const n = node(id); if (n) n._force = true; if (A.editing && n?.contains(A.editing)) { const ed = A.editing; A.editing = null; ed._commit?.(ed); } A.render(); if (focus) { const t = node(id)?.querySelector(focus.sel); if (t) A.startEdit(t, null, focus.pos); } };
A.select = (ids, add) => { if (!add) A.sel.clear(); ids.forEach(i => A.sel.add(i)); if (table.T.id && !A.sel.has(table.T.id)) table.clearSel(); $$('.el.sel').forEach(n => !A.sel.has(n.dataset.id) && n.classList.remove('sel')); A.sel.forEach(id => $$(`.el[data-id="${id}"]`).forEach(n => n.classList.add('sel'))); drawLines(); refreshUI(); };
A.selEls = () => [...A.sel].map(get).filter(Boolean);

/* Linien */
const NS = 'http://www.w3.org/2000/svg';
function endPt(l, k, other) {
  const e = l[k], n = e.el && node(e.el);
  if (!n) return { x: e.x ?? 0, y: e.y ?? 0, free: !e.el };
  const r = wrect(n); if (e.ax != null) return { x: r.x + r.w * e.ax, y: r.y + r.h * e.ay, r };
  return { x: r.x + r.w / 2, y: r.y + r.h / 2, r, auto: true };
}
function clip(p, toward) { const r = p.r, g = 6, cx = p.x, cy = p.y, dx = toward.x - cx, dy = toward.y - cy; if (!dx && !dy) return p; const tx_ = dx ? (r.w / 2 + g) / Math.abs(dx) : 1e9, ty = dy ? (r.h / 2 + g) / Math.abs(dy) : 1e9, t = Math.min(tx_, ty, 1); return { x: cx + dx * t, y: cy + dy * t }; }
export function lineGeom(l) {
  let a = endPt(l, 'a'), b = endPt(l, 'b');
  const mid0 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, bend = l.bend || { x: 0, y: 0 }, c = { x: mid0.x + 2 * bend.x, y: mid0.y + 2 * bend.y };
  if (a.auto) a = clip(a, l.bend ? c : b); if (b.auto) b = clip(b, l.bend ? c : a);
  const m = { x: (a.x + b.x) / 2 + bend.x, y: (a.y + b.y) / 2 + bend.y }, cc = { x: 2 * m.x - (a.x + b.x) / 2, y: 2 * m.y - (a.y + b.y) / 2 };
  return { a, b, m, c: cc, d: l.bend ? `M${a.x} ${a.y} Q${cc.x} ${cc.y} ${b.x} ${b.y}` : `M${a.x} ${a.y} L${b.x} ${b.y}` };
}
const head = (p, from, w) => { const an = Math.atan2(p.y - from.y, p.x - from.x), s = 7 + w * 2.2, q = (d, o) => `${p.x - Math.cos(an + o) * d} ${p.y - Math.sin(an + o) * d}`; return `M${q(s, 0.42)} L${p.x} ${p.y} L${q(s, -0.42)}`; };
function drawLines() {
  const ls = all().filter(e => e.type === 'line' && e.board === A.board && e.loc === 'canvas');
  let out = ''; const seen = new Set();
  for (const l of ls) {
    const g = lineGeom(l), w = l.width || 2, col = l.color || 'var(--line)', on = A.sel.has(l.id);
    out += `<g data-id="${l.id}" class="ln${on ? ' sel' : ''}"><path class="lhit" d="${g.d}"/><path class="lvis" d="${g.d}" stroke="${col}" stroke-width="${w}" ${l.dash ? `stroke-dasharray="${w * 3} ${w * 2.5}"` : ''}/>`;
    if (l.headB !== false) out += `<path class="lvis" d="${head(g.b, l.bend ? g.c : g.a, w)}" stroke="${col}" stroke-width="${w}"/>`;
    if (l.headA) out += `<path class="lvis" d="${head(g.a, l.bend ? g.c : g.b, w)}" stroke="${col}" stroke-width="${w}"/>`;
    if (on && !A.readonly()) out += `<circle class="lend" data-end="a" cx="${g.a.x}" cy="${g.a.y}" r="6"/><circle class="lend" data-end="b" cx="${g.b.x}" cy="${g.b.y}" r="6"/><circle class="lmid" cx="${g.m.x}" cy="${g.m.y}" r="5"/>`;
    out += '</g>';
    if (l.label != null || (A.editing && A.editing.dataset.line === l.id)) {
      seen.add(l.id); let n = labels.querySelector(`[data-line="${l.id}"]`);
      if (!n) { n = h('div.linelabel.ed.plain', { data: { line: l.id, ph: 'Beschriftung' } }); n._commit = nd => { const v = nd.innerText.trim(); if (get(l.id) && (get(l.id).label || '') !== v) tx(() => set(l.id, { label: v }), { merge: 'ed:' + l.id }); }; n._done = () => { if (!get(l.id)?.label) tx(() => set(l.id, { label: null }), { undo: false }); }; labels.append(n); }
      if (n !== A.editing) n.textContent = l.label || ''; n.style.left = g.m.x + 'px'; n.style.top = g.m.y + 'px'; n.style.color = l.color || '';
    }
  }
  if (A.tmpLine) out += `<path class="lvis tmp" d="${A.tmpLine}" stroke="var(--accent)" stroke-width="2"/>`;
  svg.innerHTML = out;
  $$('.linelabel', labels).forEach(n => !seen.has(n.dataset.line) && n.remove());
}
A.drawLines = drawLines;

/* Bearbeiten von Textfeldern */
let editH = 0;
A.startEdit = (n, pt, pos) => {
  if (!n || (A.readonly() && !n.closest('.el-comment')) || n.isContentEditable) return;
  const card = n.closest('.el'); if (card && get(card.dataset.id)?.loc === 'trash') return;
  if (A.editing && A.editing !== n) finishEdit(A.editing);
  n.contentEditable = n.dataset.rich ? 'true' : 'plaintext-only'; if (n.contentEditable !== 'plaintext-only' && !n.dataset.rich) n.contentEditable = 'true';
  n.querySelectorAll?.('.hexchip').forEach(s => s.replaceWith(s.textContent));
  if (n.dataset.rich && !n.textContent && !n.querySelector('li,hr,img')) n.innerHTML = '<p><br></p>';
  A.editing = n; n.focus({ preventScroll: true }); editH = card ? card.offsetHeight : 0;
  const s = getSelection(); let r = null;
  if (pt && document.caretRangeFromPoint) r = document.caretRangeFromPoint(pt[0], pt[1]);
  if (r && n.contains(r.startContainer)) { s.removeAllRanges(); s.addRange(r); }
  else if (pos != null) { r = document.createRange(); const tn = n.firstChild; if (tn && tn.nodeType === 3) { r.setStart(tn, Math.min(pos, tn.length)); r.collapse(true); s.removeAllRanges(); s.addRange(r); } }
  else { s.selectAllChildren(n); if (!n.dataset.all) s.collapseToEnd(); }
  refreshUI();
};
function finishEdit(n) {
  if (A.holdEdit || !n) return;
  n.contentEditable = 'false'; n._commit?.(n); seal(); if (A.editing === n) A.editing = null;
  if (n.dataset.rich) hexChips(n);
  const done = n._done; getSelection().removeAllRanges();
  done?.(); A.render();
}
A.stopEdit = () => { if (A.editing) { const n = A.editing; n.blur(); if (A.editing === n) finishEdit(n); } };
const commitSoon = debounce(n => { if (A.editing === n) { n._commit?.(n); pushDown(n); } }, 350);
function pushDown(n) {
  if (!A.setting('noOverlap', true)) return; const card = n.closest('#cards > .el'); if (!card) return; const hh = card.offsetHeight, d = hh - editH; if (!d || !editH) { editH = hh; return; }
  const el = get(card.dataset.id), x0 = el.x, x1 = el.x + card.offsetWidth, bottom = el.y + editH; editH = hh;
  const below = kids(A.board).filter(e => e.id !== el.id && e.type !== 'line' && !e.locked && e.y >= bottom - 2 && e.y < bottom + 60 + Math.max(0, -d) && e.x < x1 && e.x + (node(e.id)?.offsetWidth || 0) > x0);
  if (below.length) tx(() => below.forEach(e => set(e.id, { y: e.y + d })), { merge: 'ed:' + el.id });
}
document.addEventListener('input', e => { const n = e.target.closest?.('.ed'); if (n && n === A.editing) commitSoon(n); });
document.addEventListener('focusout', e => { const n = e.target; if (n === A.editing) setTimeout(() => { if (A.editing === n && document.activeElement !== n) finishEdit(n); }, 0); });
document.addEventListener('keydown', e => {
  const n = A.editing; if (!n || e.target !== n) return;
  e.stopPropagation();
  if (n._key && n._key(e, n)) return;
  if (e.key === 'Escape') { e.preventDefault(); return A.stopEdit(); }
  if (e.key === 'Enter' && mod(e)) { e.preventDefault(); const id = n.closest('.el')?.dataset.id; A.stopEdit(); if (id) A.act('next', [id]); return; }
  if (e.key === 'Enter' && !e.shiftKey && (n.dataset.single || n.classList.contains('linelabel') || n.classList.contains('btitle') || n.classList.contains('ctitle'))) { e.preventDefault(); return A.stopEdit(); }
  if ((e.key === 'Backspace' || e.key === 'Delete') && n.dataset.rich && !n.textContent && n.closest('.el-note') && !n.querySelector('li,hr')) { e.preventDefault(); const id = n.closest('.el').dataset.id; A.stopEdit(); A.act('delete', [id]); return; }
  if (n.dataset.rich) richKey(e, n);
}, true);
document.addEventListener('paste', e => { const n = A.editing; if (n && e.target.closest?.('.ed') === n) { e.stopPropagation(); pastePlain(e, n); } }, true);
document.addEventListener('click', e => { if (e.target.closest('ul.chk') && !A.readonly()) { const n = e.target.closest('.ed'); if (toggleCheck(e) && n) { n._commit?.(n); seal(); } } const a = e.target.closest('.rt a'); if (a && !a.closest('[contenteditable="true"]')) { e.preventDefault(); window.open(a.href, '_blank', 'noopener'); } });

/* Elemente anlegen */
A.create = (type, pt, extra = {}, opts = {}) => {
  const [cx, cy] = pt || A.center(); const w = DEF_W[type];
  const el = { id: uid(), type, board: A.board, loc: 'canvas', x: snap(cx - (pt ? 0 : (w || 200) / 2)), y: snap(cy), z: maxZ(A.board) + 1, ...(w ? { w } : {}) };
  if (type === 'todo') el.items = [{ id: uid(), text: '', done: false }];
  if (type === 'table') { el.cells = [['', '', ''], ['', '', ''], ['', '', '']]; el.colW = [110, 110, 110]; }
  if (type === 'sketch') { el.strokes = []; el.vw = 400; el.vh = 300; }
  if (type === 'swatch') { const pals = kids(A.board).filter(e => e.pal?.length).flatMap(e => e.pal), used = new Set(kids(A.board).filter(e => e.type === 'swatch').map(e => e.hex)); el.hex = pals.find(c => !used.has(c)) || ['#0a84ff', '#ff6b5e', '#ffd60a', '#30d158', '#5e5ce6'][used.size % 5]; }
  if (type === 'line') { delete el.x; delete el.y; el.a = { x: snap(cx - 80), y: snap(cy + 40) }; el.b = { x: snap(cx + 80), y: snap(cy - 40) }; el.headB = true; }
  if (type === 'comment') el.thread = [];
  Object.assign(el, extra);
  tx(() => add(el)); A.select([el.id]);
  if (!opts.quiet) { const n = node(el.id), f = n?.querySelector(type === 'comment' ? '.draft' : '.ed, .urlin'); if (f?.classList.contains('ed')) A.startEdit(f); else f?.focus(); }
  return el;
};
async function imageDims(blob) { try { const b = await createImageBitmap(blob); const r = { nw: b.width, nh: b.height }; b.close?.(); return r; } catch { return {}; } }
A.addFiles = async (files, pt, target = {}) => {
  files = [...files]; if (!files.length) return; const [cx, cy] = pt || A.center(); const made = [];
  const imgs = files.filter(f => /^image\//.test(f.type)).length, cols = imgs > 1 ? Math.min(4, Math.ceil(Math.sqrt(imgs))) : 1, cw = imgs > 1 ? 240 : 320, colY = Array(cols).fill(cy); let ci = 0, oy = cy;
  for (const f of files) {
    const base = { id: uid(), board: target.board || A.board, loc: target.loc || 'canvas', col: target.col || null, z: maxZ(A.board) + 1 + made.length };
    if (/\.(url|webloc)$/i.test(f.name)) { const t = await f.text(), m = /URL=(\S+)|<string>([^<]+)<\/string>/.exec(t); if (m) made.push({ ...base, type: 'link', url: m[1] || m[2], w: 280, x: snap(cx), y: snap(oy), title: f.name.replace(/\.\w+$/, '') }); oy += 140; continue; }
    const blob = await putBlob(f);
    if (/^image\//.test(f.type)) { const d = await imageDims(f); const k = colY.indexOf(Math.min(...colY)); const hgt = d.nw ? (cw * d.nh) / d.nw : cw; made.push({ ...base, type: 'image', src: blob, name: f.name, w: cw, ...d, x: snap(cx + k * (cw + 20)), y: snap(colY[k]) }); colY[k] += hgt + 20; ci++; }
    else if (/^video\//.test(f.type)) { made.push({ ...base, type: 'video', blob, name: f.name, size: f.size, mime: f.type, w: 400, x: snap(cx), y: snap(oy) }); oy += 260; }
    else if (/^audio\//.test(f.type)) { made.push({ ...base, type: 'audio', blob, name: f.name.replace(/\.\w+$/, ''), size: f.size, mime: f.type, w: 300, x: snap(cx), y: snap(oy) }); oy += 120; }
    else { made.push({ ...base, type: 'file', blob, name: f.name, size: f.size, mime: f.type, w: 240, view: 'icon', x: snap(cx + (imgs ? cols * (cw + 20) : 0)), y: snap(oy) }); oy += 90; }
  }
  if (target.col) { let o = colKids(target.col).length; made.forEach(m => (m.ord = o++)); }
  tx(() => made.forEach(add)); if (!target.board || target.board === A.board) A.select(made.map(m => m.id));
  if (target.loc === 'unsorted') A.toggleUnsorted(true);
  return made;
};
A.attachBlob = async (id, f) => { const blob = await putBlob(f); tx(() => set(id, { blob, name: f.name.replace(/\.\w+$/, ''), size: f.size, mime: f.type })); };
A.pickFile = (accept, cb, multi) => { const i = h('input', { type: 'file', accept, multiple: multi || null, style: { display: 'none' } }); i.onchange = () => { multi ? cb(i.files) : i.files[0] && cb(i.files[0]); i.remove(); }; document.body.append(i); i.click(); };

/* Navigation */
A.openBoard = (id, focusEl, noHist) => {
  const b = realBoard(get(id)); if (!b || b.type !== 'board') return A.toast('Dieses Board ist nicht mehr verfügbar');
  A.stopEdit(); A.closePin?.(); table.clearSel(); A.board = b.id; A.sel.clear(); A.role = A.roleFor?.(b.id) || 'edit';
  if (!noHist) { A.hist = A.hist.slice(0, A.hpos + 1); A.hist.push(b.id); A.hpos = A.hist.length - 1; }
  const rec = kv('recent', []).filter(x => x !== b.id); rec.unshift(b.id); kvSet('recent', rec.slice(0, 30));
  if (location.hash !== '#/b/' + b.id) history.replaceState(null, '', '#/b/' + b.id);
  cards.innerHTML = ''; A.render();
  const v = kv('views', {})[b.id]; if (v && !focusEl) { Object.assign(V, v); applyView(); } else A.fit();
  if (focusEl && get(focusEl)) { A.select([focusEl]); const n = node(focusEl); if (n) { A.fit([focusEl]); if (V.z > 1) A.zoomAt(1, null, null, true); } }
  document.title = (b.title || 'Board') + ' · 228 Board';
  A.onBoard?.(b);
};
A.back = () => { if (A.hpos > 0) A.openBoard(A.hist[--A.hpos], null, true); };
A.forward = () => { if (A.hpos < A.hist.length - 1) A.openBoard(A.hist[++A.hpos], null, true); };
A.up = () => { const p = path(A.board); if (p.length > 1) A.openBoard(p[p.length - 2].id); };

/* Zeiger */
const ptrs = new Map(); let G = null, spaceDown = false, spacePanned = false, lastPt = [0, 0], holdT = null, pressT = null;
const elOf = t => t.closest?.('.el');
const isTouch = e => e.pointerType === 'touch';
const NOD = '.nodrag,input,textarea,select,button,a,video,audio,[contenteditable="true"],[contenteditable="plaintext-only"]';
stage.addEventListener('pointerdown', down); $('#unsorted').addEventListener('pointerdown', down);
addEventListener('pointermove', move, { passive: false }); addEventListener('pointerup', up); addEventListener('pointercancel', up);
stage.addEventListener('touchstart', e => { if (!e.target.closest(NOD) && !e.target.closest('.tbl-wrap')) e.preventDefault(); }, { passive: false });

function down(e) {
  lastPt = [e.clientX, e.clientY];
  if (A.pad) return;
  ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (ptrs.size === 2) { clearTimeout(pressT); cancelG(); const [p, q] = [...ptrs.values()]; G = { k: 'pinch', d: Math.hypot(p[0] - q[0], p[1] - q[1]), z: V.z, mx: (p[0] + q[0]) / 2, my: (p[1] + q[1]) / 2 }; return; }
  const t = e.target, inUn = !!t.closest('#unsorted');
  if (e.button === 1 || (spaceDown && !inUn)) { e.preventDefault(); A.stopEdit(); spacePanned = true; G = { k: 'pan', x: e.clientX, y: e.clientY }; stage.classList.add('panning'); return; }
  if (e.button === 2) return;
  if (t.closest('.pinpop')) return;
  const ln = t.closest?.('g.ln'), lab = t.closest('.linelabel');
  if (t.classList.contains('lend')) { e.preventDefault(); const id = ln.dataset.id; G = { k: 'lend', id, end: t.dataset.end, before: structuredClone(get(id)) }; return; }
  if (t.classList.contains('lmid')) { e.preventDefault(); G = { k: 'bend', id: ln.dataset.id }; return; }
  if (ln || lab) { if (lab && lab.isContentEditable) return; const id = ln ? ln.dataset.id : lab.dataset.line; A.stopEdit(); pick(id, e); G = { k: 'maybe', id, x: e.clientX, y: e.clientY, line: true, lab }; return; }
  const n = elOf(t);
  if (n && t.classList.contains('rz') && !A.readonly()) { e.preventDefault(); e.stopPropagation(); const el = get(n.dataset.id); A.select([el.id]); G = { k: 'resize', id: el.id, n, x: e.clientX, w: n.offsetWidth, last: e.timeStamp }; return; }
  if (n && t.classList.contains('lh') && !A.readonly()) { e.preventDefault(); G = { k: 'lnew', from: n.dataset.id }; return; }
  if (n && t.closest('.grip') && !A.readonly()) { e.preventDefault(); const task = t.closest('.task'); G = { k: 'task', id: n.dataset.id, i: +task.dataset.i, node: task, alt: e.altKey }; task.classList.add('lifting'); return; }
  if (t.closest(NOD)) { if (n && !A.sel.has(n.dataset.id) && !t.closest('.pins,.rxs,.labels')) { A.stopEdit(); A.select([n.dataset.id]); } return; }
  if (n) {
    const id = n.dataset.id, was = A.sel.has(id) && A.sel.size === 1;
    if (A.editing && !n.contains(A.editing)) A.stopEdit();
    if (A.mode.present && A.mode.focus) { A.fit([id]); return; }
    pick(id, e);
    if (table.T.id && table.T.id !== id) table.clearSel();
    G = { k: 'maybe', id, x: e.clientX, y: e.clientY, was, t, inUn, alt: e.altKey, add: e.shiftKey || mod(e) };
    if (isTouch(e)) pressT = setTimeout(() => { if (G?.k === 'maybe') { G = null; A.ctxMenu(e.clientX, e.clientY); } }, 550);
    return;
  }
  if (inUn) return;
  A.stopEdit(); table.clearSel(); A.closePin?.();
  if (isTouch(e)) { G = { k: 'pan', x: e.clientX, y: e.clientY, tap: true, x0: e.clientX, y0: e.clientY, t0: e.timeStamp }; pressT = setTimeout(() => { if (G?.tap) { G = { k: 'marq', x: e.clientX, y: e.clientY, keep: new Set() }; navigator.vibrate?.(8); } }, 450); return; }
  if (!(e.shiftKey || mod(e))) A.select([]);
  G = { k: 'marq', x: e.clientX, y: e.clientY, keep: new Set(A.sel) };
}
function pick(id, e) { if (e.shiftKey || mod(e)) { const el = get(id); if (e.shiftKey && el?.col) { const sibs = colKids(el.col).map(x => x.id), last = [...A.sel].reverse().find(s => sibs.includes(s)); if (last) { const [a, b] = [sibs.indexOf(last), sibs.indexOf(id)].sort((x, y) => x - y); return A.select(sibs.slice(a, b + 1), true); } } if (A.sel.has(id)) { A.sel.delete(id); A.select([...A.sel]); } else A.select([id], true); } else if (!A.sel.has(id)) A.select([id]); }
function cancelG() { clearTimeout(holdT); clearTimeout(pressT); if (G?.k === 'drag') endDrag(null, true); marq.hidden = true; G = null; A.tmpLine = null; stage.classList.remove('panning'); }

function move(e) {
  lastPt = [e.clientX, e.clientY];
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (!G) return;
  if (G.k === 'pinch') { if (ptrs.size < 2) return; const [p, q] = [...ptrs.values()], d = Math.hypot(p[0] - q[0], p[1] - q[1]), mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; V.x += mx - G.mx; V.y += my - G.my; G.mx = mx; G.my = my; A.zoomAt(G.z * (d / G.d), mx, my, true); return; }
  if (G.k === 'pan') { if (G.tap && Math.hypot(e.clientX - G.x0, e.clientY - G.y0) > 6) { G.tap = false; clearTimeout(pressT); } V.x += e.clientX - G.x; V.y += e.clientY - G.y; G.x = e.clientX; G.y = e.clientY; applyView(); return; }
  if (G.k === 'maybe') { if (Math.hypot(e.clientX - G.x, e.clientY - G.y) < 5) return; clearTimeout(pressT); if (A.readonly() || (A.editing && node(G.id)?.contains(A.editing))) { if (A.readonly()) G = { k: 'pan', x: e.clientX, y: e.clientY }; return; } beginDrag(e); }
  if (G.k === 'drag') return dragMove(e);
  if (G.k === 'marq') { const x = Math.min(G.x, e.clientX), y = Math.min(G.y, e.clientY), w = Math.abs(e.clientX - G.x), hh = Math.abs(e.clientY - G.y); Object.assign(marq.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' }); marq.hidden = false;
    const hit = new Set(G.keep); $$('#cards > .el').forEach(n => { const r = n.getBoundingClientRect(); if (r.left < x + w && r.right > x && r.top < y + hh && r.bottom > y) hit.add(n.dataset.id); });
    $$('g.ln', svg).forEach(g => { const r = g.querySelector('.lvis').getBoundingClientRect(); if (r.left < x + w && r.right > x && r.top < y + hh && r.bottom > y) hit.add(g.dataset.id); });
    if (hit.size !== A.sel.size || [...hit].some(i => !A.sel.has(i))) A.select([...hit]); return; }
  if (G.k === 'resize') { const el = get(G.id); let w = Math.max(el.type === 'swatch' ? 80 : 120, snap(G.w + (e.clientX - G.x) / V.z)); G.n.style.width = w + 'px'; G.nw = w; drawLines(); return; }
  if (G.k === 'lnew' || G.k === 'lend') return lineDrag(e);
  if (G.k === 'bend') { const l = get(G.id), a = endPt(l, 'a'), b = endPt(l, 'b'), [x, y] = A.toWorld(e.clientX, e.clientY); l.bend = { x: x - (a.x + b.x) / 2, y: y - (a.y + b.y) / 2 }; G.moved = true; drawLines(); return; }
  if (G.k === 'task') { const t = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.task'); $$('.task.over').forEach(x => x.classList.remove('over')); if (t && t !== G.node) { t.classList.add('over'); G.over = t; } else G.over = null; }
}
function up(e) {
  ptrs.delete(e.pointerId); clearTimeout(pressT); clearTimeout(holdT);
  const g = G; if (!g) return; if (g.k === 'pinch') { if (ptrs.size < 2) G = null; return; }
  G = null; stage.classList.remove('panning');
  if (g.k === 'pan') { if (g.tap && e.timeStamp - g.t0 < 300) { A.select([]); if (e.timeStamp - (up.lastTap || 0) < 350) dbl(e); up.lastTap = e.timeStamp; } return; }
  if (g.k === 'maybe') {
    if (g.line) { if (g.lab && A.sel.size === 1) A.startEdit(g.lab, [e.clientX, e.clientY]); return; }
    const ed = g.t.closest('.ed'); if (isTouch(e)) { if (e.timeStamp - (up.lastTap || 0) < 350 && up.lastId === g.id) dbl(e); up.lastTap = e.timeStamp; up.lastId = g.id; }
    if (g.was && !g.add && ed && !isTouch(e)) A.startEdit(ed, [e.clientX, e.clientY]);
    else if (!g.add && A.sel.size > 1) A.select([g.id]);
    return;
  }
  if (g.k === 'drag') { G = g; endDrag(e); G = null; return; }
  if (g.k === 'marq') { marq.hidden = true; return; }
  if (g.k === 'resize') { if (g.nw) tx(() => set(g.id, { w: g.nw })); return; }
  if (g.k === 'lnew' || g.k === 'lend') { G = g; lineDrop(e); G = null; return; }
  if (g.k === 'bend') { const l = get(g.id); if (g.moved) { const b = l.bend; l.bend = null; tx(() => set(g.id, { bend: b })); } return; }
  if (g.k === 'task') { g.node.classList.remove('lifting'); $$('.task.over').forEach(x => x.classList.remove('over')); if (g.over) { const toId = g.over.closest('.el').dataset.id, ti = +g.over.dataset.i; tx(() => { const src = structuredClone(get(g.id).items), it = g.alt ? { ...src[g.i], id: uid() } : src.splice(g.i, 1)[0]; if (toId === g.id) { src.splice(ti, 0, it); set(g.id, { items: src }); } else { const dst = structuredClone(get(toId).items); dst.splice(ti, 0, it); set(g.id, { items: src }); set(toId, { items: dst }); } }); } else if (document.elementFromPoint(e.clientX, e.clientY)?.closest('#trashBtn')) tx(() => set(g.id, { items: get(g.id).items.filter((_, i) => i !== g.i) })); }
}

/* Ziehen von Karten */
function beginDrag(e) {
  const g = G; let ids = [...A.sel].filter(id => { const el = get(id); return el && !el.locked && !(el.col && A.sel.has(el.col)); });
  if (!ids.includes(g.id)) { G = null; return; }
  if (g.alt) { const src = ids.map(get).filter(x => x.type !== 'line' || true); const copies = cloneEls(src, c => ({ z: (c.z || 0) - 0.5 })); tx(() => copies.forEach(add)); A.render(); if (src.length === 1 && src[0].type === 'note') A.toast('Kopie erstellt', 'Synchron halten', () => { const sid = src[0].sync || uid(); tx(() => { set(src[0].id, { sync: sid }); set(copies[0].id, { sync: sid }); }); }); }
  const items = ids.map(id => { const el = get(id), n = el.type === 'line' ? svg.querySelector(`g[data-id="${id}"]`) : $(`.el[data-id="${id}"]`); return n && { id, el, n, r: el.type === 'line' ? null : wrect(n) }; }).filter(Boolean);
  G = { ...g, k: 'drag', items, lead: items.find(i => i.id === g.id) || items[0], dx: 0, dy: 0 };
  items.forEach(i => i.n.classList.add('dragging')); document.body.classList.add('is-dragging');
}
function dropTarget(e) {
  const t = document.elementFromPoint(e.clientX, e.clientY); if (!t) return null;
  const types = G.items.map(i => i.el.type), one = G.items.length === 1 ? G.items[0].el : null;
  if (t.closest('#trashBtn')) return { k: 'trash', n: $('#trashBtn') };
  if (t.closest('#unsorted,#unsortedBtn')) return { k: 'unsorted', n: t.closest('#unsorted,#unsortedBtn') };
  const cr = t.closest('.crumb[data-id]'); if (cr && cr.dataset.id !== A.board) return { k: 'board', id: cr.dataset.id, n: cr, hold: true };
  const n = elOf(t); if (!n || G.items.some(i => i.n === n || i.n.contains(n))) return null; const el = get(n.dataset.id); if (!el) return null;
  if (el.type === 'board' && realBoard(el)) return { k: 'board', id: realBoard(el).id, n, hold: true };
  const colN = n.closest('.el-column'); const col = colN && get(colN.dataset.id);
  if (col && !col.collapsed && !types.some(x => x === 'column' || x === 'line')) { const body = colN.querySelector('.col-body'), sibs = [...body.children].filter(c => c.dataset.id && !G.items.some(i => i.n === c)); let idx = sibs.findIndex(c => { const r = c.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; }); if (idx < 0) idx = sibs.length;
    if (one?.type === 'comment' && n !== colN) return { k: 'pin', id: el.id, n, hold: true, alt: { k: 'col', id: col.id, n: colN, body, sibs, idx } };
    return { k: 'col', id: col.id, n: colN, body, sibs, idx }; }
  if (one?.type === 'comment' && el.type !== 'comment') return { k: 'pin', id: el.id, n, hold: true };
  if (one?.type === 'image' && ['link', 'video', 'file'].includes(el.type)) return { k: 'thumb', id: el.id, n, hold: true };
  return null;
}
function dragMove(e) {
  const g = G; let dx = (e.clientX - g.x) / V.z, dy = (e.clientY - g.y) / V.z;
  if (e.shiftKey) Math.abs(dx) > Math.abs(dy) ? (dy = 0) : (dx = 0);
  if (g.lead.r && !g.lead.el.col && g.lead.el.loc === 'canvas') { dx = snap(g.lead.el.x + dx) - g.lead.el.x; dy = snap(g.lead.el.y + dy) - g.lead.el.y; }
  g.dx = dx; g.dy = dy;
  g.items.forEach(i => { if (i.r) i.n.style.transform = `translate(${dx * (i.n.closest('#unsorted') ? V.z : 1)}px,${dy * (i.n.closest('#unsorted') ? V.z : 1)}px)`; else i.n.setAttribute('transform', `translate(${dx},${dy})`); });
  const d = dropTarget(e), key = d ? d.k + (d.id || '') : '';
  if (key !== g.dkey) { clearTimeout(holdT); $$('.drop,.drop-hold').forEach(n => n.classList.remove('drop', 'drop-hold')); g.dkey = key; g.held = false;
    if (d) { if (d.k !== 'pin' && d.k !== 'thumb') d.n.classList.add('drop'); if (d.hold) holdT = setTimeout(() => { if (G !== g) return; if (d.k === 'board') carry(d.id, e); else { g.held = true; d.n.classList.add('drop-hold'); } }, d.k === 'board' ? 1000 : 650); } }
  g.drop = d; const c = d?.k === 'col' ? d : d?.alt && !g.held ? d.alt : null;
  let ins = $('#ins'); if (c) { if (!ins) ins = h('i#ins'); const ref = c.sibs[c.idx]; ref ? c.body.insertBefore(ins, ref) : c.body.append(ins); if (d.alt) c.n.classList.add('drop'); } else ins?.remove();
  drawLines();
}
function carry(boardId, e) { // über einem Board gehalten: Board öffnen und weiterziehen
  const g = G, ids = g.items.map(i => i.id), [px, py] = A.toWorld(g.x, g.y); const rel = g.items.map(i => (i.r ? [i.r.x - px, i.r.y - py] : null));
  tx(() => g.items.forEach(i => set(i.id, { board: boardId, loc: 'canvas', col: null, pin: null })));
  $('#ins')?.remove(); document.body.classList.remove('is-dragging'); A.openBoard(boardId);
  const [wx, wy] = A.toWorld(e.clientX, e.clientY);
  tx(() => g.items.forEach((i, k) => { if (rel[k]) set(i.id, { x: snap(wx + rel[k][0]), y: snap(wy + rel[k][1]), z: maxZ(boardId) + 1 }); else { const l = get(i.id), ox = wx - px, oy = wy - py; set(i.id, { a: l.a.el ? l.a : { x: l.a.x + ox, y: l.a.y + oy }, b: l.b.el ? l.b : { x: l.b.x + ox, y: l.b.y + oy } }); } }), { merge: 'carry' });
  A.select(ids); G = { k: 'maybe', id: g.id, x: lastPt[0], y: lastPt[1], t: stage, was: false }; beginDrag(e);
}
function endDrag(e, cancel) {
  const g = G; clearTimeout(holdT); $$('.drop,.drop-hold').forEach(n => n.classList.remove('drop', 'drop-hold')); $('#ins')?.remove(); document.body.classList.remove('is-dragging');
  g.items.forEach(i => { i.n.classList.remove('dragging'); i.r ? (i.n.style.transform = '') : i.n.removeAttribute('transform'); });
  if (cancel || (!g.dx && !g.dy && !g.drop)) { drawLines(); return; }
  let d = g.drop; if (d?.hold && !g.held && d.k !== 'board') d = d.alt || null;
  const ids = g.items.map(i => i.id);
  tx(() => {
    if (d?.k === 'trash') return A.act('delete', ids);
    if (d?.k === 'unsorted') return g.items.forEach(i => i.el.type !== 'line' && set(i.id, { loc: 'unsorted', col: null, pin: null }));
    if (d?.k === 'board') { const empty = !all().some(x => x.board === d.id && x.loc === 'canvas'); const ox = Math.min(...g.items.filter(i => i.r).map(i => i.r.x), 1e9), oy = Math.min(...g.items.filter(i => i.r).map(i => i.r.y), 1e9);
      g.items.forEach(i => { if (i.id === d.id || path(d.id).some(p => p.id === i.id)) return; if (i.el.type === 'line') return empty ? set(i.id, { board: d.id }) : del(i.id); set(i.id, empty ? { board: d.id, loc: 'canvas', col: null, pin: null, x: snap(i.r.x - ox + 80), y: snap(i.r.y - oy + 80) } : { board: d.id, loc: 'unsorted', col: null, pin: null }); });
      A.toast(`In „${get(d.id).title || 'Board'}“ verschoben`, 'Öffnen', () => A.openBoard(d.id)); return; }
    if (d?.k === 'pin') return set(ids[0], { pin: d.id, col: null, loc: 'canvas' });
    if (d?.k === 'thumb') { const im = g.items[0].el, t = get(d.id); set(d.id, t.type === 'link' ? { img: im.src, showImg: true } : { thumb: im.src }); return del(im.id); }
    if (d?.k === 'col') { const order = d.sibs.map(n => n.dataset.id); const moving = g.items.filter(i => i.el.type !== 'line' && i.el.type !== 'column').sort((a, b) => a.r.y - b.r.y).map(i => i.id); order.splice(d.idx, 0, ...moving); order.forEach((id, k) => set(id, { col: d.id, ord: k, loc: 'canvas', board: A.board, pin: null })); return; }
    let z = maxZ(A.board);
    g.items.forEach(i => { if (!i.r) { const l = get(i.id); return set(i.id, { a: l.a.el ? l.a : { x: snap(l.a.x + g.dx), y: snap(l.a.y + g.dy) }, b: l.b.el ? l.b : { x: snap(l.b.x + g.dx), y: snap(l.b.y + g.dy) } }); }
      const out = i.el.col || i.el.loc !== 'canvas'; const s = out && i.el.loc === 'unsorted' ? V.z : 1;
      set(i.id, out ? { x: snap(i.r.x + g.dx * s), y: snap(i.r.y + g.dy * s), col: null, loc: 'canvas', board: A.board, z: ++z } : { x: i.el.x + g.dx, y: i.el.y + g.dy, ...(g.items.length === 1 && i.el.type !== 'column' ? { z: ++z } : {}) }); });
  });
  A.render();
}

/* Linien ziehen */
function lineDrag(e) {
  const g = G; let [x, y] = A.toWorld(e.clientX, e.clientY);
  const t = elOf(document.elementFromPoint(e.clientX, e.clientY) || stage), tid = t?.dataset.id, self = g.k === 'lnew' ? g.from : get(g.id)[g.end === 'a' ? 'b' : 'a'].el;
  const ok = tid && tid !== self && get(tid)?.board === A.board && get(tid).type !== 'column' ? tid : null;
  if (ok !== g.tid) { clearTimeout(holdT); $$('.line-target,.line-anchor').forEach(n => n.classList.remove('line-target', 'line-anchor')); g.tid = ok; g.anchor = null; if (ok) { t.classList.add('line-target'); holdT = setTimeout(() => { if (G === g && g.tid === ok) { const r = t.getBoundingClientRect(); g.anchor = { ax: clamp((lastPt[0] - r.left) / r.width, 0, 1), ay: clamp((lastPt[1] - r.top) / r.height, 0, 1) }; t.classList.add('line-anchor'); } }, 700); } }
  if (g.k === 'lnew') { const r = wrect(node(g.from)), c = { x: r.x + r.w / 2, y: r.y + r.h / 2, r }; if (e.shiftKey) Math.abs(x - c.x) > Math.abs(y - c.y) ? (y = c.y) : (x = c.x); const s = clip(c, { x, y }); A.tmpLine = `M${s.x} ${s.y} L${x} ${y}`; g.pt = { x, y }; }
  else { const l = get(g.id), o = endPt(l, g.end === 'a' ? 'b' : 'a'); if (e.shiftKey) Math.abs(x - o.x) > Math.abs(y - o.y) ? (y = o.y) : (x = o.x); l[g.end] = { x, y }; g.moved = true; }
  drawLines();
}
function lineDrop() {
  const g = G; clearTimeout(holdT); $$('.line-target,.line-anchor').forEach(n => n.classList.remove('line-target', 'line-anchor')); A.tmpLine = null;
  const end = g.tid ? { el: g.tid, ...(g.anchor || {}) } : null;
  if (g.k === 'lnew') { if (!g.pt) return drawLines(); const l = { id: uid(), type: 'line', board: A.board, loc: 'canvas', a: { el: g.from }, b: end || { x: snap(g.pt.x), y: snap(g.pt.y) }, headB: true, z: 0 }; tx(() => add(l)); A.select([l.id]); }
  else if (g.moved) { const l = get(g.id), v = end || { x: snap(l[g.end].x), y: snap(l[g.end].y) }; Object.assign(l, structuredClone(g.before)); tx(() => set(g.id, { [g.end]: v })); }
  A.render();
}

/* Doppelklick */
function dbl(e) {
  const t = e.target?.closest ? e.target : document.elementFromPoint(e.clientX, e.clientY) || stage; if (A.pad || t.closest(NOD)) return;
  if (t.classList?.contains('lmid')) { const id = t.closest('g').dataset.id; return tx(() => set(id, { bend: null })); }
  if (t.classList?.contains('rz')) { const n = elOf(t), el = get(n.dataset.id); return tx(() => set(el.id, { w: DEF_W[el.type] })); }
  const ln = t.closest?.('g.ln'); if (ln && !A.readonly()) { const l = get(ln.dataset.id); if (l.label == null) { l.label = ''; drawLines(); } return A.startEdit(labels.querySelector(`[data-line="${l.id}"]`)); }
  const n = elOf(t);
  if (!n) { if (t.closest('#unsorted') || A.readonly() || !t.closest('#stage')) return; const [x, y] = A.toWorld(e.clientX, e.clientY); return A.create('note', [x - 20, y - 16], {}, { corner: true }); }
  const el = get(n.dataset.id); if (!el) return; const ed = t.closest('.ed');
  if (ed && !(el.type === 'board' && !t.closest('.btitle'))) return A.startEdit(ed, [e.clientX, e.clientY]);
  A.openEl(el);
}
A.openEl = el => {
  if (el.type === 'board') return A.openBoard(el.id);
  if (el.type === 'doc') return A.openDoc(el.id);
  if (el.type === 'image') return A.viewer(el.id);
  if (el.type === 'file') return A.fileViewer(el.id);
  if (el.type === 'swatch' && !A.readonly()) return A.colorPicker(el.id);
  if (el.type === 'sketch' && !A.readonly()) return A.sketchEdit(el.id);
  const ed = node(el.id)?.querySelector('.ed'); if (ed) A.startEdit(ed);
};
stage.addEventListener('dblclick', dbl); $('#unsorted').addEventListener('dblclick', dbl);
document.addEventListener('dblclick', e => { const ed = e.target.closest('.pinpop .ed'); if (ed) A.startEdit(ed, [e.clientX, e.clientY]); });
stage.addEventListener('contextmenu', e => { if (e.target.closest('.tbl') || (A.editing && !mod(e) && e.target.closest('.ed') === A.editing)) return; e.preventDefault(); const n = elOf(e.target) || e.target.closest('g.ln'); if (n && !A.sel.has(n.dataset.id)) A.select([n.dataset.id]); if (!n) A.select([]); A.ctxMenu(e.clientX, e.clientY); });
$('#unsorted').addEventListener('contextmenu', e => { const n = elOf(e.target); if (!n) return; e.preventDefault(); if (!A.sel.has(n.dataset.id)) A.select([n.dataset.id]); A.ctxMenu(e.clientX, e.clientY); });
stage.addEventListener('wheel', e => { if (e.target.closest('.tbl-wrap,.dprev') && !e.ctrlKey && !e.metaKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; e.preventDefault(); if (e.ctrlKey || e.metaKey) A.zoomAt(Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0045)), e.clientX, e.clientY); else { V.x -= e.deltaX; V.y -= e.deltaY; applyView(); } }, { passive: false });

/* Freies Zeichnen auf dem Board */
A.drawMode = () => {
  if (A.pad || (A.readonly() && !(A.role === 'comment' && !A.mode.present))) return; A.stopEdit(); A.select([]);
  const host = h('div#drawlayer'); world.append(host); stage.classList.add('drawing');
  openPad({ host, toWorld: e => A.toWorld(e.clientX, e.clientY), scale: () => 1, onDone: strokes => { host.remove(); stage.classList.remove('drawing'); if (!strokes?.length) return;
    let b = [1e9, 1e9, -1e9, -1e9]; strokes.forEach(s => s.pts.forEach(p => { b = [Math.min(b[0], p[0] - s.size), Math.min(b[1], p[1] - s.size), Math.max(b[2], p[0] + s.size), Math.max(b[3], p[1] + s.size)]; }));
    strokes.forEach(s => s.pts.forEach(p => { p[0] = +(p[0] - b[0]).toFixed(1); p[1] = +(p[1] - b[1]).toFixed(1); }));
    const el = { id: uid(), type: 'sketch', free: true, board: A.board, loc: 'canvas', x: Math.round(b[0]), y: Math.round(b[1]), w: Math.ceil(b[2] - b[0]), vw: Math.ceil(b[2] - b[0]), vh: Math.ceil(b[3] - b[1]), strokes, z: maxZ(A.board) + 1 }; tx(() => add(el)); A.select([el.id]); } });
};

/* Tastatur */
const typing = t => t.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable="plaintext-only"]');
addEventListener('keydown', e => {
  if (table.T.edit && e.target.closest?.('td.editing')) { table.key(e); return; }
  if (A.pad || typing(e.target) || A.modalOpen?.()) { if (e.key === 'Escape' && A.modalOpen?.() && !A.pad) A.closeModal(); return; }
  const k = e.key, lk = k.toLowerCase(), m = mod(e), els = A.selEls(), ro = A.readonly();
  if (k === 'Escape') { if (A.closeMenu?.()) return; if (table.T.id) return table.clearSel(); if (A.sel.size) return A.select([]); if (A.mode.present) return A.present(false); return; }
  if (table.T.id && A.sel.has(table.T.id) && !(m && 'zy'.includes(lk)) && table.key(e)) return;
  if (k === ' ') { e.preventDefault(); if (!spaceDown) { spaceDown = true; spacePanned = false; stage.classList.add('canpan'); } return; }
  if (m && lk === 'f') { e.preventDefault(); return A.search(); }
  if (m && lk === 'z') { e.preventDefault(); A.stopEdit(); (e.shiftKey ? redo() : undo()) || A.toast(e.shiftKey ? 'Nichts zu wiederholen' : 'Nichts rückgängig zu machen'); return; }
  if (m && lk === 'y') { e.preventDefault(); redo(); return; }
  if (m && (k === '+' || k === '=')) { e.preventDefault(); return A.zoomAt(1.25); }
  if (m && k === '-') { e.preventDefault(); return A.zoomAt(0.8); }
  if (m && k === '0') { e.preventDefault(); return A.zoomAt(1, null, null, true); }
  if (m && k === '[') { e.preventDefault(); return A.back(); } if (m && k === ']') { e.preventDefault(); return A.forward(); }
  if (m && lk === 'u' && !e.shiftKey) { e.preventDefault(); return A.up(); }
  if (m && e.shiftKey && lk === 'd') { e.preventDefault(); const d = document.documentElement, dark = d.dataset.theme ? d.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; return A.setSetting('dark', !dark); }
  if (m && e.shiftKey && (k === '<' || k === ',')) { e.preventDefault(); return A.setSetting('uiSize', clamp(A.setting('uiSize', 1) - 1, 0, 3)); }
  if (m && e.shiftKey && (k === '>' || k === '.')) { e.preventDefault(); return A.setSetting('uiSize', clamp(A.setting('uiSize', 1) + 1, 0, 3)); }
  if (m && lk === 'a') { e.preventDefault(); return A.select([...kids(A.board).filter(x => !x.pin).map(x => x.id)]); }
  if (!m && lk === 'z') return A.fit();
  if (k === '/' || k === '?') { e.preventDefault(); return A.shortcuts(); }
  if (ro) return;
  if (!m && e.shiftKey && lk === 'd') { e.preventDefault(); return A.drawMode(); }
  if (m && k === 'Enter') { e.preventDefault(); return A.act('next', els.map(x => x.id)); }
  if (k === 'Enter' && els.length === 1) { e.preventDefault(); const el = els[0]; if (el.type === 'line') { if (el.label == null) { el.label = ''; drawLines(); } return A.startEdit(labels.querySelector(`[data-line="${el.id}"]`)); } const ed = node(el.id)?.querySelector('.ed'); return ed ? A.startEdit(ed) : A.openEl(el); }
  if (!els.length) return;
  if (k === 'Backspace' || k === 'Delete') { e.preventDefault(); return A.act('delete', [...A.sel]); }
  if (k.startsWith('Arrow') && m && e.shiftKey) { e.preventDefault(); return A.act(k === 'ArrowUp' ? 'front' : 'back', [...A.sel]); }
  if (k.startsWith('Arrow')) { e.preventDefault(); const st = (e.shiftKey ? 5 : 1) * GRID(), dx = k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0, dy = k === 'ArrowUp' ? -st : k === 'ArrowDown' ? st : 0;
    return tx(() => els.forEach(el => { if (el.locked || el.col || el.loc !== 'canvas') return; if (el.type === 'line') set(el.id, { a: el.a.el ? el.a : { x: el.a.x + dx, y: el.a.y + dy }, b: el.b.el ? el.b : { x: el.b.x + dx, y: el.b.y + dy } }); else set(el.id, { x: el.x + dx, y: el.y + dy }); }), { merge: 'nudge' }); }
  if (m && lk === 'd') { e.preventDefault(); return A.act('duplicate', [...A.sel]); }
  if (m && lk === 'k') { e.preventDefault(); return A.act('connect', [...A.sel]); }
  if (m && lk === 'l') { e.preventDefault(); return A.act(els.every(x => x.locked) ? 'unlock' : 'lock', [...A.sel]); }
  if (!m && !e.altKey && k.length === 1 && els.length === 1) { const el = els[0];
    if (el.type === 'image') { e.preventDefault(); tx(() => set(el.id, { showCaption: true }), { undo: false }); const c = node(el.id).querySelector('.cap'); A.startEdit(c); document.execCommand('insertText', false, k); }
    else if (el.type === 'line') { e.preventDefault(); if (el.label == null) { el.label = ''; drawLines(); } A.startEdit(labels.querySelector(`[data-line="${el.id}"]`)); document.execCommand('insertText', false, k); } }
});
addEventListener('keyup', e => { if (e.key === ' ' && spaceDown) { spaceDown = false; stage.classList.remove('canpan'); if (!spacePanned && !typing(e.target) && A.sel.size === 1) { const el = A.selEls()[0]; if (el && (el.type === 'board' || el.type === 'image')) A.openEl(el); } } });
addEventListener('blur', () => { spaceDown = false; stage.classList.remove('canpan'); });

/* Zwischenablage */
const MARK = '228board:';
function copySel(e, cut) {
  if (typing(e.target) || A.modalOpen?.() || !A.sel.size || (table.T.id && A.sel.has(table.T.id))) return;
  const top = A.selEls().filter(x => !(x.col && A.sel.has(x.col))); const cl = cloneEls(top);
  const data = MARK + JSON.stringify({ from: A.board, top: top.length, els: cl, org: top.map(x => x.id) });
  A.clip = data; e.clipboardData.setData('text/plain', top.length === 1 && top[0].type === 'note' ? textOf(top[0].html) : top.map(x => x.title || x.url || textOf(x.html || '') || NAMES[x.type]).join('\n')); e.clipboardData.setData('application/x-228board', data); e.preventDefault();
  if (cut && !A.readonly()) A.act('delete', [...A.sel]);
}
document.addEventListener('copy', e => copySel(e)); document.addEventListener('cut', e => copySel(e, true));
A.pasteEls = (data, pt) => {
  const o = JSON.parse(data.slice(MARK.length)); const tops = o.els.slice(0, o.els.length), topIds = new Set(); let seen = 0;
  // die ersten "top" Elemente ohne Elternbezug innerhalb der Kopie sind die obersten
  const ids = new Set(o.els.map(x => x.id)); const roots = o.els.filter(x => !ids.has(x.board) && !ids.has(x.col));
  const fresh = cloneEls.call(null, []); // nur für Typkonsistenz
  const map = new Map(o.els.map(x => [x.id, uid()]));
  const cl = o.els.map(x => { const c = structuredClone(x); c.id = map.get(x.id); if (map.has(c.board)) c.board = map.get(c.board); if (c.col) c.col = map.get(c.col) || null; if (c.pin) c.pin = map.get(c.pin) || null; if (c.type === 'line') ['a', 'b'].forEach(k => { if (c[k].el) { if (map.has(c[k].el)) c[k].el = map.get(c[k].el); else c[k] = { x: 0, y: 0 }; } }); c.created = c.modified = now(); return c; });
  const rs = cl.filter(c => roots.some(r => map.get(r.id) === c.id)); const pos = rs.filter(r => r.x != null);
  const minx = Math.min(...pos.map(r => r.x), 1e9), miny = Math.min(...pos.map(r => r.y), 1e9); const [px, py] = pt || (o.from === A.board ? [minx + 40, miny + 40] : A.center()); let z = maxZ(A.board);
  rs.forEach(r => { r.board = A.board; r.loc = 'canvas'; r.col = null; if (r.type === 'line') ['a', 'b'].forEach(k => { if (!r[k].el) { r[k].x += px - (minx === 1e9 ? 0 : minx); r[k].y += py - (miny === 1e9 ? 0 : miny); } }); else { r.x = snap((r.x ?? px) - (minx === 1e9 ? r.x ?? px : minx) + px); r.y = snap((r.y ?? py) - (miny === 1e9 ? r.y ?? py : miny) + py); r.z = ++z; } });
  tx(() => cl.forEach(add)); A.select(rs.map(r => r.id));
};
A.handlePaste = async (dt, pt, internal) => {
  if (A.readonly()) return;
  if (dt.files?.length) return A.addFiles(dt.files, pt);
  const own = dt.getData('application/x-228board') || internal, text = dt.getData('text/plain') || '', html = dt.getData('text/html') || '';
  if (own || text.startsWith(MARK)) return A.pasteEls(own || text, pt);
  if (table.T.id && A.sel.has(table.T.id)) return table.paste(text);
  if (!text.trim() && !html) return;
  const one = A.sel.size === 1 ? A.selEls()[0] : null, t = text.trim();
  if (one?.type === 'swatch' && hexNorm(t)) return tx(() => set(one.id, { hex: hexNorm(t), name: null }));
  if (one?.type === 'line') return tx(() => set(one.id, { label: t.slice(0, 200) }));
  if (isUrl(t)) { if (one && ['link', 'audio', 'video', 'map'].includes(one.type) && !one.url && !one.blob) return tx(() => set(one.id, { url: fixUrl(t) })); if (/\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(t)) return A.create('image', pt, { src: fixUrl(t) }, { quiet: true }); return A.create('link', pt, { url: fixUrl(t), showImg: true, showDesc: true }, { quiet: true }); }
  const rows = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n');
  if (rows.length > 1 && rows.every(r => r.includes('\t'))) { const cells = rows.map(r => r.split('\t')), wd = Math.max(...cells.map(r => r.length)); cells.forEach(r => { while (r.length < wd) r.push(''); }); return A.create('table', pt, { cells, colW: Array(wd).fill(110) }, { quiet: true }); }
  const im = /<img[^>]+src="(https?:[^"]+)"/i.exec(html); if (im && !t) return A.create('image', pt, { src: im[1] }, { quiet: true });
  A.create('note', pt, { html: rows.map(r => `<p>${esc(r) || '<br>'}</p>`).join('') }, { quiet: true });
};
document.addEventListener('paste', e => { if (typing(e.target) || A.modalOpen?.()) return; e.preventDefault(); A.handlePaste(e.clipboardData, null); });

/* Dateien und Inhalte von außen */
function dropInfo(e) { const t = document.elementFromPoint(e.clientX, e.clientY); if (t?.closest('#unsorted')) return { loc: 'unsorted' }; const n = t && elOf(t), el = n && get(n.dataset.id); if (el?.type === 'board' && realBoard(el)) return { board: realBoard(el).id, loc: all().some(x => x.board === realBoard(el).id && x.loc === 'canvas') ? 'unsorted' : 'canvas' }; const c = n?.closest('.el-column'); if (c && !get(c.dataset.id).collapsed) return { col: c.dataset.id }; return {}; }
addEventListener('dragover', e => { if (e.dataTransfer?.types.some(t => t === 'Files' || t === 'text/uri-list' || t === 'text/plain')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
addEventListener('drop', async e => {
  if (!e.dataTransfer || A.readonly() || typing(e.target)) return; e.preventDefault();
  const pt = A.toWorld(e.clientX, e.clientY), info = dropInfo(e), dt = e.dataTransfer;
  if (dt.files.length) { const t = elOf(document.elementFromPoint(e.clientX, e.clientY) || stage), tel = t && get(t.dataset.id), f = dt.files[0]; if (tel && dt.files.length === 1 && /^image\//.test(f.type) && ['link', 'video', 'file'].includes(tel.type)) { const b = await putBlob(f); return tx(() => set(tel.id, tel.type === 'link' ? { img: b, showImg: true } : { thumb: b })); } return A.addFiles(dt.files, pt, info); }
  const made = await A.handlePaste(dt, pt);
  if (made?.id && (info.col || info.board || info.loc)) tx(() => set(made.id, { ...(info.board ? { board: info.board } : {}), loc: info.loc || 'canvas', col: info.col || null, ord: 1e6 }), { undo: false });
});

/* Start */
addEventListener('hashchange', () => { const m = /#\/(?:b|v|j)\/([\w-]+)/.exec(location.hash); if (!m || m[1] === A.board) return; if (get(m[1]) && !/#\/j\//.test(location.hash)) A.openBoard(m[1]); else A.openRemote?.(location.hash); });
addEventListener('resize', () => applyView());
addEventListener('beforeunload', e => { A.stopEdit(); });
(async () => {
  await open();
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch {}
  S.subs.add(() => A.render());
  initActions(); initUI(); applySettings();
  const h0 = location.hash, m = /#\/(?:b|v|j)\/([\w-]+)/.exec(h0);
  A.openBoard(m && get(m[1]) ? m[1] : 'home');
  initSync().then(() => { if (m && (!get(m[1]) || /#\/j\//.test(h0))) setTimeout(() => A.openRemote?.(h0), 1200); });
  if (!kv('seeded')) { kvSet('seeded', 1); A.welcome?.(); }
  const sp = new URLSearchParams(location.search), shared = sp.get('url') || sp.get('text') || sp.get('title') || sp.get('img');
  if (shared) { const u = [sp.get('url'), sp.get('text')].find(x => x && isUrl(x.trim())), img = sp.get('img'), src = sp.get('src') || null, base = { id: uid(), board: 'home', loc: 'unsorted' };
    tx(() => add(img ? { ...base, type: 'image', src: img, w: 320, caption: sp.get('title') || '', srcUrl: src } : u ? { ...base, type: 'link', url: fixUrl(u), title: sp.get('title') || '', w: 280, showImg: true, showDesc: true } : { ...base, type: 'note', w: 260, src, html: `<p>${esc(sp.get('text') || sp.get('title') || '')}</p>` }));
    history.replaceState(null, '', location.pathname + location.hash); A.openBoard('home'); A.toggleUnsorted(true);
    if (sp.get('clip')) { A.toast('In der Ablage gespeichert'); setTimeout(() => { if (!A.account || window.opener === null) window.close(); }, 2600); } }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  document.body.classList.add('ready');
})();
