// Oberfläche: Leisten, Menüs, Dialoge, Betrachter, Suche, Papierkorb, Einstellungen
import { A, $, $$, h, ap, ico, clamp, mod, isMac, debounce, esc, textOf, fmtDate, fmtSize, download, CARD_COLORS, INK, LABEL_COLORS, EMOJI, BOARD_ICONS, autoIcon, hexNorm, hexRgb, rgbHex, rgbHsl, hslRgb, inkOn, colorName, hostOf, loadScript, palette } from './util.js';
import { S, tx, set, get, add, del, all, kids, colKids, path, uid, now, kv, kvSet, undo, redo, putBlob, getBlob, blobUrl, realBoard, descendants, maxZ } from './store.js';
import { build, NAMES, toggleRx, drafts } from './cards.js';
import { FMT } from './rich.js';
import * as table from './table.js';
import { openPad, svgFile } from './sketch.js';
import { exportBoard, exportDoc, backup, restore } from './exporter.js';
import { TEMPLATES, CATS, useTemplate } from './templates.js';

const K = isMac ? '⌘' : 'Strg+';
const TOOLS = [['note', 'Notiz'], ['link', 'Link'], ['todo', 'To-do'], ['line', 'Linie'], ['board', 'Board'], ['column', 'Spalte'], ['comment', 'Kommentar'], ['table', 'Tabelle'], ['swatch', 'Farbfeld'], ['doc', 'Dokument'], ['sketch', 'Skizze'], ['audio', 'Audio'], ['video', 'Video'], ['map', 'Karte']];
const DEFAULT_BAR = ['note', 'link', 'todo', 'line', 'board', 'column', 'comment', 'table'];
const keep = fn => ({ onpointerdown: e => e.preventDefault(), onclick: fn });
const btn = (icon, label, fn, o = {}) => h('button.tb' + (o.on ? '.on' : '') + (o.cls ? '.' + o.cls : ''), { title: o.title || label, 'aria-label': label, ...keep(fn), disabled: o.disabled || null }, typeof icon === 'string' ? ico(icon) : icon, h('span', label));

/* ---------- Menüs, Dialoge, Hinweise ---------- */
let menuEl = null;
A.closeMenu = () => { if (!menuEl) return false; menuEl.remove(); menuEl = null; A.holdEdit = false; if (A.editing && document.activeElement !== A.editing) setTimeout(() => A.editing && document.activeElement !== A.editing && A.stopEdit(), 0); return true; };
function place(n, x, y) { document.body.append(n); const r = n.getBoundingClientRect(); n.style.left = clamp(x, 8, innerWidth - r.width - 8) + 'px'; n.style.top = clamp(y, 8, Math.max(8, innerHeight - r.height - 8)) + 'px'; }
A.pop = (node, x, y) => { A.closeMenu(); menuEl = h('div.pop.glass', { onpointerdown: e => e.stopPropagation() }, node); place(menuEl, x, y); return menuEl; };
A.menu = (items, x, y, o = {}) => {
  A.closeMenu(); if (A.editing) A.holdEdit = true;
  const list = h('div.mlist'); let filter = '';
  const draw = () => { list.innerHTML = ''; items.filter(i => i === '-' ? !filter : i && (!filter || i.label.toLowerCase().includes(filter))).forEach(i => list.append(i === '-' ? h('hr') : h('button.mi' + (i.danger ? '.danger' : ''), { disabled: i.disabled || null, onpointerdown: e => e.preventDefault(), onclick: () => { if (!i.stay) A.closeMenu(); i.act?.(); } }, i.icon ? (/[^\x00-\x7f]/.test(i.icon) ? h('span.memo', i.icon) : ico(i.icon, 17)) : i.color ? h('i.mdot', { style: { background: i.color } }) : null, h('span.ml', i.label), i.checked ? ico('check', 15) : null, i.hint ? h('kbd', i.hint) : null))); };
  draw();
  menuEl = h('div.pop.menu.glass', { onpointerdown: e => e.stopPropagation(), oncontextmenu: e => e.preventDefault() }, o.title ? h('div.mtitle', o.title) : null, o.search ? h('input.msearch', { placeholder: o.search, oninput: e => { filter = e.target.value.toLowerCase(); draw(); }, onkeydown: e => { e.stopPropagation(); if (e.key === 'Enter') list.querySelector('.mi')?.click(); if (e.key === 'Escape') A.closeMenu(); } }) : null, list, o.foot || null);
  place(menuEl, x, y); if (o.search && innerWidth > 700) menuEl.querySelector('.msearch').focus();
  return menuEl;
};
addEventListener('pointerdown', e => { if (menuEl && !menuEl.contains(e.target)) A.closeMenu(); }, true);
const at = e => { const r = (e.currentTarget || e.target).getBoundingClientRect(); return innerWidth < 700 ? [r.left, r.top - 8 - 320 < 0 ? r.bottom + 8 : Math.max(8, r.top - 330)] : [r.right + 10, r.top - 6]; };
const below = e => { const r = (e.currentTarget || e.target).getBoundingClientRect(); return [r.left, r.bottom + 8]; };

A.toast = (text, label, fn) => { $('#toast')?.remove(); const t = h('div#toast.glass', h('span', text), label ? h('button', { onclick: () => { t.remove(); fn(); } }, label) : null); document.body.append(t); setTimeout(() => t.remove(), label ? 7000 : 3200); };
let modalEl = null;
A.modalOpen = () => !!modalEl;
A.closeModal = () => { if (!modalEl) return; const m = modalEl; modalEl = null; m._close?.(); m.remove(); };
A.modal = (title, body, o = {}) => { A.closeModal(); A.closeMenu(); A.stopEdit();
  modalEl = h('div.modal' + (o.cls ? '.' + o.cls : ''), { onpointerdown: e => { if (e.target === modalEl) A.closeModal(); } }, h('div.sheet.glass', { role: 'dialog', 'aria-label': title }, h('header', h('h2', title), o.tools || null, h('button.x', { 'aria-label': 'Schließen', onclick: A.closeModal }, ico('x'))), h('div.mbody', body)));
  modalEl._close = o.onClose; document.body.append(modalEl); return modalEl; };
A.prompt = (title, value, cb, o = {}) => { const hold = !!A.editing; if (hold) A.holdEdit = true; const inp = h('input.field', { value: value || '', placeholder: o.ph || '', type: o.type || 'text' });
  const done = v => { box.remove(); A.holdEdit = false; cb(v); if (hold) setTimeout(() => A.editing && document.activeElement !== A.editing && A.stopEdit(), 0); };
  const box = h('div.modal.small', { onpointerdown: e => { if (e.target === box) done(null); } }, h('form.sheet.glass', { onsubmit: e => { e.preventDefault(); done(inp.value.trim()); } }, h('h2', title), inp, h('div.row.end', h('button.btn', { type: 'button', onclick: () => done(null) }, 'Abbrechen'), h('button.btn.primary', o.ok || 'OK'))));
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') done(null); }); document.body.append(box); inp.focus(); inp.select(); };
A.confirm = (text, ok, fn) => { const box = h('div.modal.small', h('div.sheet.glass', h('h2', text), h('div.row.end', h('button.btn', { onclick: () => box.remove() }, 'Abbrechen'), h('button.btn.danger', { onclick: () => { box.remove(); fn(); } }, ok)))); document.body.append(box); };

/* ---------- Benachrichtigungen ---------- */
A.notify = (text, to, elId) => { const list = kv('notifs', []); list.unshift({ id: uid(), text, ts: now(), board: A.board, el: elId || null, read: to == null || to === A.me() ? false : true, mine: true }); kvSet('notifs', list.slice(0, 100)); refreshTop(); };
function notifPanel(e) { const list = kv('notifs', []);
  const body = h('div.npanel', h('div.mtitle', 'Mitteilungen', h('button.link', { onclick: () => { kvSet('notifs', list.map(n => ({ ...n, read: true }))); A.closeMenu(); refreshTop(); } }, 'Alle gelesen')),
    list.length ? list.map(n => h('button.nitem' + (n.read ? '' : '.unread'), { onclick: () => { n.read = true; kvSet('notifs', list); A.closeMenu(); if (get(n.board)) A.openBoard(n.board, n.el); refreshTop(); } }, h('span', n.text), h('time', fmtDate(n.ts)))) : h('p.mut.pad', 'Keine Mitteilungen'));
  A.pop(body, ...below(e)); }
function checkDue() { const seen = kv('dueSeen', {}); let ch = false;
  all().filter(e => e.type === 'todo' && e.loc !== 'trash').forEach(e => (e.items || []).forEach(it => { if (it.due && !it.done && it.due <= now() + 15 * 60e3 && !seen[it.id + it.due] && (!it.who || it.who === A.me())) { seen[it.id + it.due] = 1; ch = true; const text = `Fällig: ${it.text || 'Aufgabe'}`; const list = kv('notifs', []); list.unshift({ id: uid(), text, ts: now(), board: e.board, el: e.id, read: false }); kvSet('notifs', list.slice(0, 100)); if (window.Notification?.permission === 'granted') new Notification('228 Board', { body: text }); } }));
  if (ch) { kvSet('dueSeen', seen); refreshTop(); } }

/* ---------- Kopfzeile ---------- */
function refreshTop() {
  const p = path(A.board), crumbs = $('#crumbs'); crumbs.innerHTML = '';
  const show = p.length > 4 ? [p[0], null, ...p.slice(-2)] : p;
  show.forEach((b, i) => { if (i) crumbs.append(ico('chev', 14)); if (!b) return crumbs.append(h('button.crumb', { onclick: e => A.menu(p.slice(1, -2).map(x => ({ label: x.title || 'Ohne Titel', icon: x.icon || autoIcon(x.title), act: () => A.openBoard(x.id) })), ...below(e)) }, '…'));
    const last = b.id === A.board; crumbs.append(h('button.crumb' + (last ? '.cur' : ''), { data: { id: b.id }, onclick: () => (last ? (b.id !== 'home' && !A.readonly() && A.prompt('Board umbenennen', b.title, v => v && tx(() => set(b.id, { title: v })))) : A.openBoard(b.id)) }, b.id === 'home' ? ico('home', 16) : h('span.cemo', b.icon || autoIcon(b.title)), h('span.ct', b.title || 'Ohne Titel'))); });
  const un = kids(A.board, 'unsorted').length, nn = kv('notifs', []).filter(n => !n.read).length, ro = A.readonly();
  const R = $('#topright'); R.innerHTML = '';
  if (A.mode.present) { ap(R, h('span.zoomer', h('button', { title: 'Verkleinern', onclick: () => A.zoomAt(0.8) }, '−'), h('span#zoomLabel', Math.round(A.view.z * 100) + ' %'), h('button', { title: 'Vergrößern', onclick: () => A.zoomAt(1.25) }, '+')), h('button.btn', { onclick: () => A.present(false) }, 'Präsentation beenden')); return; }
  ap(R, 
    h('button.ib', { title: `Rückgängig (${K}Z)`, 'aria-label': 'Rückgängig', disabled: !S.undo.length || null, onclick: () => { A.stopEdit(); undo(); } }, ico('undo')),
    h('button.ib', { title: `Wiederholen (${K}⇧Z)`, 'aria-label': 'Wiederholen', disabled: !S.redo.length || null, onclick: () => redo() }, ico('redo')),
    h('button.ib', { title: `Suche (${K}F)`, 'aria-label': 'Suche', onclick: () => A.search() }, ico('search')),
    h('button.ib', { title: 'Mitteilungen', 'aria-label': 'Mitteilungen', onclick: notifPanel }, ico('bell'), nn ? h('i.badge', nn) : null),
    h('button.ib#unsortedBtn' + ($('#unsorted').hidden ? '' : '.on'), { title: 'Ablage (Unsortiert)', 'aria-label': 'Ablage', onclick: () => A.toggleUnsorted() }, ico('inbox'), un ? h('i.badge', un) : null),
    h('button.ib', { title: 'Ansicht', 'aria-label': 'Ansicht', onclick: viewMenu }, ico('eye')),
    A.board !== 'home' ? h('button.ib', { title: 'Exportieren', 'aria-label': 'Exportieren', onclick: exportMenu }, ico('export')) : null,
    A.board !== 'home' ? h('button.btn.primary.share', { onclick: () => A.share() }, ico('share', 16), h('span', 'Teilen')) : null,
    A.topExtra?.(),
    h('button.ib', { title: 'Einstellungen', 'aria-label': 'Einstellungen', onclick: () => A.settings() }, ico('gear')));
}
function viewMenu(e) {
  const b = get(A.board), z = h('input', { type: 'range', min: 5, max: 400, value: Math.round(A.view.z * 100), 'aria-label': 'Zoom', oninput: ev => A.zoomAt(ev.target.value / 100, null, null, true) });
  const tog = (label, key) => h('label.check', h('input', { type: 'checkbox', checked: A.mode[key] || null, onchange: ev => { A.mode[key] = ev.target.checked; kvSet('present', { ...A.mode, present: false }); } }), label);
  A.pop(h('div.vmenu', h('div.mtitle', 'Zoom ', h('span#zoomLabel', Math.round(A.view.z * 100) + ' %')), z, h('div.row', h('button.btn', { onclick: () => A.fit() }, 'Alles einpassen (Z)'), h('button.btn', { onclick: () => A.zoomAt(1, null, null, true) }, '100 %')), h('hr'),
    h('button.btn.primary.wide', { onclick: () => { A.closeMenu(); A.present(true); } }, ico('present', 16), 'Präsentieren'), tog('Kommentare ausblenden', 'hideComments'), tog('Bearbeiten verhindern', 'lockEdit'), tog('Auf angeklickte Karte fokussieren', 'focus'), h('hr'),
    A.readonly() ? null : h('div', h('div.mtitle', 'Board-Hintergrund'), colorGrid(b.bg || '', c => tx(() => set(A.board, { bg: c && c !== 'transparent' ? c : null })), ['', '#f5f5f7', '#fff8e7', '#eef6ff', '#eefaf0', '#fdeef2', '#f1edff', '#1c1c1e', '#0f1b2d', '#1d2a1f', '#2a1a1a'])),
    h('button.mi', { onclick: () => { A.closeMenu(); A.setSetting('dark', !isDark()); } }, ico('moon', 17), h('span.ml', isDark() ? 'Heller Modus' : 'Dunkler Modus'), h('kbd', K + '⇧D'))), ...below(e));
}
const isDark = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
A.present = on => { A.mode.present = on; A.stopEdit(); A.select([]); document.body.classList.toggle('presenting', on); if (on) { Object.assign(A.mode, kv('present', {}), { present: true }); document.documentElement.requestFullscreen?.().catch(() => {}); } else if (document.fullscreenElement) document.exitFullscreen?.(); $('#cards').innerHTML = ''; A.render(); if (on) A.fit(); };
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && A.mode.present) A.present(false); });
function exportMenu(e) { const run = (fmt, o) => exportBoard(A.board, fmt, o).catch(err => { console.error(err); A.toast('Export fehlgeschlagen: ' + err.message); });
  A.menu([{ label: 'PDF', icon: 'doc', act: () => run('pdf') }, { label: 'PDF groß (Originalbilder)', icon: 'doc', act: () => run('pdf', { large: true }) }, { label: 'PNG-Bild', icon: 'image', act: () => run('png') }, '-', { label: 'Word-Dokument', icon: 'doc', act: () => run('word') }, { label: 'Markdown', icon: 'code', act: () => run('md') }, { label: 'Reiner Text', icon: 'note', act: () => run('txt') },
    { label: 'Unterboards einschließen', checked: A.setting('expDeep', true), stay: true, act: () => { A.setSetting('expDeep', !A.setting('expDeep', true)); A.closeMenu(); } }, '-', { label: 'ZIP mit allen Bildern und Dateien', icon: 'dl', act: () => run('zip') }, { label: 'Drucken', icon: 'export', act: () => run('print') }, { label: 'Board als Datei sichern', icon: 'dl', act: () => backup(A.board) }], ...below(e), { title: 'Exportieren' }); }

