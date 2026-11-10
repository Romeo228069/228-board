// Aktionen auf ausgewählten Elementen
import { A, download, textOf, autoIcon } from './util.js';
import { tx, set, get, add, del, all, kids, colKids, uid, now, maxZ, cloneEls, getBlob, realBoard, descendants, delBlob, path } from './store.js';
import { DEF_W } from './cards.js';
import { svgFile } from './sketch.js';

const G = () => [10, 20, 30][A.setting('gridSize', 1)];
const box = id => { const n = A.node(id); return n ? A.wrect(n) : null; };

export function initActions() {
  const acts = {
    delete(ids) {
      const els = ids.map(get).filter(e => e && !e.locked && e.id !== 'home'); if (!els.length) return;
      const set_ = new Set(els.map(e => e.id));
      tx(() => { all().forEach(l => { if ((l.type === 'line' && l.loc === 'canvas' && (set_.has(l.a.el) || set_.has(l.b.el))) || (l.pin && set_.has(l.pin))) els.push(l); });
        els.forEach(e => set(e.id, { loc: 'trash', wasLoc: e.loc === 'trash' ? e.wasLoc : e.loc, wasCol: e.col || null, col: null, deletedAt: now(), deletedBy: A.me() })); });
      A.select([]); A.toast(els.length === 1 ? 'In den Papierkorb gelegt' : els.length + ' Elemente in den Papierkorb gelegt', 'Rückgängig', () => A.undo());
    },
    restore(ids, at) { tx(() => ids.map(get).filter(Boolean).forEach(e => { const colOk = e.wasCol && get(e.wasCol)?.loc !== 'trash'; set(e.id, { loc: e.wasLoc && e.wasLoc !== 'trash' ? e.wasLoc : 'canvas', col: colOk ? e.wasCol : null, deletedAt: null, ...(at ? { board: A.board, loc: 'canvas', col: null, x: at[0], y: at[1] } : {}) }); })); },
    emptyTrash(ids) { tx(() => ids.map(get).filter(Boolean).forEach(e => { const list = [e, ...(e.type === 'board' && !e.alias ? descendants(e.id) : []), ...(e.type === 'column' ? all().filter(c => c.col === e.id) : [])]; list.forEach(x => { [x.src, x.blob, x.thumb, x.orig].forEach(b => b && !all().some(o => o.id !== x.id && [o.src, o.blob, o.thumb, o.img].includes(b)) && delBlob(b)); del(x.id); }); }), { undo: false }); },
    duplicate(ids, sync) {
      const src = ids.map(get).filter(e => e && !(e.col && ids.includes(e.col))); if (!src.length) return;
      const cl = cloneEls(src, (c, o) => (o.col ? { ord: (o.ord || 0) + 0.5 } : c.type === 'line' ? { a: c.a.el ? c.a : { x: c.a.x + 2 * G(), y: c.a.y + 2 * G() }, b: c.b.el ? c.b : { x: c.b.x + 2 * G(), y: c.b.y + 2 * G() } } : { x: (o.x || 0) + (box(o.id)?.w || 0) + G(), y: o.y, z: maxZ(A.board) + 1 }));
      tx(() => { cl.forEach(add); if (sync) src.forEach((o, i) => { if (o.type === 'note') { const sid = o.sync || uid(); set(o.id, { sync: sid }); set(cl.tops[i].id, { sync: sid }); } }); else cl.forEach(c => c.sync && set(c.id, { sync: null })); });
      A.select(cl.tops.map(c => c.id));
    },
    dupSync(ids) { acts.duplicate(ids, true); },
    unsync(ids) { tx(() => ids.forEach(id => set(id, { sync: null }))); },
    lock(ids) { tx(() => ids.forEach(id => set(id, { locked: true }))); }, unlock(ids) { tx(() => ids.forEach(id => set(id, { locked: false }))); },
    front(ids) { let z = maxZ(A.board); tx(() => ids.forEach(id => set(id, { z: ++z }))); },
    back(ids) { let z = Math.min(0, ...kids(A.board).map(e => e.z || 0)); tx(() => ids.forEach(id => set(id, { z: --z }))); },
    groupCol(ids) {
      const els = ids.map(get).filter(e => e && e.type !== 'column' && e.type !== 'line'); if (!els.length) return; const bs = els.map(e => box(e.id) || { x: e.x || 0, y: e.y || 0 });
      const col = { id: uid(), type: 'column', board: A.board, loc: 'canvas', x: Math.min(...bs.map(b => b.x)), y: Math.min(...bs.map(b => b.y)), w: DEF_W.column, title: '', z: 0 };
      tx(() => { add(col); els.map((e, i) => [e, bs[i]]).sort((a, b) => a[1].y - b[1].y || a[1].x - b[1].x).forEach(([e], i) => set(e.id, { col: col.id, ord: i, loc: 'canvas', pin: null })); }); A.select([col.id]);
    },
    ungroup(ids) { tx(() => ids.map(get).filter(e => e?.type === 'column').forEach(c => { let y = c.y; colKids(c.id).forEach(k => { const b = box(k.id); set(k.id, { col: null, x: c.x, y }); y += (b?.h || 80) + G(); }); set(c.id, { loc: 'trash', wasLoc: 'canvas', deletedAt: now(), deletedBy: A.me() }); })); },
    colToBoard(ids) { tx(() => ids.map(get).filter(e => e?.type === 'column').forEach(c => { const b = { id: uid(), type: 'board', board: c.board, loc: c.loc, x: c.x, y: c.y, z: c.z, title: c.title || 'Neues Board' }; add(b); let y = 80; colKids(c.id).forEach(k => { const bx = box(k.id); set(k.id, { board: b.id, col: null, loc: 'canvas', x: 80, y }); y += (bx?.h || 80) + G(); }); del(c.id); })); },
    toDoc(ids) { tx(() => ids.map(get).filter(e => e?.type === 'note').forEach(e => set(e.id, { type: 'doc', title: textOf(e.html).trim().split('\n')[0].slice(0, 60) || 'Dokument', w: null, sync: null, color: null }))); },
    toNote(ids) { tx(() => ids.map(get).filter(e => e?.type === 'doc').forEach(e => set(e.id, { type: 'note', w: DEF_W.note, view: null }))); },
    alias(ids) { tx(() => ids.map(get).filter(e => e?.type === 'board').forEach(e => add({ id: uid(), type: 'board', alias: realBoard(e).id, board: A.board, loc: 'canvas', x: (e.x || 0) + 160, y: e.y || 0, z: maxZ(A.board) + 1 }))); },
    dupTarget(ids) { const e = get(ids[0]), t = realBoard(e); if (!t) return; const cl = cloneEls([t], { board: A.board, loc: 'canvas', col: null, x: (e.x || 0) + 160, y: e.y || 0, template: false, alias: null }); tx(() => cl.forEach(add)); A.select([cl[0].id]); },
    toTemplate(ids) { tx(() => ids.forEach(id => set(realBoard(get(id)).id, { template: true }))); A.toast('Als Vorlage gespeichert – du findest sie unter „Eigene Vorlagen“'); },
    revertTemplate(ids) { tx(() => ids.forEach(id => set(realBoard(get(id)).id, { template: false }))); },
    moveTo(ids) { A.boardPicker('Verschieben nach …', target => { const els = ids.map(get).filter(e => e && e.id !== target && !path(target).some(p => p.id === e.id)); const empty = !all().some(x => x.board === target && x.loc === 'canvas'); let y = 80;
      tx(() => els.forEach(e => { if (e.type === 'line') return del(e.id); const b = box(e.id); set(e.id, empty ? { board: target, loc: 'canvas', col: null, pin: null, x: 80, y } : { board: target, loc: 'unsorted', col: null, pin: null }); y += (b?.h || 100) + G(); })); A.select([]); A.toast(`In „${get(target).title || 'Board'}“ verschoben`, 'Öffnen', () => A.openBoard(target)); }); },
    async download(ids) { for (const id of ids) { const e = get(id); if (!e) continue; if (e.type === 'sketch') { download(new Blob([svgFile(e.strokes, e.vw, e.vh)], { type: 'image/svg+xml' }), 'skizze.svg'); continue; } const key = e.orig || e.blob || e.src; if (!key) continue; if (/^https?:/.test(key)) { window.open(key, '_blank', 'noopener'); continue; } const b = await getBlob(key); if (b) download(b, e.name || (e.type === 'image' ? 'bild.' + (b.type.split('/')[1] || 'png') : 'datei')); } },
    connect(ids) { const els = ids.map(get).filter(e => e && e.type !== 'line' && e.type !== 'column' && !e.col); if (els.length < 2) return; els.sort((a, b) => a.x - b.x || a.y - b.y); tx(() => { for (let i = 1; i < els.length; i++) add({ id: uid(), type: 'line', board: A.board, loc: 'canvas', a: { el: els[i - 1].id }, b: { el: els[i].id }, headB: true, z: 0 }); }); },
    dist(ids, axis) { const els = ids.map(get).filter(e => e && e.x != null && !e.col).map(e => ({ e, b: box(e.id) })).filter(o => o.b); if (els.length < 3) return A.toast('Zum Verteilen mindestens drei Karten auswählen'); const k = axis === 'h' ? 'x' : 'y', s = axis === 'h' ? 'w' : 'h'; els.sort((a, b) => a.b[k] - b.b[k]); const first = els[0].b[k], last = els[els.length - 1].b[k] + els[els.length - 1].b[s], total = els.reduce((t, o) => t + o.b[s], 0), gap = (last - first - total) / (els.length - 1); let p = first; tx(() => els.forEach(o => { set(o.e.id, { [k]: Math.round(p) }); p += o.b[s] + gap; })); },
    align(ids, how) { const els = ids.map(get).filter(e => e && e.x != null && !e.col).map(e => ({ e, b: box(e.id) })).filter(o => o.b); if (els.length < 2) return; const mn = k => Math.min(...els.map(o => o.b[k])), mx = (k, s) => Math.max(...els.map(o => o.b[k] + o.b[s]));
      tx(() => els.forEach(({ e, b }) => { if (how === 'left') set(e.id, { x: mn('x') }); if (how === 'right') set(e.id, { x: Math.round(mx('x', 'w') - b.w) }); if (how === 'center') set(e.id, { x: Math.round((mn('x') + mx('x', 'w')) / 2 - b.w / 2) }); if (how === 'top') set(e.id, { y: mn('y') }); if (how === 'bottom') set(e.id, { y: Math.round(mx('y', 'h') - b.h) }); if (how === 'middle') set(e.id, { y: Math.round((mn('y') + mx('y', 'h')) / 2 - b.h / 2) }); })); },
    next(ids) {
      const e = get(ids[0]); if (!e || e.col && e.type !== 'note') return A.create('note'); const b = box(e.id) || { x: 0, y: 0, w: 260, h: 80 }; const type = ['note', 'board', 'column'].includes(e.type) ? e.type : 'note';
      if (e.col) { const n = { id: uid(), type: 'note', board: A.board, loc: 'canvas', col: e.col, ord: (e.ord || 0) + 0.5, w: e.w }; tx(() => add(n)); A.select([n.id]); return A.startEdit(A.node(n.id).querySelector('.ed')); }
      const side = type !== 'note', x = side ? Math.round((b.x + b.w + (type === 'board' ? 40 : G())) / G()) * G() : e.x, y = side ? e.y : Math.ceil((b.y + b.h + G()) / G()) * G(), hh = 80;
      tx(() => { if (!side && A.setting('noOverlap', true)) kids(A.board).filter(o => o.id !== e.id && o.type !== 'line' && !o.locked && o.y >= y - 2 && o.y < y + hh && o.x < b.x + b.w && o.x + (box(o.id)?.w || 0) > b.x).forEach(o => set(o.id, { y: o.y + hh + G() })); });
      A.create(type, [x, y], { w: side ? DEF_W[type] : e.w, ...(e.color && type === 'note' ? { color: e.color, ink: e.ink } : {}) }, { corner: true });
    },
    unpin(ids) { tx(() => ids.forEach(id => { const c = get(id), t = c && box(c.pin); set(id, { pin: null, x: t ? Math.round(t.x + t.w + 20) : 100, y: t ? Math.round(t.y) : 100 }); })); A.closePin?.(); },
    copy() { document.execCommand('copy'); }, cut() { document.execCommand('cut'); },
    async paste(ids, pt) { try { const items = await navigator.clipboard.read(); const dt = new DataTransfer(); for (const it of items) for (const t of it.types) { const b = await it.getType(t); if (t.startsWith('image/')) dt.items.add(new File([b], 'bild.' + t.split('/')[1], { type: t })); else if (t === 'text/plain' || t === 'text/html') dt.setData(t, await b.text()); } A.handlePaste(dt, pt, A.clip && dt.getData('text/plain') && A.clip.includes(dt.getData('text/plain').slice(0, 20)) ? A.clip : null); } catch { if (A.clip) A.pasteEls(A.clip, pt); else A.toast('Einfügen bitte mit ' + (navigator.platform.includes('Mac') ? '⌘V' : 'Strg+V')); } },
  };
  A.act = (name, ids, arg) => acts[name]?.(ids || [...A.sel], arg);
  A.undo = () => { A.stopEdit(); import('./store.js').then(m => m.undo()); };
}
