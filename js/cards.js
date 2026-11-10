// Darstellung aller Kartentypen
import { h, ap, A, ico, esc, embedFor, mapEmbed, hostOf, fmtSize, fmtDate, hexRgb, rgbHsl, inkOn, colorName, isUrl, fixUrl, textOf, autoIcon, palette, $ } from './util.js';
import { S, set, get, tx, kids, colKids, all, blobUrl, blobUrlNow, kv, uid, now, realBoard } from './store.js';
import { clean, hexChips } from './rich.js';
import { buildTable } from './table.js';
import { strokesSvg } from './sketch.js';

export const NAMES = { note: 'Notiz', link: 'Link', todo: 'To-do-Liste', line: 'Linie', board: 'Board', column: 'Spalte', comment: 'Kommentar', table: 'Tabelle', image: 'Bild', file: 'Datei', sketch: 'Skizze', swatch: 'Farbfeld', doc: 'Dokument', audio: 'Audio', video: 'Video', map: 'Karte' };
export const DEF_W = { note: 260, link: 280, todo: 260, column: 300, comment: 260, image: 320, file: 240, sketch: 320, swatch: 160, audio: 300, video: 400, map: 360, board: 120, doc: 120, table: 0 };
export const drafts = new Map();

const saveM = (el, patch) => tx(() => { set(el.id, patch); if (el.sync && 'html' in patch) all().filter(o => o.sync === el.sync && o.id !== el.id).forEach(o => set(o.id, { html: patch.html })); }, { merge: 'ed:' + el.id });
function field(el, key, o = {}) {
  const n = h((o.tag || 'div') + '.ed' + (o.rich ? '.rt' : '.plain') + (o.cls ? '.' + o.cls : ''), { data: { ph: o.ph || '', ...(o.rich ? { rich: 1 } : {}), ...(o.single ? { single: 1 } : {}) } });
  const v = o.value ?? el[key] ?? '';
  if (o.rich) { n.innerHTML = v; hexChips(n); } else n.textContent = v;
  n._commit = o.commit || (nd => { const val = o.rich ? cleanRich(nd) : nd.innerText.replace(/\n$/, ''); if (val !== (get(el.id)?.[key] ?? '')) saveM(el, { [key]: val }); });
  n._key = o.key; n._done = o.done;
  return n;
}
function cleanRich(nd) { const c = nd.cloneNode(true); c.querySelectorAll('.hexchip').forEach(s => s.replaceWith(s.textContent)); return clean(c); }
function setSrc(node, id, attr = 'src') { if (!id) return; const u = blobUrlNow(id); if (u) node[attr] = u; else blobUrl(id).then(x => x && (node[attr] = x)); }
const frame = (emb, title) => h('div.embed', { style: emb.ratio ? { aspectRatio: emb.ratio } : { height: emb.h + 'px' } }, h('iframe', { src: emb.src, loading: 'lazy', allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write', allowfullscreen: true, title: title || 'Einbettung', referrerpolicy: 'strict-origin-when-cross-origin' }), h('div.shield'));
const urlInput = (el, ph, done) => h('input.urlin.nodrag', { placeholder: ph, type: 'url', inputmode: 'url', onkeydown: e => { e.stopPropagation(); if (e.key === 'Enter' && e.target.value.trim()) done(fixUrl(e.target.value)); }, onpaste: e => { e.stopPropagation(); setTimeout(() => { if (isUrl(e.target.value)) done(fixUrl(e.target.value)); }, 0); } });

async function fetchMeta(el) {
  let d = {};
  try { const r = await fetch('https://api.microlink.io/?url=' + encodeURIComponent(el.url)); d = (await r.json()).data || {}; } catch {}
  const e = get(el.id); if (!e) return;
  tx(() => set(el.id, { title: e.title || d.title || hostOf(el.url), desc: e.desc || d.description || '', img: e.img || d.image?.url || '', fav: d.logo?.url || '', meta: 1, ...(d.url && d.url !== el.url && mapEmbed(d.url) ? { url: d.url } : {}) }), { undo: false });
}

const B = {
  note(el, n) {
    n.append(field(el, 'html', { rich: 1, ph: 'Notiz schreiben …', done: () => { const e = get(el.id); if (!e) return; const t = textOf(e.html).trim(); if (isUrl(t) && !/<(b|i|u|h1|h2|ul|ol|pre|blockquote)\b/.test(e.html) && !e.sync) tx(() => set(el.id, { type: 'link', url: fixUrl(t), html: '', showImg: true, showDesc: true })); else if (t.length > 3000 && !e.docHint) A.toast('Lange Notiz – als Dokument weiterführen?', 'In Dokument umwandeln', () => A.act('toDoc', [el.id])), set(el.id, { docHint: 1 }); } }));
    if (el.src) n.append(h('a.src.nodrag', { href: el.src, target: '_blank', rel: 'noopener' }, hostOf(el.src)));
    if (el.sync) { const others = all().filter(o => o.sync === el.sync && o.id !== el.id && o.loc !== 'trash'); if (others.length) n.append(h('div.syncfoot', ico('sync', 13), 'Synchron mit ', others.map((o, i) => [i ? ', ' : '', h('a.nodrag', { onclick: () => A.openBoard(o.board, o.id) }, get(o.board)?.title || 'Board')]))); }
  },
  link(el, n) {
    if (!el.url) { n.append(h('div.ph', ico('link'), urlInput(el, 'Link einfügen und Enter drücken', url => tx(() => set(el.id, { url }))))); return; }
    if (!el.meta) fetchMeta(el);
    const emb = embedFor(el.url), target = boardFromUrl(el.url);
    if (el.showImg !== false) { if (emb?.src) n.append(frame(emb, el.title)); else if (emb?.img || el.img) { const im = h('img.cover', { draggable: false, alt: '', loading: 'lazy' }); setSrc(im, emb?.img || el.img); im.onerror = () => im.remove(); n.append(im); } }
    n.append(h('div.linkbody', field(el, 'title', { ph: 'Titel', cls: 'ltitle' }),
      h('a.lurl.nodrag', { href: el.url, target: '_blank', rel: 'noopener', onclick: target ? e => { e.preventDefault(); A.openBoard(target); } : null }, el.fav ? h('img', { src: el.fav, alt: '', onerror: e => e.target.remove() }) : null, hostOf(el.url)),
      el.showDesc !== false ? field(el, 'desc', { ph: 'Beschreibung', cls: 'ldesc' }) : null));
  },
  todo(el, n) {
    if (el.hasTitle) n.append(field(el, 'title', { ph: 'Titel', cls: 'ttitle', single: 1 }));
    const items = el.items || [];
    const upd = (its, focus) => { tx(() => set(el.id, { items: its })); if (focus) A.rebuild(el.id, focus); };
    const list = h('div.tasks');
    items.forEach((it, i) => {
      const txt = field(el, '', { value: it.text, ph: 'Aufgabe', cls: 'ttext', commit: nd => { const e = get(el.id), v = nd.innerText.replace(/\n/g, ''); if (e?.items[i] && e.items[i].text !== v) { const its = structuredClone(e.items); its[i].text = v; tx(() => set(el.id, { items: its }), { merge: 'ed:' + el.id }); } },
        key: (e, nd) => {
          const cur = structuredClone(get(el.id).items), s = getSelection(), r = document.createRange(); r.selectNodeContents(nd); r.setEnd(s.anchorNode, s.anchorOffset); const pos = r.toString().length, full = nd.innerText.replace(/\n/g, '');
          if (e.key === 'Enter') { e.preventDefault(); cur[i].text = full.slice(0, pos); cur.splice(i + 1, 0, { id: uid(), text: full.slice(pos), done: false, indent: cur[i].indent || 0 }); upd(cur, { sel: `.task[data-i="${i + 1}"] .ttext`, pos: 0 }); return true; }
          if (e.key === 'Backspace' && pos === 0 && s.isCollapsed) { e.preventDefault(); if (i === 0) { if (!full && cur.length > 1) { cur.splice(0, 1); upd(cur, { sel: `.task[data-i="0"] .ttext`, pos: 0 }); } return true; } const p = cur[i - 1].text.length; cur[i - 1].text += full; cur.splice(i, 1); upd(cur, { sel: `.task[data-i="${i - 1}"] .ttext`, pos: p }); return true; }
          if (e.key === 'Tab') { e.preventDefault(); cur[i].text = full; cur[i].indent = Math.max(0, Math.min(4, (cur[i].indent || 0) + (e.shiftKey ? -1 : 1))); upd(cur, { sel: `.task[data-i="${i}"] .ttext`, pos }); return true; }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { const t = n.querySelector(`.task[data-i="${i + (e.key === 'ArrowDown' ? 1 : -1)}"] .ttext`); if (t) { e.preventDefault(); A.startEdit(t); return true; } }
        } });
      const overdue = it.due && !it.done && it.due < now();
      list.append(h('div.task' + (it.done ? '.done' : ''), { data: { i }, style: { marginLeft: (it.indent || 0) * 20 + 'px' } },
        h('i.grip.nodrag', { title: 'Ziehen zum Verschieben' }), h('button.cb.nodrag', { 'aria-label': 'Erledigt', onclick: () => { const its = structuredClone(get(el.id).items); its[i].done = !its[i].done; upd(its); } }, it.done ? ico('check', 14) : null), txt,
        it.due || it.who ? h('div.tmeta', it.due ? h('span.chip.nodrag' + (overdue ? '.late' : ''), { onclick: e => A.taskDue(el, i, e) }, ico('cal', 12), fmtDate(it.due, !!it.dueTime)) : null, it.who ? h('span.chip.nodrag', { onclick: e => A.taskWho(el, i, e) }, ico('user', 12), it.who) : null) : null));
    });
    n.append(list);
    if (!A.readonly()) n.append(h('div.taskfoot.nodrag', h('button', { onclick: () => { const its = structuredClone(get(el.id).items || []); its.push({ id: uid(), text: '', done: false }); upd(its, { sel: `.task[data-i="${its.length - 1}"] .ttext`, pos: 0 }); } }, '+ Aufgabe'), items.some(i => i.done) ? h('button', { title: 'Erledigte löschen', onclick: () => upd(get(el.id).items.filter(i => !i.done)) }, ico('trash', 14)) : null));
  },
  board(el, n) {
    const t = realBoard(el) || el, cnt = el.alias && !get(el.alias) ? null : all().filter(e => e.board === t.id && e.loc !== 'trash').length;
    const bg = t.color || '#0a84ff';
    n.append(h('div.tile', { style: { background: bg, color: inkOn(bg) } }, h('span.emo', t.icon || autoIcon(t.title)),
      el.alias ? h('i.badge', { title: 'Verknüpfung' }, ico(get(el.alias) ? 'ext' : 'collapse', 12)) : null, t.shared ? h('i.badge.b2', { title: 'Geteilt' }, ico(t.shared === 'view' ? 'eye' : 'user', 12)) : null),
      el.alias ? h('div.btitle', get(el.alias) ? t.title || 'Ohne Titel' : 'Kein Zugriff mehr') : field(el, 'title', { ph: 'Neues Board', cls: 'btitle' }),
      h('div.bcount', t.template ? h('b.tplb', 'Vorlage') : cnt == null ? '' : cnt === 1 ? '1 Karte' : cnt + ' Karten'));
  },
  doc(el, n) {
    if (el.view === 'preview') { n.classList.add('docprev'); n.append(h('div.dtitle', el.title || 'Ohne Titel'), h('div.dprev.rt', { html: el.html || '<p class="mut">Leer</p>' })); n.style.width = (el.w || 280) + 'px'; return; }
    const words = textOf(el.html).trim().split(/\s+/).filter(Boolean).length;
    n.append(h('div.tile.dtile', ico('doc', 30)), field(el, 'title', { ph: 'Neues Dokument', cls: 'btitle' }), h('div.bcount', words === 1 ? '1 Wort' : words + ' Wörter'));
  },
  column(el, n) {
    const ks = colKids(el.id);
    n.append(h('div.colhead', field(el, 'title', { ph: 'Spaltentitel', cls: 'ctitle' }), h('span.ccount', ks.length === 1 ? '1 Karte' : ks.length + ' Karten'),
      h('button.cfold.nodrag', { title: el.collapsed ? 'Ausklappen' : 'Einklappen', onclick: e => { e.stopPropagation(); tx(() => set(el.id, { collapsed: !el.collapsed })); } }, ico(el.collapsed ? 'down' : 'collapse', 16))));
    if (el.collapsed) n.classList.add('folded'); else n.append(h('div.col-body', { data: { col: el.id } }));
  },
  comment(el, n) {
    const th = el.thread || [], me = A.me();
    n.append(h('div.thread', th.map((m, i) => h('div.msg', h('div.mhead', h('i.av', { style: { background: A.avatarColor(m.author) } }, (m.author || '?')[0].toUpperCase()), h('b', m.author || 'Unbekannt'), h('time', fmtDate(m.ts))),
      m.author === me && !A.readonly() ? field(el, '', { rich: 1, value: m.html, cls: 'mtext', commit: nd => { const e = get(el.id), v = clean(nd); if (e?.thread[i] && e.thread[i].html !== v) { const t = structuredClone(e.thread); t[i].html = v; tx(() => set(el.id, { thread: t }), { merge: 'ed:' + el.id }); } } }) : h('div.mtext.rt', { html: m.html }),
      rx(m.reactions, emo => { const t = structuredClone(get(el.id).thread); t[i].reactions = toggleRx(t[i].reactions, emo); tx(() => set(el.id, { thread: t })); })))));
    if (A.canComment()) {
      const ta = h('div.draft.nodrag', { contenteditable: 'true', data: { ph: th.length ? 'Antworten …' : 'Kommentar schreiben …' }, oninput: e => drafts.set(el.id, e.target.innerHTML), onkeydown: e => { e.stopPropagation(); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); if (e.key === '@') setTimeout(() => A.mention(ta), 0); }, onpaste: e => e.stopPropagation(), html: drafts.get(el.id) || '' });
      const send = () => { const html = clean(ta); if (!textOf(html).trim()) return; drafts.delete(el.id); tx(() => set(el.id, { thread: [...(get(el.id).thread || []), { id: uid(), author: me, ts: now(), html }] })); A.notify(`${me} hat kommentiert: ${textOf(html).slice(0, 80)}`, null, el.id); };
      n.append(h('div.compose', ta, h('button.send.nodrag', { onclick: send }, th.length ? 'Antworten' : 'Senden')));
    }
  },
  table(el, n) { if (el.hasTitle) n.append(field(el, 'title', { ph: 'Titel', cls: 'ttitle', single: 1 })); buildTable(el, n); },
  image(el, n) {
    const im = h('img', { draggable: false, alt: el.caption || '' }); setSrc(im, el.src);
    if (!el.pal) im.addEventListener('load', () => { const e = get(el.id); if (e && !e.pal) tx(() => set(el.id, { pal: palette(im), nw: im.naturalWidth, nh: im.naturalHeight }), { undo: false }); }, { once: true });
    im.crossOrigin = /^https?:/.test(el.src || '') ? 'anonymous' : null;
    const box = h('div.imgbox', { style: el.nw ? { aspectRatio: el.nw / el.nh } : null }, im, el.strokes?.length ? strokesSvg(el.strokes, el.nw || 1000, el.nh || 1000) : null);
    n.append(box);
    if (el.showCaption || el.caption) n.append(field(el, 'caption', { ph: 'Bildunterschrift', cls: 'cap' }));
  },
  file(el, n) {
    const ext = (el.name || '').split('.').pop().slice(0, 4).toUpperCase(), mime = el.mime || '';
    if (el.view === 'preview' || el.thumb) {
      if (el.thumb) { const im = h('img.cover', { draggable: false, alt: '' }); setSrc(im, el.thumb); n.append(im); }
      else if (/^image\//.test(mime)) { const im = h('img.cover', { draggable: false, alt: '' }); setSrc(im, el.blob); n.append(im); }
      else if (mime === 'application/pdf') { const f = h('iframe.pdfprev', { title: el.name }); blobUrl(el.blob).then(u => (f.src = u + '#toolbar=0&navpanes=0&view=FitH')); n.append(h('div.embed', { style: { aspectRatio: 0.75 } }, f, h('div.shield.always'))); }
      else if (/^text\//.test(mime) || /\.(csv|js|json|md|txt)$/i.test(el.name)) { const pre = h('pre.txtprev'); import('./store.js').then(m => m.getBlob(el.blob)).then(b => b?.slice(0, 2000).text()).then(t => (pre.textContent = t || '')); n.append(pre); }
    }
    n.append(h('div.filerow', h('div.fico', ext || 'FILE'), h('div.finfo', field(el, 'name', { ph: 'Dateiname', cls: 'fname', single: 1 }), h('span.fsize', fmtSize(el.size || 0))), h('button.nodrag.fdl', { title: 'Herunterladen', onclick: () => A.act('download', [el.id]) }, ico('dl', 16))));
  },
  sketch(el, n) { n.append(h('div.skbox', { style: { aspectRatio: (el.vw || 400) / (el.vh || 300), background: el.free ? 'transparent' : null } }, strokesSvg(el.strokes, el.vw || 400, el.vh || 300), !el.strokes?.length ? h('div.skhint', 'Doppelklick zum Zeichnen') : null)); if (el.free) n.classList.add('free'); },
  swatch(el, n) {
    const hx = el.hex || '#0a84ff', [r, g, b] = hexRgb(hx), [hh, s, l] = rgbHsl(r, g, b);
    const val = { hex: hx.toUpperCase(), rgb: `RGB ${r}, ${g}, ${b}`, hsl: `HSL ${hh}°, ${s}%, ${l}%`, none: '' }[el.show || 'hex'];
    n.append(h('div.swcolor', { style: { background: hx } }), el.showCaption === false && !val ? null : h('div.swinfo', el.showCaption === false ? null : field(el, 'name', { ph: colorName(hx), value: el.name ?? colorName(hx), cls: 'swname', single: 1 }), val ? h('span.swval', val) : null));
  },
  audio(el, n) {
    if (el.blob) { const a = h('audio.nodrag', { controls: true, preload: 'metadata', loop: el.loop || null }); setSrc(a, el.blob); if (el.autoplay) a.autoplay = true; n.append(h('div.aubox', h('div.autitle', ico('audio', 16), field(el, 'name', { ph: 'Titel', single: 1 })), a)); return; }
    if (!el.url) { n.append(h('div.ph', ico('audio'), urlInput(el, 'Link von Spotify, SoundCloud, Apple Music …', url => tx(() => set(el.id, { url }))), h('button.nodrag.phbtn', { onclick: () => A.pickFile('audio/*', f => A.attachBlob(el.id, f)) }, 'Datei hochladen'))); return; }
    const emb = embedFor(el.url); n.append(emb?.src ? frame(emb, 'Audio') : h('a.lurl.nodrag', { href: el.url, target: '_blank', rel: 'noopener' }, el.url));
  },
  video(el, n) {
    if (el.blob) { const v = h('video', { controls: true, preload: 'metadata', loop: el.loop || null, playsinline: true, muted: el.autoplay || null }); setSrc(v, el.blob); if (el.autoplay) v.autoplay = true; if (el.thumb) setSrc(v, el.thumb, 'poster'); n.append(h('div.embed.vid', v, h('div.shield'))); if (el.caption || el.showCaption) n.append(field(el, 'caption', { ph: 'Beschreibung', cls: 'cap' })); return; }
    if (!el.url) { n.append(h('div.ph', ico('video'), urlInput(el, 'Link von YouTube oder Vimeo', url => tx(() => set(el.id, { url }))), h('button.nodrag.phbtn', { onclick: () => A.pickFile('video/*', f => A.attachBlob(el.id, f)) }, 'Datei hochladen'))); return; }
    const emb = embedFor(el.url); n.append(emb?.src ? frame(emb, 'Video') : h('a.lurl.nodrag', { href: el.url, target: '_blank', rel: 'noopener' }, el.url));
  },
  map(el, n) {
    if (!el.url) { n.append(h('div.ph', ico('map'), urlInput(el, 'Google-Maps-Link einfügen', url => tx(() => set(el.id, { url }))))); return; }
    const src = mapEmbed(el.url);
    if (!src && !el.meta) fetchMeta(el);
    n.append(src ? frame({ src, ratio: 4 / 3 }, 'Karte') : h('div.ph', ico('map'), h('a.nodrag', { href: el.url, target: '_blank', rel: 'noopener' }, el.meta ? 'Karte öffnen' : 'Karte wird geladen …')));
    n.append(h('div.linkbody', field(el, 'title', { ph: 'Ort', cls: 'ltitle' }), field(el, 'caption', { ph: 'Beschreibung', cls: 'ldesc' })));
  },
};
function boardFromUrl(url) { const m = /#\/?b\/([\w-]+)/.exec(url); return m && url.startsWith(location.origin) && get(m[1]) ? m[1] : null; }
export const toggleRx = (rxs, emo) => { const r = { ...(rxs || {}) }, me = A.me(), l = new Set(r[emo] || []); l.has(me) ? l.delete(me) : l.add(me); if (l.size) r[emo] = [...l]; else delete r[emo]; return r; };
function rx(rxs, toggle) { const ks = Object.keys(rxs || {}); if (!ks.length) return null; return h('div.rxs.nodrag', ks.map(k => h('button' + (rxs[k].includes(A.me()) ? '.mine' : ''), { title: rxs[k].join(', '), onclick: e => { e.stopPropagation(); if (A.canComment()) toggle(k); } }, k, h('span', rxs[k].length)))); }

export function sig(el) {
  let s = el.modified + '|' + (el.col || '') + (A.readonly() ? 'r' : '');
  if (el.type === 'board') { const t = realBoard(el); s += '|' + (t ? t.modified + ':' + all().filter(e => e.board === t.id && e.loc !== 'trash').length : 'x'); }
  if (el.type === 'column') s += '|' + colKids(el.id).length;
  if (el.type === 'note' && el.sync) s += '|' + all().filter(o => o.sync === el.sync).map(o => o.board + o.loc).join();
  const pins = all().filter(c => c.pin === el.id && c.loc !== 'trash'); if (pins.length) s += '|p' + pins.map(p => p.modified).join();
  if (el.labels?.length) s += '|l' + el.labels.map(id => (kv('labels', {})[id] || {}).name + (kv('labels', {})[id] || {}).color).join();
  return s;
}
export function build(el) {
  const n = h('div.el.el-' + el.type, { data: { id: el.id, type: el.type } });
  n._m = sig(el);
  n.append = (...k) => { for (const c of k.flat(Infinity)) if (c != null && c !== false) Element.prototype.append.call(n, c); };
  if (el.w && DEF_W[el.type] !== 0 && !['board'].includes(el.type) && !(el.type === 'doc' && el.view !== 'preview')) n.style.width = el.w + 'px';
  const c = el.color;
  if (c && !['board', 'swatch'].includes(el.type)) { if (el.type === 'image' || el.type === 'file' || el.type === 'link') n.style.setProperty('--strip', c), n.classList.add('strip'); else { n.style.background = c; n.style.color = el.ink || inkOn(c); n.classList.add(c === 'transparent' ? 'clear' : 'tinted'); } }
  if (el.locked) n.classList.add('locked');
  B[el.type]?.(el, n);
  // Labels, Reaktionen, angeheftete Kommentare
  const L = kv('labels', {});
  if (el.labels?.length) n.append(h('div.labels.nodrag', el.labels.filter(id => L[id]).map(id => h('span.label', { style: { background: L[id].color }, data: { label: id }, tabindex: 0, onclick: e => { e.stopPropagation(); A.labelClick(el, id, e); }, ondblclick: e => { e.stopPropagation(); A.labelRename(id); } }, L[id].name))));
  const r = rx(el.reactions, emo => tx(() => set(el.id, { reactions: toggleRx(get(el.id).reactions, emo) }))); if (r) n.append(r);
  const pins = all().filter(cm => cm.pin === el.id && cm.loc !== 'trash');
  if (pins.length && !A.hideComments()) n.append(h('div.pins.nodrag', pins.map(p => h('button.pinb', { title: 'Kommentar', data: { pin: p.id }, onclick: e => { e.stopPropagation(); A.openPin(p.id, e.currentTarget); } }, ico('comment', 13), (p.thread || []).length || ''))));
  if (el.locked) n.append(h('i.lockb', { title: 'Position gesperrt' }, ico('lock', 11)));
  if (A.activity?.(el.id)) n.append(h('i.actdot', { title: A.activity(el.id) }));
  if (!A.readonly()) {
    if (DEF_W[el.type] !== 0 && el.type !== 'board' && !(el.type === 'doc' && el.view !== 'preview')) n.append(h('i.rz', { title: 'Größe ändern' }));
    if (el.type !== 'column') n.append(h('i.lh', { title: 'Linie ziehen' }));
  }
  return n;
}