/* ---------- Werkzeugleiste ---------- */
function colorGrid(cur, pick, list) {
  const sug = [...new Set(kids(A.board).flatMap(e => e.pal || []))].slice(0, 6);
  const cell = (c, name, ink) => h('button.cc' + ((cur || '') === c ? '.on' : '') + (c === 'transparent' ? '.transp' : '') + (c === '' ? '.none' : ''), { title: name || c, style: { background: c && c !== 'transparent' ? c : null, color: ink || inkOn(c) }, ...keep(() => pick(c, ink)) }, ink ? 'A' : '');
  return h('div.cgrid', (list ? list.map(c => cell(c, c || 'Standard')) : CARD_COLORS.map(([n, c, i]) => cell(c, n, i))), sug.length && !list ? [h('div.mtitle.full', 'Aus den Bildern'), sug.map(c => cell(c, c))] : null, h('label.cc.custom', { title: 'Eigene Farbe' }, '+', h('input', { type: 'color', value: hexNorm(cur) || '#0a84ff', onchange: e => pick(e.target.value) })));
}
const setAll = (els, patch) => tx(() => els.forEach(e => set(e.id, typeof patch === 'function' ? patch(e) : patch)));
function labelsMenu(e, els) {
  const L = kv('labels', {}), ids = Object.keys(L), has = id => els.every(x => (x.labels || []).includes(id));
  const toggle = id => { const on = has(id); setAll(els, x => ({ labels: on ? (x.labels || []).filter(l => l !== id) : [...new Set([...(x.labels || []), id])] })); };
  const inp = h('input.msearch', { placeholder: 'Label suchen oder anlegen', oninput: () => draw(), onkeydown: ev => { ev.stopPropagation(); if (ev.key === 'Enter' && inp.value.trim()) { const name = inp.value.trim(); let id = ids.find(i => L[i].name.toLowerCase() === name.toLowerCase()); if (!id) { id = uid(); L[id] = { name, color: LABEL_COLORS[ids.length % LABEL_COLORS.length] }; kvSet('labels', L); ids.push(id); } if (!has(id)) toggle(id); inp.value = ''; A.closeMenu(); } } });
  const list = h('div.mlist'); const count = id => all().filter(x => x.loc !== 'trash' && (x.labels || []).includes(id)).length;
  const draw = () => { list.innerHTML = ''; ids.filter(i => L[i].name.toLowerCase().includes(inp.value.toLowerCase())).forEach(id => list.append(h('div.mi.lrow', h('button.lpick', { onclick: () => { toggle(id); A.closeMenu(); } }, h('i.mdot', { style: { background: L[id].color } }), h('span.ml', L[id].name), has(id) ? ico('check', 15) : null), h('button.cnt', { title: 'Alle mit diesem Label suchen', onclick: () => { A.closeMenu(); A.search('label:' + L[id].name); } }, count(id)), h('button.dots', { 'aria-label': 'Label bearbeiten', onclick: ev => A.menu([{ label: 'Umbenennen', act: () => A.labelRename(id) }, ...LABEL_COLORS.map(c => ({ label: 'Farbe', color: c, act: () => { L[id].color = c; kvSet('labels', L); A.render(); } })), '-', { label: 'Label löschen', danger: true, act: () => { delete L[id]; kvSet('labels', L); tx(() => all().filter(x => (x.labels || []).includes(id)).forEach(x => set(x.id, { labels: x.labels.filter(l => l !== id) })), { undo: false }); A.render(); } }], ev.clientX, ev.clientY) }, ico('more', 16))))); if (!ids.length) list.append(h('p.mut.pad', 'Namen tippen und Enter drücken')); };
  draw(); A.pop(h('div.menu', h('div.mtitle', 'Labels'), inp, list), ...at(e)); if (innerWidth > 700) inp.focus();
}
A.labelRename = id => { const L = kv('labels', {}); A.prompt('Label umbenennen', L[id].name, v => { if (v) { L[id].name = v; kvSet('labels', L); $('#cards').innerHTML = ''; A.render(); } }); };
A.labelClick = (el, id, e) => { const n = e.currentTarget; n.focus(); n.onkeydown = ev => { if (ev.key === 'Backspace' || ev.key === 'Delete') { ev.stopPropagation(); ev.preventDefault(); tx(() => set(el.id, { labels: el.labels.filter(l => l !== id) })); } }; };
function reactMenu(e, els) { A.pop(h('div.emo', EMOJI.map(em => h('button', { onclick: () => { setAll(els, x => ({ reactions: toggleRx(x.reactions, em) })); A.closeMenu(); } }, em))), ...at(e)); }
function iconMenu(e, b) { const grid = h('div.emo.big'); const draw = q => { grid.innerHTML = ''; BOARD_ICONS.filter(([, k]) => !q || k.includes(q)).forEach(([em]) => grid.append(h('button', { onclick: () => { tx(() => set(b.id, { icon: em })); A.closeMenu(); } }, em))); }; draw('');
  A.pop(h('div.menu', h('input.msearch', { placeholder: 'Symbol suchen', oninput: ev => draw(ev.target.value.toLowerCase()), onkeydown: ev => ev.stopPropagation() }), grid, h('div.mtitle', 'Farbe'), colorGrid(b.color || '', c => { tx(() => set(b.id, { color: c && c !== 'transparent' ? c : null })); }, ['', '#ff6b5e', '#ff9f0a', '#ffd60a', '#30d158', '#40c8e0', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff8fb1', '#8e8e93', '#1c1c1e'])), ...at(e)); }
A.taskDue = (el, i, e) => { const it = el.items[i], d = it.due ? new Date(it.due - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 16) : '';
  const date = h('input.field', { type: 'date', value: d.slice(0, 10) }), time = h('input.field', { type: 'time', value: it.dueTime ? d.slice(11) : '' });
  const save = clear => { const its = structuredClone(get(el.id).items); if (clear || !date.value) { delete its[i].due; delete its[i].dueTime; } else { its[i].due = new Date(date.value + 'T' + (time.value || '09:00')).getTime(); its[i].dueTime = !!time.value; if (window.Notification?.permission === 'default') Notification.requestPermission(); } tx(() => set(el.id, { items: its })); A.closeMenu(); };
  A.pop(h('div.menu.padded', h('div.mtitle', 'Fällig am'), date, time, h('div.row.end', h('button.btn', { onclick: () => save(true) }, 'Entfernen'), h('button.btn.primary', { onclick: () => save() }, 'Setzen'))), e.clientX, e.clientY + 10); };
A.taskWho = (el, i, e) => { const setWho = who => { const its = structuredClone(get(el.id).items); who ? (its[i].who = who) : delete its[i].who; tx(() => set(el.id, { items: its })); if (who && who !== A.me()) A.notify(`${A.me()} hat ${who} eine Aufgabe zugewiesen: ${its[i].text}`, who, el.id); };
  A.menu([...A.people().map(p => ({ label: p, icon: 'user', checked: el.items[i].who === p, act: () => setWho(p) })), '-', { label: 'Person einladen …', icon: 'plus', act: () => A.prompt('Name oder E-Mail', '', v => { if (v) { A.addPerson(v); setWho(v); } }) }, el.items[i].who ? { label: 'Zuweisung entfernen', danger: true, act: () => setWho(null) } : null], e.clientX, e.clientY + 10, { search: 'Person suchen', title: 'Zuweisen' }); };
A.mention = node => { const s = getSelection(); if (!s.rangeCount) return; const r = s.getRangeAt(0).getBoundingClientRect(); A.menu(A.people().map(p => ({ label: p, icon: 'user', act: () => { node.focus(); getSelection().modify('extend', 'backward', 'character'); document.execCommand('insertHTML', false, `<span class="mention" contenteditable="false">@${esc(p)}</span>&nbsp;`); drafts.set(node.closest('.el')?.dataset.id, node.innerHTML); } })), r.left, r.bottom + 6); };

function toolsDefault() {
  const bar = A.setting('toolbar', DEFAULT_BAR), mk = ([t, label]) => h('button.tb.tool', { title: label + ' – ziehen oder klicken', 'aria-label': label, data: { tool: t } }, ico(t), h('span', label));
  return [TOOLS.filter(t => bar.includes(t[0])).map(mk),
    h('button.tb', { title: 'Mehr Werkzeuge', 'aria-label': 'Mehr', ...keep(e => { const r = at(e); A.pop(h('div.menu', h('div.mtitle', 'Weitere Elemente'), h('div.moregrid', TOOLS.filter(t => !bar.includes(t[0])).map(mk)), h('hr'), h('div.mtitle', 'Werkzeugleiste anpassen'), TOOLS.map(([t, l]) => h('label.check', h('input', { type: 'checkbox', checked: bar.includes(t) || null, onchange: ev => { const nb = ev.target.checked ? [...bar, t] : bar.filter(x => x !== t); A.setSetting('toolbar', TOOLS.map(x => x[0]).filter(x => nb.includes(x))); A.closeMenu(); refreshUI(true); } }), l))), ...r); }) }, ico('more'), h('span', 'Mehr')),
    h('span.sep'),
    btn('image', 'Bild', () => A.pickFile('image/*', fs => A.addFiles(fs, null, fs.length > 1 ? { loc: 'unsorted' } : {}), true), { title: 'Bild hinzufügen' }),
    btn('upload', 'Upload', () => A.pickFile('', fs => A.addFiles(fs), true), { title: 'Datei hochladen' }),
    btn('photo', 'Bildsuche', () => A.imageSearch()), btn('draw', 'Zeichnen', () => A.drawMode(), { title: 'Zeichnen (⇧D)' }), btn('tpl', 'Vorlagen', () => A.templates())];
}
function toolsText() {
  const f = k => () => { FMT[k](); A.editing?._commit?.(A.editing); };
  const styleMenu = e => A.menu([['h1', 'Große Überschrift', K + '⇧1'], ['h2', 'Überschrift', K + '⇧2'], ['p', 'Normaler Text', K + '⇧0'], ['small', 'Kleiner Text', K + '⇧9'], ['quote', 'Zitat', K + '"'], ['pre', 'Code-Block', K + '>'], ['callout', 'Hinweisbox'], ['code', 'Code im Text'], ['hr', 'Trennlinie', '---']].map(([k, l, hint]) => ({ label: l, hint, act: f(k) })), ...at(e), { title: 'Textstil' });
  const colMenu = (e, kind) => A.pop(h('div.menu', h('div.mtitle', kind === 'color' ? 'Textfarbe' : 'Markierung'), h('div.cgrid', (kind === 'color' ? ['', ...INK.slice(0, 11)] : ['', '#ffe066', '#b8f5c0', '#bfe3ff', '#ffc9de', '#e2d4ff', '#ffd6a5']).map(c => h('button.cc' + (c ? '' : '.none'), { style: { background: c || null }, title: c || 'Keine', ...keep(() => { FMT[kind](c); A.editing?._commit?.(A.editing); A.closeMenu(); }) })))), ...at(e));
  return [btn('title', 'Textstil', styleMenu), btn('bold', 'Fett', f('bold'), { title: `Fett (${K}B)` }), btn('italic', 'Kursiv', f('italic'), { title: `Kursiv (${K}I)` }), btn('under', 'Unterstr.', f('under'), { title: `Unterstrichen (${K}U)` }), btn('strike', 'Durchgestr.', f('strike'), { title: `Durchgestrichen (${K}⇧X)` }),
    btn(h('i.adot', 'A'), 'Farbe', e => colMenu(e, 'color')), btn(h('i.adot.hl', 'A'), 'Markieren', e => colMenu(e, 'mark'), { title: `Markieren (${K}J)` }), btn('link', 'Link', f('link'), { title: `Link (${K}K)` }), h('span.sep'),
    btn('ul', 'Liste', f('ul')), btn('ol', 'Nummern', f('ol')), btn('todo', 'Checkliste', f('chk')), btn('indent', 'Einrücken', f('indent')), btn('outdent', 'Ausrücken', f('outdent')), btn('center', 'Zentrieren', f('center'))];
}
function toolsSel(els) {
  const one = els.length === 1 ? els[0] : null, t = one?.type, ids = els.map(e => e.id), out = [], all1 = ty => els.every(e => e.type === ty);
  const colorable = els.filter(e => !['line', 'board', 'swatch', 'doc', 'sketch', 'map', 'audio', 'video'].includes(e.type));
  if (els.every(e => e.loc === 'trash')) return [btn('undo', 'Wiederherst.', () => A.act('restore', ids)), btn('trash', 'Endgültig', () => A.confirm('Endgültig löschen? Das lässt sich nicht rückgängig machen.', 'Löschen', () => { A.act('emptyTrash', ids); A.select([]); }), { cls: 'danger' })];
  if (colorable.length) out.push(btn(h('i.cdot', { style: { background: colorable[0].color && colorable[0].color !== 'transparent' ? colorable[0].color : null } }), ['image', 'file', 'link'].includes(colorable[0].type) ? 'Farbstreifen' : 'Farbe', e => A.pop(h('div.menu', h('div.mtitle', 'Kartenfarbe'), colorGrid(colorable[0].color || '', (c, ink) => { setAll(colorable, { color: c || null, ink: ink || null }); })), ...at(e))));
  if (t === 'todo' || t === 'table') out.push(btn('title', 'Titel', () => { tx(() => set(one.id, { hasTitle: !one.hasTitle })); if (!one.hasTitle) A.startEdit(A.node(one.id)?.querySelector('.ttitle')); }, { on: one.hasTitle }));
  if (t === 'todo') { const ti = () => +(A.lastTask?.id === one.id ? A.lastTask.i : 0); out.push(btn('cal', 'Fällig', e => { const r = at(e); A.taskDue(one, clamp(ti(), 0, one.items.length - 1), { clientX: r[0], clientY: r[1] }); }), btn('user', 'Zuweisen', e => { const r = at(e); A.taskWho(one, clamp(ti(), 0, one.items.length - 1), { clientX: r[0], clientY: r[1] }); })); }
  if (t === 'link' && one.url) out.push(btn('image', 'Bild', () => setAll(els, { showImg: one.showImg === false }), { on: one.showImg !== false }), btn('caption', 'Beschreib.', () => setAll(els, { showDesc: one.showDesc === false }), { on: one.showDesc !== false }), btn('dup', 'Link kopieren', () => { navigator.clipboard?.writeText(one.url); A.toast('Link kopiert'); }), btn('ext', 'Öffnen', () => window.open(one.url, '_blank', 'noopener')));
  if (all1('line')) { const l = els[0]; out.push(btn(h('i.cdot', { style: { background: l.color || 'var(--line)' } }), 'Farbe', e => A.pop(h('div.menu', h('div.cgrid', ['', ...INK.slice(0, 11)].map(c => h('button.cc' + (c ? '' : '.none'), { style: { background: c || null }, onclick: () => { setAll(els, { color: c || null }); A.closeMenu(); } })))), ...at(e))),
    btn(h('i.lw', { style: { height: (l.width || 2) + 'px' } }), 'Stärke', () => setAll(els, { width: (l.width || 2) === 2 ? 4 : (l.width || 2) === 4 ? 7 : 2 })), btn(h('i.lw.dash'), 'Gestrichelt', () => setAll(els, { dash: !l.dash }), { on: l.dash }),
    btn('line', 'Pfeilspitzen', () => { const st = [[false, true], [true, true], [false, false], [true, false]], i = st.findIndex(s => s[0] === !!l.headA && s[1] === (l.headB !== false)); const n = st[(i + 1) % 4]; setAll(els, { headA: n[0], headB: n[1] }); }),
    btn('title', 'Beschriftung', () => { if (one) { if (one.label == null) { one.label = ''; A.drawLines(); } A.startEdit($(`.linelabel[data-line="${one.id}"]`)); } }), l.bend ? btn('collapse', 'Gerade', () => setAll(els, { bend: null })) : null); }
  if (t === 'board') { const b = realBoard(one); if (b) out.push(btn(h('span.temo', b.icon || autoIcon(b.title)), 'Symbol', e => iconMenu(e, b)), one.alias ? null : btn('pen', 'Umbenennen', () => A.startEdit(A.node(one.id)?.querySelector('.btitle')))); }
  if (t === 'column') out.push(btn(one.collapsed ? 'down' : 'collapse', one.collapsed ? 'Ausklappen' : 'Einklappen', () => tx(() => set(one.id, { collapsed: !one.collapsed }))), btn('pen', 'Umbenennen', () => A.startEdit(A.node(one.id)?.querySelector('.ctitle'))));
  if (t === 'table' && table.T.id === one.id) out.push(btn('sum', 'Formel', e => table.formula(one, ...at(e))), btn('grid', 'Zelltyp', e => A.menu(table.TYPES.map(([k, l]) => ({ label: l, act: () => table.setType(one, k) })), ...at(e), { title: 'Zelltyp' })),
    btn(h('i.adot', 'A'), 'Textfarbe', e => A.pop(h('div.menu', h('div.cgrid', ['', ...INK.slice(0, 11)].map(c => h('button.cc' + (c ? '' : '.none'), { style: { background: c || null }, onclick: () => { table.setFmt(one, { color: c || null }); A.closeMenu(); } })))), ...at(e))),
    btn('bg', 'Zellfarbe', e => A.pop(h('div.menu', h('div.cgrid', ['', '#fff3bf', '#d3f9d8', '#d0ebff', '#ffe3e3', '#f3d9fa', '#e9ecef', '#ffd8a8'].map(c => h('button.cc' + (c ? '' : '.none'), { style: { background: c || null }, onclick: () => { table.setFmt(one, { bg: c || null }); A.closeMenu(); } })))), ...at(e))));
  if (all1('image')) out.push(btn('caption', 'Unterschrift', () => { const on = !(one || els[0]).showCaption; setAll(els, { showCaption: on }); if (on && one) A.startEdit(A.node(one.id)?.querySelector('.cap')); }, { on: els[0].showCaption }), one ? btn('eye', 'Vorschau', () => A.viewer(one.id)) : null, one ? btn('draw', 'Bemalen', () => A.viewer(one.id, 'draw')) : null, one ? btn('crop', 'Zuschneiden', () => A.viewer(one.id, 'crop')) : null, one ? btn('wand', 'Freistellen', () => A.viewer(one.id, 'bg')) : null, btn('dl', 'Original', () => A.act('download', ids)));
  if (t === 'file') out.push(btn('eye', one.view === 'preview' ? 'Als Symbol' : 'Vorschau', () => tx(() => set(one.id, { view: one.view === 'preview' ? 'icon' : 'preview' })), { on: one.view === 'preview' }), btn('ext', 'Öffnen', () => A.fileViewer(one.id)), btn('dl', 'Download', () => A.act('download', ids)), btn('image', 'Vorschaubild', () => A.pickFile('image/*', async f => { const b = await putBlob(f); tx(() => set(one.id, { thumb: b })); })));
  if (t === 'sketch') out.push(btn('draw', 'Bearbeiten', () => A.sketchEdit(one.id)), btn('dl', 'SVG', () => A.act('download', ids)));
  if (all1('swatch')) out.push(one ? btn('swatch', 'Farbe wählen', () => A.colorPicker(one.id)) : null, btn('grid', 'Wert', e => A.menu([['hex', 'HEX'], ['rgb', 'RGB'], ['hsl', 'HSL'], ['none', 'Kein Wert']].map(([k, l]) => ({ label: l, checked: (els[0].show || 'hex') === k, act: () => setAll(els, { show: k }) })), ...at(e))), btn('caption', 'Name', () => setAll(els, { showCaption: els[0].showCaption === false }), { on: els[0].showCaption !== false }));
  if (t === 'doc') out.push(btn('ext', 'Öffnen', () => A.openDoc(one.id)), btn('eye', 'Kartenansicht', () => tx(() => set(one.id, { view: one.view === 'preview' ? 'icon' : 'preview', w: 280 })), { on: one.view === 'preview' }), btn('export', 'Export', e => A.menu(['pdf', 'word', 'md', 'txt'].map(f => ({ label: { pdf: 'PDF', word: 'Word', md: 'Markdown', txt: 'Reiner Text' }[f], act: () => exportDoc(one.id, f) })), ...at(e))));
  if ((t === 'audio' || t === 'video') && one.blob) out.push(btn('sync', 'Schleife', () => tx(() => set(one.id, { loop: !one.loop })), { on: one.loop }), btn('play', 'Autoplay', () => tx(() => set(one.id, { autoplay: !one.autoplay })), { on: one.autoplay }));
  if (t === 'video') out.push(btn('image', 'Vorschaubild', () => A.pickFile('image/*', async f => { const b = await putBlob(f); tx(() => set(one.id, { thumb: b })); })), btn('caption', 'Beschreib.', () => tx(() => set(one.id, { showCaption: !one.showCaption })), { on: one.showCaption }));
  if (t === 'note' && one.sync) out.push(btn('sync', 'Sync lösen', () => A.act('unsync', ids), { on: true }));
  if (t === 'comment' && one.pin) out.push(btn('pin', 'Lösen', () => A.act('unpin', ids)));
  if (els.length > 1) { const cm = els.find(e => e.type === 'comment'), other = els.find(e => e.type !== 'comment' && e.type !== 'line'); if (els.length === 2 && cm && other) out.push(btn('pin', 'Anheften', () => tx(() => set(cm.id, { pin: other.id, col: null }))));
    out.push(btn('column', 'Gruppieren', () => A.act('groupCol', ids), { title: 'In Spalte gruppieren' }), btn('connect', 'Verbinden', () => A.act('connect', ids), { title: `Mit Linien verbinden (${K}K)` }),
      btn('distH', 'Anordnen', e => A.menu([{ label: 'Links ausrichten', act: () => A.act('align', ids, 'left') }, { label: 'Horizontal zentrieren', act: () => A.act('align', ids, 'center') }, { label: 'Rechts ausrichten', act: () => A.act('align', ids, 'right') }, '-', { label: 'Oben ausrichten', act: () => A.act('align', ids, 'top') }, { label: 'Vertikal zentrieren', act: () => A.act('align', ids, 'middle') }, { label: 'Unten ausrichten', act: () => A.act('align', ids, 'bottom') }, '-', { label: 'Horizontal verteilen', icon: 'distH', act: () => A.act('dist', ids, 'h') }, { label: 'Vertikal verteilen', icon: 'distV', act: () => A.act('dist', ids, 'v') }], ...at(e), { title: 'Ausrichten und verteilen' }))); }
  out.push(h('span.sep'));
  if (!all1('line')) out.push(btn('tag', 'Labels', e => labelsMenu(e, els)), btn('smile', 'Reaktion', e => reactMenu(e, els)));
  out.push(btn('lock', els.every(e => e.locked) ? 'Entsperren' : 'Sperren', () => A.act(els.every(e => e.locked) ? 'unlock' : 'lock', ids), { on: els.every(e => e.locked) }), btn('dup', 'Duplizieren', () => A.act('duplicate', ids), { title: `Duplizieren (${K}D)` }), btn('trash', 'Löschen', () => A.act('delete', ids), { cls: 'danger' }));
  return out;
}
document.addEventListener('focusin', e => { const t = e.target.closest?.('.task'); if (t) A.lastTask = { id: t.closest('.el').dataset.id, i: +t.dataset.i }; });
let uiSig = '';
export function refreshUI(force) {
  refreshTop();
  const tools = $('#tools'), els = A.selEls(), ed = A.editing, ro = A.readonly();
  const mode = ro ? 'ro' : ed?.dataset.rich ? 'text' : els.length ? 'sel' : 'def';
  const sig = mode + (A.role || '') + '|' + els.map(e => e.id + e.modified).join() + (table.T.id || '') + (force ? Math.random() : '');
  const cm = ro && A.role === 'comment' && !A.mode.present; tools.hidden = ro && !cm; document.body.classList.toggle('readonly', ro); document.body.classList.toggle('viewer', A.role === 'view');
  if (sig !== uiSig) { uiSig = sig; tools.innerHTML = ''; tools.dataset.mode = mode;
    if (mode !== 'def' && mode !== 'ro') tools.append(h('button.tb.backb', { title: 'Zurück zu den Werkzeugen', ...keep(() => { A.stopEdit(); A.select([]); }) }, ico('back'), h('span', 'Fertig')));
    tools.append(...(mode === 'text' ? toolsText() : mode === 'sel' ? toolsSel(els) : mode === 'def' ? toolsDefault() : cm ? [btn('comment', 'Kommentar', () => A.create('comment')), btn('draw', 'Zeichnen', () => A.drawMode()), els.length ? btn('smile', 'Reaktion', e => A.pop(h('div.emo', EMOJI.map(em => h('button', { onclick: () => { els.forEach(x => A.remoteRx(x.id, em)); A.closeMenu(); } }, em))), ...at(e))) : null] : []).flat().filter(Boolean)); }
  const tr = all().filter(e => e.loc === 'trash').length; $('#trashBtn').classList.toggle('full', tr > 0); $('#trashBtn').hidden = ro;
  if (!$('#trash').hidden) drawTrash();
  $('#untitle').textContent = 'Ablage · ' + kids(A.board, 'unsorted').length;
  const tp = $('#tplpick'); if (tp) tp.hidden = ro || A.board === 'home' || all().some(e => e.board === A.board && e.loc !== 'trash') || A.tplDismiss === A.board;
  if (A.pinOpen) drawPin();
}
// Werkzeug aus der Leiste ziehen oder klicken
function toolDrag() {
  let d = null;
  document.addEventListener('pointerdown', e => { const b = e.target.closest('.tool[data-tool]'); if (!b || e.button) return; e.preventDefault(); d = { t: b.dataset.tool, x: e.clientX, y: e.clientY, ghost: null }; });
  addEventListener('pointermove', e => { if (!d) return; if (!d.ghost && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) { d.ghost = h('div.ghost.glass', ico(d.t), TOOLS.find(t => t[0] === d.t)[1]); document.body.append(d.ghost); A.closeMenu(); } if (d.ghost) { d.ghost.style.left = e.clientX + 'px'; d.ghost.style.top = e.clientY + 'px'; } });
  addEventListener('pointerup', e => { if (!d) return; const g = d; d = null; g.ghost?.remove(); A.closeMenu();
    const over = document.elementFromPoint(e.clientX, e.clientY), onStage = over?.closest('#stage');
    if (g.ghost && !onStage) return;
    const pt = g.ghost ? A.toWorld(e.clientX, e.clientY) : null, coln = g.ghost && over?.closest('.el-column'), col = coln && get(coln.dataset.id);
    const el = A.create(g.t, pt, col && !col.collapsed && !['column', 'line'].includes(g.t) ? { col: col.id, ord: 1e6 } : {}, { corner: !!pt });
    if (g.t === 'line') A.select([el.id]); });
}

/* ---------- Rechtsklick ---------- */
A.ctxMenu = (x, y) => {
  const els = A.selEls(), ids = els.map(e => e.id), one = els.length === 1 ? els[0] : null, ro = A.readonly(), pt = A.toWorld(x, y), m = [];
  if (ro) { if (els.length) m.push({ label: 'Kopieren', icon: 'dup', act: () => A.act('copy') }); if (one && ['image', 'file'].includes(one.type) && A.spaceInfo?.(path(A.board)[0]?.id)?.downloads !== false) m.push({ label: 'Herunterladen', icon: 'dl', act: () => A.act('download', ids) }); return m.length && A.menu(m, x, y); }
  if (!els.length) return A.menu([{ label: 'Einfügen', icon: 'note', hint: K + 'V', act: () => A.act('paste', [], pt) }, '-', ...TOOLS.slice(0, 8).map(([t, l]) => ({ label: l, icon: t, act: () => A.create(t, pt, {}, { corner: true }) })), '-', { label: 'Alles auswählen', hint: K + 'A', act: () => A.select(kids(A.board).map(e => e.id)) }, { label: 'Alles einpassen', hint: 'Z', icon: 'fit', act: () => A.fit() }], x, y);
  if (els.every(e => e.loc === 'trash')) return A.menu([{ label: 'Wiederherstellen', icon: 'undo', act: () => A.act('restore', ids) }, { label: 'Hier ablegen', act: () => A.act('restore', ids, A.center()) }, { label: 'Endgültig löschen', danger: true, icon: 'trash', act: () => A.act('emptyTrash', ids) }], x, y);
  m.push({ label: 'Kopieren', hint: K + 'C', act: () => A.act('copy') }, { label: 'Ausschneiden', hint: K + 'X', act: () => A.act('cut') }, { label: 'Einfügen', hint: K + 'V', act: () => A.act('paste', [], pt) }, { label: 'Duplizieren', hint: K + 'D', icon: 'dup', act: () => A.act('duplicate', ids) });
  if (els.every(e => e.type === 'note')) m.push({ label: 'Duplizieren und synchron halten', icon: 'sync', act: () => A.act('dupSync', ids) });
  m.push('-', { label: els.every(e => e.locked) ? 'Position entsperren' : 'Position sperren', icon: 'lock', act: () => A.act(els.every(e => e.locked) ? 'unlock' : 'lock', ids) }, { label: 'In den Vordergrund', hint: K + '⇧↑', act: () => A.act('front', ids) }, { label: 'In den Hintergrund', hint: K + '⇧↓', act: () => A.act('back', ids) }, { label: 'In Board verschieben …', icon: 'board', act: () => A.act('moveTo', ids) });
  if (els.some(e => e.type !== 'column' && e.type !== 'line')) m.push({ label: 'In Spalte gruppieren', icon: 'column', act: () => A.act('groupCol', ids) });
  if (els.length > 1) m.push({ label: 'Mit Linien verbinden', icon: 'connect', hint: K + 'K', act: () => A.act('connect', ids) });
  const sp = [];
  if (one?.type === 'column') sp.push({ label: 'Spalte in Board umwandeln', icon: 'board', act: () => A.act('colToBoard', ids) }, { label: 'Spalte auflösen', act: () => A.act('ungroup', ids) });
  if (one?.type === 'note') sp.push({ label: 'In Dokument umwandeln', icon: 'doc', act: () => A.act('toDoc', ids) });
  if (one?.type === 'doc') sp.push({ label: 'In Notiz umwandeln', icon: 'note', act: () => A.act('toNote', ids) });
  if (one?.type === 'board') { const b = realBoard(one); if (!one.alias) sp.push({ label: 'Verknüpfung zu diesem Board erstellen', icon: 'ext', act: () => A.act('alias', ids) }); else if (b) sp.push({ label: 'Verknüpftes Board duplizieren', icon: 'dup', act: () => A.act('dupTarget', ids) });
    if (b) sp.push(b.template ? { label: 'Vorlage wieder in Board umwandeln', act: () => A.act('revertTemplate', ids) } : { label: 'In Vorlage umwandeln', icon: 'tpl', act: () => A.act('toTemplate', ids) }, { label: 'Link zum Board kopieren', icon: 'link', act: () => { navigator.clipboard?.writeText(location.origin + location.pathname + '#/b/' + b.id); A.toast('Link kopiert'); } }); }
  if (one?.type === 'image') sp.push({ label: 'Bild ersetzen …', icon: 'image', act: () => A.pickFile('image/*', async f => { const b = await putBlob(f); tx(() => set(one.id, { src: b, orig: null, pal: null, nw: null, nh: null, strokes: [] })); }) }, { label: 'Auf Raster zuschneiden', checked: !!one.gridCrop, act: () => tx(() => set(one.id, { gridCrop: !one.gridCrop })) }, { label: 'Original herunterladen', icon: 'dl', act: () => A.act('download', ids) });
  if (one?.type === 'link' || one?.type === 'file' || one?.type === 'video') sp.push({ label: 'Vorschaubild ersetzen …', icon: 'image', act: () => A.pickFile('image/*', async f => { const b = await putBlob(f); tx(() => set(one.id, one.type === 'link' ? { img: b, showImg: true } : { thumb: b })); }) });
  if (one?.type === 'sketch') sp.push({ label: 'SVG herunterladen', icon: 'dl', act: () => A.act('download', ids) });
  if (one?.type === 'comment' && one.pin) sp.push({ label: 'Von Karte lösen', icon: 'pin', act: () => A.act('unpin', ids) });
  if (sp.length) m.push('-', ...sp);
  m.push('-', { label: 'Löschen', danger: true, icon: 'trash', hint: '⌫', act: () => A.act('delete', ids) });
  const foot = one ? h('div.mfoot', h('span', { title: new Date(one.created).toLocaleString('de-DE') }, 'Erstellt ' + fmtDate(one.created)), h('span', { title: new Date(one.modified).toLocaleString('de-DE') }, 'Geändert ' + fmtDate(one.modified))) : null;
  A.menu(m, x, y, { foot });
};
A.boardPicker = (title, cb) => { const items = all().filter(e => e.type === 'board' && !e.alias && e.loc !== 'trash' && e.id !== A.board).sort((a, b) => kv('recent', []).indexOf(a.id) - kv('recent', []).indexOf(b.id)).map(b => ({ label: (b.title || (b.id === 'home' ? 'Start' : 'Ohne Titel')) + (b.board && b.board !== 'home' ? '  ·  ' + (get(b.board)?.title || '') : ''), icon: b.id === 'home' ? 'home' : b.icon || autoIcon(b.title), act: () => cb(b.id) })); A.menu(items, innerWidth / 2 - 150, 90, { search: 'Board suchen', title }); };

/* ---------- Ablage und Papierkorb ---------- */
A.toggleUnsorted = on => { const u = $('#unsorted'); u.hidden = on == null ? !u.hidden : !on; document.body.classList.toggle('un-open', !u.hidden); A.render(); };
function drawTrash() {
  const mine = $('#trash').dataset.tab !== 'others', list = all().filter(e => e.loc === 'trash' && (mine ? (e.deletedBy || A.me()) === A.me() : e.deletedBy && e.deletedBy !== A.me() && e.board === A.board)).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)), box = $('#trashList'); box.innerHTML = '';
  $$('#trash .tabs button').forEach(b => b.classList.toggle('on', (b.dataset.tab === 'others') === !mine));
  if (!list.length) return box.append(h('p.mut.pad', mine ? 'Der Papierkorb ist leer. Gelöschtes bleibt drei Monate erhalten.' : 'Auf diesem Board hat niemand sonst etwas gelöscht.'));
  list.forEach(e => { const n = build(e); n.classList.toggle('sel', A.sel.has(e.id)); n.querySelectorAll('.rz,.lh').forEach(x => x.remove()); if (e.type === 'line') n.append(h('div.ph', ico('line'), 'Linie'));
    box.append(h('div.titem', { data: { id: e.id }, onclick: ev => { A.select([e.id], ev.shiftKey || mod(ev)); drawTrash(); }, oncontextmenu: ev => { ev.preventDefault(); if (!A.sel.has(e.id)) A.select([e.id]); A.ctxMenu(ev.clientX, ev.clientY); } }, n, h('div.tmeta2', h('span', (get(e.board)?.title || 'Board') + ' · ' + fmtDate(e.deletedAt || e.modified)), h('button.link', { onclick: ev => { ev.stopPropagation(); A.act('restore', [e.id]); } }, 'Wiederherstellen')))); });
}
function initPanels() {
  $('#trashBtn').onclick = () => { const t = $('#trash'); t.hidden = !t.hidden; if (!t.hidden) drawTrash(); else A.select([]); };
  $('#trash').append(h('header', h('h2', 'Papierkorb'), h('button.x', { 'aria-label': 'Schließen', onclick: () => { $('#trash').hidden = true; A.select([]); } }, ico('x'))), h('div.tabs', h('button', { data: { tab: 'mine' }, onclick: () => { $('#trash').dataset.tab = 'mine'; drawTrash(); } }, 'Von mir gelöscht'), h('button', { data: { tab: 'others' }, onclick: () => { $('#trash').dataset.tab = 'others'; drawTrash(); } }, 'Von anderen gelöscht')), h('div#trashList'),
    h('footer', h('button.btn.danger', { onclick: () => A.confirm('Papierkorb endgültig leeren?', 'Leeren', () => { A.act('emptyTrash', all().filter(e => e.loc === 'trash').map(e => e.id)); }) }, 'Papierkorb leeren')));
  $('#unsorted').prepend(h('header', h('h2#untitle', 'Ablage'), h('button.x', { 'aria-label': 'Schließen', onclick: () => A.toggleUnsorted(false) }, ico('x'))), h('p.hint.helper', 'Sammelstelle dieses Boards. Karten hierher ziehen und später einsortieren.'));
  // alte Papierkorb-Einträge nach drei Monaten entfernen
  const old = all().filter(e => e.loc === 'trash' && e.deletedAt && e.deletedAt < now() - 92 * 864e5).map(e => e.id); if (old.length) A.act('emptyTrash', old);
}

/* ---------- Angeheftete Kommentare ---------- */
A.openPin = (id, anchor) => { if (A.pinOpen === id) return A.closePin(); A.closePin(); A.pinOpen = id; const r = anchor.getBoundingClientRect(); const p = h('div.pinpop.glass', { data: { pin: id } }); document.body.append(p); drawPin(); p.style.left = clamp(r.right + 8, 8, innerWidth - 290) + 'px'; p.style.top = clamp(r.top - 10, 8, innerHeight - 200) + 'px'; };
A.closePin = () => { $('.pinpop')?.remove(); A.pinOpen = null; };
function drawPin() { const p = $('.pinpop'), el = get(A.pinOpen); if (!p || !el || el.loc === 'trash' || !el.pin) return A.closePin(); if (p.contains(document.activeElement) && p._m === el.modified) return; p._m = el.modified; const n = build(el); n.querySelectorAll('.rz,.lh').forEach(x => x.remove()); p.innerHTML = ''; p.append(h('div.pinhead', h('button.link', { onclick: () => A.act('unpin', [el.id]) }, 'Lösen'), h('button.link', { onclick: () => { A.closePin(); A.act('delete', [el.id]); } }, 'Löschen'), h('button.x', { onclick: A.closePin }, ico('x', 16))), n); }
addEventListener('pointerdown', e => { if (A.pinOpen && !e.target.closest('.pinpop,.pinb,.pop')) A.closePin(); }, true);

/* ---------- Suche ---------- */
A.search = (q0 = '') => {
  const inp = h('input.field.big', { placeholder: 'Boards, Notizen, Labels durchsuchen …', value: q0 }), res = h('div.results'); let sort = 'viewed', scope = 'all', shared = false;
  const snippet = e => e.title || e.name || e.caption || e.url || textOf(e.html || '').trim().slice(0, 140) || (e.items || []).map(i => i.text).join(' · ').slice(0, 140) || (e.thread || []).map(m => textOf(m.html)).join(' · ').slice(0, 140) || (e.cells || []).flat().filter(Boolean).join(' · ').slice(0, 140) || e.label || '';
  const hay = e => [e.title, e.name, e.caption, e.url, e.desc, e.label, e.hex, textOf(e.html || ''), (e.items || []).map(i => i.text + ' ' + (i.who || '')).join(' '), (e.thread || []).map(m => textOf(m.html)).join(' '), (e.cells || []).flat().join(' '), (e.labels || []).map(l => 'label:' + (kv('labels', {})[l]?.name || '')).join(' ')].join(' ').toLowerCase();
  const draw = () => { const q = inp.value.trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean), rec = kv('recent', []); res.innerHTML = '';
    let list = all().filter(e => e.id !== 'home' && e.loc !== 'trash' && e.type !== 'line' && !e.alias && (scope === 'all' || path(e.board).some(p => p.id === A.board)) && (!shared || e.space || path(e.board).some(p => p.space)));
    if (!q) list = list.filter(e => e.type === 'board').sort((a, b) => (rec.indexOf(a.id) < 0 ? 1e9 : rec.indexOf(a.id)) - (rec.indexOf(b.id) < 0 ? 1e9 : rec.indexOf(b.id))).slice(0, 12);
    else list = list.filter(e => { const t = hay(e); return words.every(w => t.includes(w)); }).sort((a, b) => (b.type === 'board') - (a.type === 'board') || (sort === 'modified' ? b.modified - a.modified : (rec.indexOf(a.board) < 0 ? 1e9 : rec.indexOf(a.board)) - (rec.indexOf(b.board) < 0 ? 1e9 : rec.indexOf(b.board)) || b.modified - a.modified)).slice(0, 80);
    res.append(h('div.mtitle', q ? list.length + ' Treffer' : 'Zuletzt besucht'));
    list.forEach(e => res.append(h('button.res', { onclick: () => { if (e.type === 'board') A.openBoard(e.id); else A.openBoard(e.board, e.col || e.id); if (innerWidth < 700) A.closeModal(); } }, h('span.rico', e.type === 'board' ? h('span', e.icon || autoIcon(e.title)) : ico(e.type === 'file' ? 'upload' : e.type)), h('span.rtext', h('b', e.type === 'board' ? e.title || 'Ohne Titel' : snippet(e) || NAMES[e.type]), h('small', (e.type === 'board' ? 'Board' : NAMES[e.type]) + ' · ' + path(e.board).map(p => p.title || 'Start').join(' › ') + (e.loc === 'unsorted' ? ' · Ablage' : ''))))));
    if (!list.length) res.append(h('p.mut.pad', 'Nichts gefunden')); };
  const seg = (opts, get_, set_) => h('div.seg', opts.map(([k, l]) => h('button' + (get_() === k ? '.on' : ''), { onclick: e => { set_(k); $$('button', e.target.parentNode).forEach(b => b.classList.toggle('on', b === e.target)); draw(); } }, l)));
  inp.addEventListener('input', debounce(draw, 120)); inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') A.closeModal(); if (e.key === 'Enter') res.querySelector('.res')?.click(); });
  A.modal('Suche', h('div.search', inp, h('div.row.wrap', seg([['all', 'Alle Boards'], ['here', 'Dieses Board']], () => scope, v => (scope = v)), seg([['viewed', 'Zuletzt angesehen'], ['modified', 'Zuletzt geändert']], () => sort, v => (sort = v)), h('label.check', h('input', { type: 'checkbox', onchange: e => { shared = e.target.checked; draw(); } }), 'Nur geteilte')), res), { cls: 'side' }); draw(); inp.focus();
};

/* ---------- Bildbetrachter ---------- */
A.viewer = (id, tool) => {
  const order = () => kids(A.board).concat(all().filter(e => e.col && get(e.col)?.board === A.board)).filter(e => e.type === 'image' && e.loc !== 'trash').sort((a, b) => (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0));
  let cur = id; const img = h('img.vimg', { alt: '' }), stageV = h('div.vstage', img), bar = h('div.vbar'), ro = A.readonly();
  const saveBlob = async (blob, extra = {}) => { const e = get(cur), b = await putBlob(blob), bm = await createImageBitmap(blob); tx(() => set(cur, { src: b, orig: e.orig || e.src, nw: bm.width, nh: bm.height, pal: null, ...extra })); show(); };
  const canvasOf = async () => { const im = new Image(); im.crossOrigin = 'anonymous'; im.src = await blobUrl(get(cur).src); await im.decode(); return im; };
  const show = async () => { const e = get(cur); if (!e) return A.closeModal(); stageV.querySelectorAll('.strokes,.cropbox,.pad-svg').forEach(n => n.remove()); img.src = await blobUrl(e.src); img.style.aspectRatio = e.nw ? e.nw / e.nh : '';
    if (e.strokes?.length) import('./sketch.js').then(m => stageV.append(m.strokesSvg(e.strokes, e.nw || 1000, e.nh || 1000)));
    bar.innerHTML = ''; const list = order();
    ap(bar, h('button.btn', { title: 'Vorheriges (←)', onclick: () => step(-1), disabled: list.length < 2 || null }, ico('back', 16)), h('button.btn', { title: 'Nächstes (→)', onclick: () => step(1), disabled: list.length < 2 || null }, ico('chev', 16)), h('span.grow', e.caption || e.name || ''),
      ro ? null : [h('button.btn', { onclick: draw_ }, ico('draw', 16), 'Zeichnen'), h('button.btn', { onclick: crop }, ico('crop', 16), 'Zuschneiden'), h('button.btn', { onclick: rotate }, ico('rotate', 16), 'Drehen'), h('button.btn', { onclick: removeBg }, ico('wand', 16), 'Freistellen'), e.orig ? h('button.btn', { onclick: () => { tx(() => set(cur, { src: e.orig, orig: null, nw: null, nh: null, pal: null, strokes: [] })); setTimeout(show, 50); } }, 'Original') : null],
      h('button.btn', { onclick: () => A.act('download', [cur]) }, ico('dl', 16), 'Download'), h('button.btn', { onclick: async () => window.open(await blobUrl(e.src), '_blank') }, ico('ext', 16), 'Neuer Tab')); };
  const step = d => { const l = order(), i = l.findIndex(e => e.id === cur); if (l.length) { cur = l[(i + d + l.length) % l.length].id; show(); } };
  const draw_ = () => { const e = get(cur); stageV.querySelector('.strokes')?.remove(); bar.hidden = true; openPad({ host: stageV, w: e.nw || img.naturalWidth, h: e.nh || img.naturalHeight, strokes: e.strokes, bgImg: img, onDone: s => { bar.hidden = false; if (s) tx(() => set(cur, { strokes: s, nw: e.nw || img.naturalWidth, nh: e.nh || img.naturalHeight })); show(); } }); };
  const crop = () => { const box = h('div.cropbox', ['nw', 'ne', 'sw', 'se'].map(c => h('i', { data: { c } }))); let r = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }; const lay = () => Object.assign(box.style, { left: r.x * 100 + '%', top: r.y * 100 + '%', width: r.w * 100 + '%', height: r.h * 100 + '%' }); lay(); stageV.append(box);
    box.onpointerdown = ev => { ev.preventDefault(); const c = ev.target.dataset.c, s = stageV.getBoundingClientRect(), r0 = { ...r }, x0 = ev.clientX, y0 = ev.clientY;
      const mv = e2 => { const dx = (e2.clientX - x0) / s.width, dy = (e2.clientY - y0) / s.height; if (!c) { r.x = clamp(r0.x + dx, 0, 1 - r.w); r.y = clamp(r0.y + dy, 0, 1 - r.h); } else { if (c.includes('w')) { r.x = clamp(r0.x + dx, 0, r0.x + r0.w - 0.05); r.w = r0.x + r0.w - r.x; } if (c.includes('e')) r.w = clamp(r0.w + dx, 0.05, 1 - r0.x); if (c.includes('n')) { r.y = clamp(r0.y + dy, 0, r0.y + r0.h - 0.05); r.h = r0.y + r0.h - r.y; } if (c.includes('s')) r.h = clamp(r0.h + dy, 0.05, 1 - r0.y); } lay(); }, up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up); };
    bar.innerHTML = ''; ap(bar, h('span.grow', 'Ausschnitt wählen'), h('button.btn', { onclick: show }, 'Abbrechen'), h('button.btn.primary', { onclick: async () => { const im = await canvasOf(), c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * r.w); c.height = Math.round(im.naturalHeight * r.h); c.getContext('2d').drawImage(im, -im.naturalWidth * r.x, -im.naturalHeight * r.y); c.toBlob(b => saveBlob(b, { strokes: [] }), 'image/png'); } }, 'Zuschneiden')); };
  const rotate = async () => { const im = await canvasOf(), c = document.createElement('canvas'); c.width = im.naturalHeight; c.height = im.naturalWidth; const x = c.getContext('2d'); x.translate(c.width / 2, c.height / 2); x.rotate(Math.PI / 2); x.drawImage(im, -im.naturalWidth / 2, -im.naturalHeight / 2); c.toBlob(b => saveBlob(b, { strokes: [] }), 'image/png'); };
  const removeBg = async () => { const m = new Date().toISOString().slice(0, 7), use = kv('bgUse', {}); A.toast(`Hintergrund wird entfernt … (${use[m] || 0} in diesem Monat)`);
    try { const lib = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm'); const out = await (lib.removeBackground || lib.default)(await getBlob(get(cur).src) || await blobUrl(get(cur).src)); use[m] = (use[m] || 0) + 1; kvSet('bgUse', use); await saveBlob(out); A.toast('Hintergrund entfernt', 'Original wiederherstellen', () => { const e = get(cur); tx(() => set(cur, { src: e.orig, orig: null, nw: null, nh: null })); }); }
    catch (err) { console.error(err); A.toast('Freistellen ist hier nicht verfügbar (das Modell konnte nicht geladen werden)'); } };
  const key = e => { if (A.pad) return; if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); };
  addEventListener('keydown', key); A.modal('Bild', h('div.viewer', stageV, bar), { cls: 'full', onClose: () => { removeEventListener('keydown', key); A.pad?.close(false); } }); show().then(() => { if (tool === 'draw') draw_(); if (tool === 'crop') crop(); if (tool === 'bg') removeBg(); });
};
A.fileViewer = async id => { const e = get(id), url = await blobUrl(e.blob), mime = e.mime || ''; let body;
  if (mime === 'application/pdf') body = h('iframe.fview', { src: url, title: e.name }); else if (/^image\//.test(mime)) body = h('img.vimg', { src: url, alt: e.name }); else if (/^video\//.test(mime)) body = h('video.vimg', { src: url, controls: true }); else if (/^audio\//.test(mime)) body = h('audio', { src: url, controls: true });
  else if (/^text\//.test(mime) || /\.(csv|js|json|md|txt|xml|html|css)$/i.test(e.name)) { body = h('pre.fview.txt'); (await getBlob(e.blob)).slice(0, 2e5).text().then(t => (body.textContent = t)); } else body = h('div.ph.big', h('div.fico', (e.name || '').split('.').pop().toUpperCase().slice(0, 4)), h('p', e.name), h('p.mut', fmtSize(e.size || 0) + ' · keine Vorschau für diesen Dateityp'));
  A.modal(e.name || 'Datei', h('div.viewer', h('div.vstage.file', body), h('div.vbar', h('span.grow', fmtSize(e.size || 0)), h('button.btn', { onclick: () => A.act('download', [id]) }, ico('dl', 16), 'Download'), h('button.btn', { onclick: () => window.open(url, '_blank') }, ico('ext', 16), 'Neuer Tab'))), { cls: 'full' }); };

/* ---------- Dokument, Farbwähler, Skizze ---------- */
A.openDoc = id => { const e = get(id), ro = A.readonly();
  const title = h('input.doctitle', { value: e.title || '', placeholder: 'Titel', readonly: ro || null, oninput: debounce(ev => tx(() => set(id, { title: ev.target.value }), { merge: 'doc' + id }), 300), onkeydown: ev => { ev.stopPropagation(); if (ev.key === 'Enter') { ev.preventDefault(); A.startEdit(body); } } });
  const body = h('div.docbody.rt.ed', { data: { rich: 1, ph: 'Schreib los …' }, html: e.html || '' }); body._commit = n => { const v = n.innerHTML; if (get(id) && get(id).html !== v) tx(() => set(id, { html: v }), { merge: 'ed:' + id }); count(); };
  const cnt = h('span.mut'), count = () => { const w = body.innerText.trim().split(/\s+/).filter(Boolean).length; cnt.textContent = w + (w === 1 ? ' Wort' : ' Wörter'); };
  const f = k => keep(() => { A.startEdit(body); FMT[k](); body._commit(body); });
  const tools = ro ? null : h('div.doctools', [['h1', 'H1'], ['h2', 'H2'], ['p', 'Text']].map(([k, l]) => h('button.btn', f(k), l)), ['bold', 'italic', 'under', 'strike', 'link', 'ul', 'ol', 'todo', 'quote', 'code', 'center'].map(k => h('button.btn', { title: k, ...f({ todo: 'chk', code: 'pre' }[k] || k) }, ico(k, 16))), h('button.btn', { onclick: ev => A.menu(['pdf', 'word', 'md', 'txt'].map(x => ({ label: { pdf: 'PDF', word: 'Word', md: 'Markdown', txt: 'Reiner Text' }[x], act: () => exportDoc(id, x) })), ...below(ev)) }, ico('export', 16), 'Export'));
  body.addEventListener('click', ev => { if (!body.isContentEditable && !ro && !ev.target.closest('a')) A.startEdit(body, [ev.clientX, ev.clientY]); });
  A.modal('Dokument', h('div.doc', tools, h('div.docpage', title, body), h('div.docfoot', cnt, navigator.onLine ? null : h('span.warn', 'Offline – Änderungen bleiben auf diesem Gerät'))), { cls: 'full docm', onClose: () => A.stopEdit() }); count(); if (!e.html && !ro) (e.title ? A.startEdit(body) : title.focus()); };
A.colorPicker = id => { const e = get(id); let [hh, s, l] = rgbHsl(...hexRgb(e.hex || '#0a84ff'));
  const prev = h('div.cpprev'), hex = h('input.field', { maxlength: 7, onchange: ev => { const v = hexNorm(ev.target.value); if (v) { [hh, s, l] = rgbHsl(...hexRgb(v)); sl.forEach((x, i) => (x.value = [hh, s, l][i])); upd(); } }, onkeydown: ev => ev.stopPropagation() });
  const cur = () => rgbHex(...hslRgb(hh, s, l)), upd = save => { const c = cur(); prev.style.background = c; hex.value = c.toUpperCase(); sl[1].style.background = `linear-gradient(90deg,hsl(${hh} 0% ${l}%),hsl(${hh} 100% ${l}%))`; sl[2].style.background = `linear-gradient(90deg,#000,hsl(${hh} ${s}% 50%),#fff)`; if (save !== false) tx(() => set(id, { hex: c, name: null }), { merge: 'cp' + id }); };
  const sl = [['Farbton', 360, v => (hh = v)], ['Sättigung', 100, v => (s = v)], ['Helligkeit', 100, v => (l = v)]].map(([n, max, f], i) => h('input.slider' + (i ? '' : '.hue'), { type: 'range', min: 0, max, value: [hh, s, l][i], 'aria-label': n, oninput: ev => { f(+ev.target.value); upd(); } }));
  const imgs = kids(A.board).filter(x => x.type === 'image');
  const pip = h('button.btn', { onclick: async () => { if (window.EyeDropper) { try { const r = await new EyeDropper().open(); [hh, s, l] = rgbHsl(...hexRgb(r.sRGBHex)); sl.forEach((x, i) => (x.value = [hh, s, l][i])); upd(); } catch {} } else A.toast('Pipette: unten eine Farbe aus den Bildern des Boards wählen'); } }, ico('pipette', 16), 'Pipette');
  const pals = [...new Set(imgs.flatMap(x => x.pal || []))].slice(0, 18);
  A.modal('Farbe', h('div.cpick', prev, sl.map((x, i) => h('label', ['Farbton', 'Sättigung', 'Helligkeit'][i], x)), h('div.row', hex, pip), pals.length ? [h('div.mtitle', 'Aus den Bildern dieses Boards'), h('div.cgrid', pals.map(c => h('button.cc', { style: { background: c }, title: c, onclick: () => { [hh, s, l] = rgbHsl(...hexRgb(c)); sl.forEach((x, i) => (x.value = [hh, s, l][i])); upd(); } })))] : null), { cls: 'small' }); upd(false); };
A.sketchEdit = id => { const e = get(id); const host = h('div.skpad', { style: { aspectRatio: (e.vw || 400) / (e.vh || 300) } }); A.modal('Skizze', h('div.viewer', h('div.vstage.sk', host)), { cls: 'full', onClose: () => A.pad?.close(true) }); openPad({ host, w: e.vw || 400, h: e.vh || 300, strokes: e.strokes, onDone: s => { if (s) tx(() => set(id, { strokes: s })); if (modalEl) { modalEl._close = null; A.closeModal(); } } }); };

/* ---------- Bildsuche ---------- */
A.imageSearch = () => { const inp = h('input.field.big', { placeholder: 'Fotos suchen …' }), grid = h('div.igrid'), more = h('button.btn.wide', { hidden: true }, 'Mehr laden'); let page = 1, q = '';
  const sugg = () => { const words = kids(A.board).map(e => e.title || textOf(e.html || '')).join(' ').toLowerCase().match(/[a-zäöüß]{5,}/g) || []; return [...new Set([get(A.board).title, ...words].filter(Boolean))].slice(0, 6); };
  const run = async reset => { if (reset) { page = 1; grid.innerHTML = ''; } q = inp.value.trim(); if (!q) return; more.hidden = true; grid.classList.add('busy'); const wait_ = h('p.mut.pad.loading', 'Suche läuft …'); grid.append(wait_);
    try { const key = A.setting('pexelsKey', ''); let items;
      if (key) { const r = await fetch(`https://api.pexels.com/v1/search?per_page=30&page=${page}&query=${encodeURIComponent(q)}`, { headers: { Authorization: key } }); items = ((await r.json()).photos || []).map(p => ({ thumb: p.src.medium, full: p.src.large2x, by: p.photographer, src: p.url })); }
      else { const r = await fetch(`https://api.openverse.org/v1/images/?page_size=20&page=${page}&q=${encodeURIComponent(q)}`); items = ((await r.json()).results || []).map(p => ({ thumb: p.thumbnail || p.url, full: p.url, by: p.creator, src: p.foreign_landing_url })); }
      wait_.remove();
      items.forEach(it => grid.append(h('button.ires', { title: it.by ? 'Foto: ' + it.by : '', onclick: async e => { e.currentTarget.classList.add('busy'); let src = it.full; try { const b = await (await fetch(it.full)).blob(); if (/^image\//.test(b.type)) src = await putBlob(b); } catch {} A.create('image', null, { src, caption: it.by ? 'Foto: ' + it.by : '', srcUrl: it.src }, { quiet: true }); A.toast('Bild hinzugefügt'); e.target.closest('.ires')?.classList.remove('busy'); } }, h('img', { src: it.thumb, loading: 'lazy', alt: '' }))));
      more.hidden = items.length < 20; if (!items.length && page === 1) grid.append(h('p.mut.pad', 'Keine Bilder gefunden')); } catch { wait_.remove(); grid.append(h('p.mut.pad', 'Die Bildsuche ist gerade nicht erreichbar.')); }
    grid.classList.remove('busy'); };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') run(true); }); more.onclick = () => { page++; run(); };
  A.modal('Bildsuche', h('div.search', inp, h('div.row.wrap', sugg().map(s => h('button.chipb', { onclick: () => { inp.value = s; run(true); } }, s))), grid, more, h('p.mut.small', A.setting('pexelsKey', '') ? 'Fotos von Pexels' : 'Frei lizenzierte Fotos über Openverse. Für Pexels einen API-Schlüssel in den Einstellungen eintragen.')), { cls: 'side' }); inp.focus(); };

/* ---------- Vorlagen ---------- */
A.templates = () => { let cat = 'Alle', keepEx = true; const grid = h('div.tgrid'), cats = h('div.tcats');
  const own = all().filter(e => e.type === 'board' && e.template && e.loc !== 'trash');
  const use = async t => { A.closeModal(); const empty = !all().some(e => e.board === A.board && e.loc !== 'trash') && A.board !== 'home'; const id = t.own ? (() => { const cl = cloneElsOwn(t.own, empty); return cl; })() : useTemplate(t, empty ? A.board : null, keepEx); if (id && id !== A.board) A.openBoard(id); else { $('#cards').innerHTML = ''; A.render(); A.fit(); } };
  const cloneElsOwn = (b, into) => { let res; import('./store.js').then(() => {}); const m = S; const list = all().filter(e => e.board === b.id && e.loc !== 'trash'); const { cloneEls } = A._store; if (into) { const cl = cloneEls(list, { board: A.board }); tx(() => { cl.forEach(add); set(A.board, { title: get(A.board).title || b.title, icon: b.icon, color: b.color, bg: b.bg }); }); return A.board; } const cl = cloneEls([b], { board: A.board, loc: 'canvas', template: false, x: Math.round(A.center()[0]), y: Math.round(A.center()[1]), z: maxZ(A.board) + 1 }); tx(() => cl.forEach(add)); return cl[0].id; };
  const draw = () => { grid.innerHTML = ''; cats.innerHTML = ''; ['Alle', ...(own.length ? ['Eigene Vorlagen'] : []), ...CATS].forEach(c => cats.append(h('button' + (c === cat ? '.on' : ''), { onclick: () => { cat = c; draw(); } }, c)));
    const list = cat === 'Eigene Vorlagen' ? own.map(b => ({ n: b.title || 'Vorlage', c: 'Eigene Vorlagen', i: b.icon || autoIcon(b.title), own: b })) : TEMPLATES.filter(t => cat === 'Alle' || t.c === cat);
    list.forEach(t => grid.append(h('button.tcard', { onclick: () => use(t) }, h('div.tprev', { style: { background: t.col || 'var(--soft)' } }, h('span', t.i)), h('b', t.n), h('small', t.c)))); };
  draw(); A.modal('Vorlagen', h('div.tpl', cats, h('div.tmain', h('label.check', h('input', { type: 'checkbox', checked: true, onchange: e => (keepEx = e.target.checked) }), 'Beispielinhalt behalten'), grid)), { cls: 'full tplm' }); };
function tplPicker() { const quick = ['Moodboard', 'Storyboard', 'Kanban-Board', 'Brainstorming', 'Shotlist'].map(n => TEMPLATES.find(t => t.n === n)).filter(Boolean);
  $('#stage').append(h('div#tplpick.glass.nodrag', { hidden: true }, h('button.x', { 'aria-label': 'Schließen', onclick: () => { A.tplDismiss = A.board; refreshUI(); } }, ico('x', 15)), h('b', 'Mit einer Vorlage starten'), h('div.row.wrap', quick.map(t => h('button.chipb', { onclick: () => { useTemplate(t, A.board, true); $('#cards').innerHTML = ''; A.render(); A.fit(); } }, t.i + ' ' + t.n)), h('button.chipb.more', { onclick: () => A.templates() }, 'Mehr Vorlagen')))); }

/* ---------- Teilen ---------- */
A.share = () => { const b = get(A.board), url = location.origin + location.pathname + '#/b/' + b.id;
  A.modal('Board teilen', h('div.sharem',
    h('p', 'Dieses Board liegt im Moment nur auf diesem Gerät. Echte Freigaben mit Rollen, Links, Passwort und gemeinsamer Arbeit in Echtzeit kommen mit der Kontenstufe (Datenbank).'),
    h('div.sharebox', h('b', 'Als Datei weitergeben'), h('p.mut', 'Enthält das Board samt Unterboards, Bildern und Dateien. Die andere Person öffnet 228 Board und importiert die Datei.'), h('div.row', h('button.btn.primary', { onclick: () => backup(A.board) }, ico('dl', 16), 'Board-Datei sichern'), h('button.btn', { onclick: () => A.pickFile('.228board,application/json', f => restore(f)) }, ico('upload', 16), 'Board-Datei importieren'))),
    h('div.sharebox', h('b', 'Als Ansicht weitergeben'), h('p.mut', 'PDF oder PNG zeigen das Board so, wie es auf der Leinwand liegt.'), h('div.row', h('button.btn', { onclick: () => exportBoard(A.board, 'pdf') }, 'PDF'), h('button.btn', { onclick: () => exportBoard(A.board, 'png') }, 'PNG'))),
    h('div.sharebox', h('b', 'Link auf diesem Gerät'), h('div.row', h('input.field', { value: url, readonly: true, onclick: e => e.target.select() }), h('button.btn', { onclick: () => { navigator.clipboard?.writeText(url); A.toast('Link kopiert'); } }, 'Kopieren'))),
    h('div.sharebox', h('b', 'Personen für Erwähnungen und Aufgaben'), h('div.row.wrap', A.people().map(p => h('span.chip', h('i.av', { style: { background: A.avatarColor(p) } }, p[0].toUpperCase()), p)), h('button.chipb', { onclick: () => A.prompt('Name oder E-Mail (mehrere mit Komma)', '', v => { if (v) { v.split(',').forEach(x => x.trim() && A.addPerson(x)); A.share(); } }) }, '+ Person')))), { cls: 'small wide' }); };

/* ---------- Einstellungen, Kürzel ---------- */
A.settings = () => { const tog = (label, key, def, hint) => h('label.setrow', h('span', label, hint ? h('small', hint) : null), h('input.switch', { type: 'checkbox', checked: A.setting(key, def) || null, onchange: e => { A.setSetting(key, e.target.checked); $('#cards').innerHTML = ''; A.render(); } }));
  const sel = (label, key, def, opts) => h('label.setrow', h('span', label), h('select.field', { onchange: e => { const v = e.target.value; A.setSetting(key, isNaN(v) || v === '' ? (v === 'true' ? true : v === 'false' ? false : v) : +v); A.render(); } }, opts.map(([v, l]) => h('option', { value: v, selected: String(A.setting(key, def)) === String(v) || null }, l))));
  A.modal('Einstellungen', h('div.settings',
    A.account ? h('div.setrow', h('span', 'Konto und Abgleich', h('small', 'Boards auf allen Geräten, Teilen, gemeinsames Arbeiten')), h('button.btn', { onclick: () => A.account() }, 'Konto')) : null,
    h('h3', 'Profil'), h('label.setrow', h('span', 'Mein Name', h('small', 'Erscheint an Kommentaren, Reaktionen und Aufgaben')), h('input.field', { value: A.me(), onchange: e => { kvSet('me', e.target.value.trim() || 'Ich'); A.render(); }, onkeydown: e => e.stopPropagation() })),
    h('h3', 'Darstellung'), sel('Erscheinungsbild', 'dark', 'auto', [['auto', 'Wie das System'], ['false', 'Hell'], ['true', 'Dunkel']]), sel('Größe der Oberfläche', 'uiSize', 1, [[0, 'Klein'], [1, 'Normal'], [2, 'Groß'], [3, 'Sehr groß']]), tog('Serifenlose Überschriften', 'sans', true), sel('Zeitformat', 'h12', false, [['false', '24 Stunden'], ['true', '12 Stunden']]), sel('Währung in Tabellen', 'currency', 'EUR', [['EUR', 'Euro'], ['USD', 'US-Dollar'], ['GBP', 'Pfund'], ['CHF', 'Franken'], ['XOF', 'CFA-Franc']]),
    h('h3', 'Leinwand'), tog('Punktraster anzeigen', 'showGrid', true), tog('Am Raster einrasten', 'snap', true), sel('Rastergröße', 'gridSize', 1, [[0, 'Fein'], [1, 'Mittel'], [2, 'Grob']]), tog('Überlappen verhindern', 'noOverlap', true, 'Wachsende Karten schieben darunterliegende nach unten'), tog('Hinweise anzeigen', 'helpers', true), tog('Tinteneffekt beim Zeichnen', 'ink', true),
    h('h3', 'Dienste'), h('label.setrow', h('span', 'Pexels-Schlüssel', h('small', 'Optional für die Bildsuche; ohne Schlüssel wird Openverse genutzt')), h('input.field', { value: A.setting('pexelsKey', ''), placeholder: 'API-Schlüssel', onchange: e => A.setSetting('pexelsKey', e.target.value.trim()), onkeydown: e => e.stopPropagation() })),
    h('label.setrow', h('span', 'Erinnerungen', h('small', 'Browser-Mitteilung bei fälligen Aufgaben')), h('button.btn', { onclick: async e => { const p = await Notification.requestPermission(); e.target.textContent = p === 'granted' ? 'Aktiv' : 'Blockiert'; } }, window.Notification?.permission === 'granted' ? 'Aktiv' : 'Aktivieren')),
    h('h3', 'Daten'), h('div.row.wrap', h('button.btn', { onclick: () => backup('home') }, ico('dl', 16), 'Alles sichern'), h('button.btn', { onclick: () => A.pickFile('.228board,application/json', f => restore(f)) }, ico('upload', 16), 'Sicherung einspielen'), h('button.btn', { onclick: () => A.shortcuts() }, ico('help', 16), 'Tastaturkürzel')),
    h('p.mut.small', 'Alle Inhalte liegen in diesem Browser auf diesem Gerät. Regelmäßig sichern, solange es noch keinen Abgleich über Konten gibt.')), { cls: 'small wide' }); };
A.shortcuts = () => { const S_ = [['Grundlagen', [['Neue Notiz', 'Doppelklick auf die Leinwand'], ['Nächste Notiz, Board oder Spalte', K + '↵'], ['Leinwand bewegen', 'Leertaste + Ziehen'], ['Alles einpassen', 'Z'], ['Suche und letzte Boards', K + 'F'], ['Löschen', '⌫'], ['Bewegen', 'Pfeiltasten'], ['Große Schritte', '⇧ + Pfeiltasten'], ['Erwähnen', '@'], ['Diese Übersicht', '/']]],
  ['Bearbeiten', [['Kopieren, Ausschneiden, Einfügen', `${K}C  ${K}X  ${K}V`], ['Rückgängig, Wiederholen', `${K}Z  ${K}⇧Z`], ['Alles auswählen', K + 'A'], ['Auswahl aufheben', 'Esc'], ['Duplizieren', (isMac ? '⌥' : 'Alt') + ' + Ziehen, ' + K + 'D'], ['Nach vorn, nach hinten', `${K}⇧↑  ${K}⇧↓`], ['Mit Linien verbinden', K + 'K'], ['Sperren', K + 'L'], ['Bearbeiten starten', '↵'], ['Board oder Bild öffnen', 'Leertaste'], ['Achse sperren, gerade Linie', '⇧ beim Ziehen']]],
  ['Text', [['Große Überschrift', K + '⇧1'], ['Überschrift', K + '⇧2'], ['Normaler Text', K + '⇧0'], ['Kleiner Text', K + '⇧9'], ['Fett, Kursiv, Unterstrichen', `${K}B  ${K}I  ${K}U`], ['Aufzählung, Nummern', `${K}⇧U  ${K}⇧O`], ['Link', K + 'K'], ['Markieren', K + 'J'], ['Durchgestrichen', K + '⇧X'], ['Code-Block', K + '>'], ['Zitat', K + '"'], ['Zentrieren', K + '\\'], ['Einrücken', 'Tab, ⇧Tab'], ['Markdown', '#  .  1.  [ ]  >  ---']]],
  ['Tabellen', [['Formel', '='], ['Zeile oder Spalte hinzufügen', (isMac ? '⌥' : 'Alt') + ' + Pfeil'], ['Zum Rand springen', K + 'Pfeil'], ['Mehrere Zellen', '⇧ + Pfeil']]],
  ['Zeichnen', [['Zeichnen starten', '⇧D'], ['Stift, Auswahl, Radierer', 'D  V  E'], ['Vorige Farbe', 'X'], ['Stiftgröße', '1 2 3 4'], ['Speichern', 'Esc']]],
  ['Navigation und Ansicht', [['Zurück, Vor', `${K}[  ${K}]`], ['Elternboard', K + 'U'], ['Zoom', `${K}+  ${K}-  ${K}0`], ['Zoom per Mausrad', K + 'Scrollen'], ['Dunkler Modus', K + '⇧D'], ['Oberfläche kleiner, größer', `${K}⇧<  ${K}⇧>`]]]];
  A.modal('Tastaturkürzel', h('div.keys', S_.map(([t, rows]) => h('section', h('h3', t), rows.map(([a, k]) => h('div.krow', h('span', a), h('kbd', k)))))), { cls: 'full' }); };

/* ---------- Start ---------- */
A.welcome = () => { tx(() => { const mk = (o) => add({ id: uid(), board: 'home', loc: 'canvas', z: 1, ...o });
  mk({ type: 'note', x: 80, y: 80, w: 320, html: '<h1>Willkommen bei 228 Board</h1><p>Deine Leinwand für Ideen, Moodboards, Drehpläne und Projekte.</p><ul><li>Doppelklick auf die freie Fläche legt eine Notiz an.</li><li>Elemente aus der Leiste ziehen oder anklicken.</li><li>Bilder, Dateien und Links einfach hereinziehen oder einfügen.</li><li>Leertaste halten und ziehen bewegt die Leinwand, <b>Z</b> passt alles ein.</li></ul>' });
  mk({ type: 'todo', x: 440, y: 80, w: 260, hasTitle: true, title: 'Zum Ausprobieren', items: [{ id: uid(), text: 'Ein Board anlegen und öffnen', done: false }, { id: uid(), text: 'Ein Bild hereinziehen', done: false }, { id: uid(), text: 'Zwei Karten mit einer Linie verbinden', done: false }, { id: uid(), text: 'Eine Vorlage ansehen', done: false }] });
  mk({ type: 'board', x: 440, y: 320, title: 'Erstes Projekt', icon: '🎬', color: '#5e5ce6' }); }, { undo: false }); A.fit(); };
export function initUI() {
  import('./store.js').then(m => (A._store = m));
  $('#top').append(h('div#crumbs'), h('div#topright'));
  initPanels(); toolDrag(); tplPicker(); Object.assign(A.mode, kv('present', {}), { present: false });
  setInterval(checkDue, 30000); setTimeout(checkDue, 3000);
  addEventListener('online', () => A.toast('Wieder online')); addEventListener('offline', () => A.toast('Offline – du kannst weiterarbeiten, alles bleibt auf diesem Gerät'));
}
