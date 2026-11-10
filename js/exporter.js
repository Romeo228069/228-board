// Export: PDF, PNG, Word, Markdown, Text, ZIP, Drucken, Sicherung
import { A, $, $$, h, esc, textOf, download, loadScript, fmtDate, hostOf } from './util.js';
import { get, all, kids, colKids, descendants, getBlob, putBlob, kv, kvSet, uid, now, tx, add, realBoard, cloneEls } from './store.js';
import { NAMES } from './cards.js';
import { svgFile } from './sketch.js';

const CDN = 'https://cdn.jsdelivr.net/npm/';
const safe = s => (s || 'Board').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'Board';

// HTML einer Notiz nach Markdown
function md(node, ctx = { list: [] }) {
  let out = '';
  for (const n of node.childNodes) {
    if (n.nodeType === 3) { out += n.data; continue; } if (n.nodeType !== 1) continue;
    const t = n.tagName, inner = () => md(n, ctx);
    if (t === 'H1') out += `\n# ${inner().trim()}\n\n`; else if (t === 'H2') out += `\n## ${inner().trim()}\n\n`; else if (t === 'H5') out += `\n> **${inner().trim()}**\n\n`; else if (t === 'H6') out += `\n<small>${inner().trim()}</small>\n\n`;
    else if (t === 'B' || t === 'STRONG') out += `**${inner()}**`; else if (t === 'I' || t === 'EM') out += `*${inner()}*`; else if (t === 'S' || t === 'STRIKE' || t === 'DEL') out += `~~${inner()}~~`; else if (t === 'CODE') out += '`' + inner() + '`';
    else if (t === 'A') out += `[${inner()}](${n.getAttribute('href')})`; else if (t === 'BR') out += '\n'; else if (t === 'HR') out += '\n---\n\n';
    else if (t === 'PRE') out += '\n```\n' + n.innerText + '\n```\n\n'; else if (t === 'BLOCKQUOTE') out += '\n' + inner().trim().split('\n').map(l => '> ' + l).join('\n') + '\n\n';
    else if (t === 'UL' || t === 'OL') { ctx.list.push({ ol: t === 'OL', i: 0, chk: n.classList.contains('chk') }); out += '\n' + inner() + '\n'; ctx.list.pop(); }
    else if (t === 'LI') { const l = ctx.list[ctx.list.length - 1] || {}; l.i = (l.i || 0) + 1; out += '  '.repeat(Math.max(0, ctx.list.length - 1)) + (l.ol ? l.i + '. ' : l.chk ? (n.hasAttribute('data-done') ? '- [x] ' : '- [ ] ') : '- ') + inner().trim() + '\n'; }
    else if (t === 'P' || t === 'DIV') out += inner() + '\n\n'; else out += inner();
  }
  return out;
}
const htmlMd = html => { const d = document.createElement('div'); d.innerHTML = html || ''; return md(d).replace(/\n{3,}/g, '\n\n').trim(); };

// Board linear aufbereiten
function linear(boardId, deep, level = 1, seen = new Set()) {
  if (seen.has(boardId)) return []; seen.add(boardId);
  const b = get(boardId), out = [{ k: 'h', level, text: b.title || 'Ohne Titel' }];
  const sorted = [...kids(boardId), ...kids(boardId, 'unsorted')].filter(e => e.type !== 'line').sort((a, c) => Math.round((a.y || 0) / 60) - Math.round((c.y || 0) / 60) || (a.x || 0) - (c.x || 0));
  const one = e => {
    if (e.type === 'column') { out.push({ k: 'h', level: level + 1, text: e.title || 'Spalte' }); colKids(e.id).forEach(one); return; }
    if (e.type === 'board') { const t = realBoard(e); if (t && deep) out.push(...linear(t.id, deep, level + 1, seen)); else out.push({ k: 'p', text: '▸ ' + (t?.title || 'Board') }); return; }
    if (e.type === 'note') out.push({ k: 'html', html: e.html });
    else if (e.type === 'doc') out.push({ k: 'h', level: level + 1, text: e.title || 'Dokument' }, { k: 'html', html: e.html });
    else if (e.type === 'link' || e.type === 'audio' || e.type === 'video' || e.type === 'map') out.push({ k: 'link', title: e.title || e.name || NAMES[e.type], url: e.url, desc: e.desc || e.caption });
    else if (e.type === 'todo') out.push({ k: 'todo', title: e.hasTitle && e.title, items: e.items || [] });
    else if (e.type === 'image') out.push({ k: 'img', src: e.src, cap: e.caption });
    else if (e.type === 'file') out.push({ k: 'p', text: '📎 ' + e.name });
    else if (e.type === 'swatch') out.push({ k: 'p', text: `■ ${e.name || ''} ${e.hex}`.trim() });
    else if (e.type === 'table') out.push({ k: 'table', title: e.hasTitle && e.title, cells: tableValues(e) });
    else if (e.type === 'comment') out.push({ k: 'comment', thread: e.thread || [] });
    else if (e.type === 'sketch') out.push({ k: 'svg', svg: svgFile(e.strokes, e.vw, e.vh) });
  };
  sorted.forEach(one); return out;
}
function tableValues(e) { const n = document.querySelector(`.el[data-id="${e.id}"] .tbl`); if (n) return [...n.querySelectorAll('tr:not(.heads)')].map(tr => [...tr.querySelectorAll('td')].map(td => (td.querySelector('input') ? (td.querySelector('input').checked ? '☑' : '☐') : td.textContent))); return e.cells; }
const toMd = blocks => blocks.map(b => b.k === 'h' ? '#'.repeat(Math.min(6, b.level)) + ' ' + b.text : b.k === 'html' ? htmlMd(b.html) : b.k === 'p' ? b.text : b.k === 'link' ? `[${b.title}](${b.url || ''})` + (b.desc ? `\n${b.desc}` : '') : b.k === 'todo' ? (b.title ? `**${b.title}**\n` : '') + b.items.map(i => '  '.repeat(i.indent || 0) + `- [${i.done ? 'x' : ' '}] ${i.text}` + (i.who ? ` (@${i.who})` : '') + (i.due ? ` – fällig ${fmtDate(i.due, !!i.dueTime)}` : '')).join('\n') : b.k === 'img' ? `![${b.cap || 'Bild'}](${/^https?:/.test(b.src) ? b.src : 'bild'})` + (b.cap ? `\n*${b.cap}*` : '') : b.k === 'table' ? (b.title ? `**${b.title}**\n\n` : '') + b.cells.map((r, i) => '| ' + r.join(' | ') + ' |' + (i === 0 ? '\n|' + r.map(() => ' --- |').join('') : '')).join('\n') : b.k === 'comment' ? b.thread.map(m => `> **${m.author}** (${fmtDate(m.ts)}): ${textOf(m.html)}`).join('\n') : '').filter(Boolean).join('\n\n') + '\n';
const toTxt = blocks => blocks.map(b => b.k === 'h' ? '\n' + b.text.toUpperCase() + '\n' + '='.repeat(Math.min(60, b.text.length)) : b.k === 'html' ? textOf(b.html).trim() : b.k === 'p' ? b.text : b.k === 'link' ? `${b.title}\n${b.url || ''}` + (b.desc ? `\n${b.desc}` : '') : b.k === 'todo' ? (b.title ? b.title + '\n' : '') + b.items.map(i => '  '.repeat(i.indent || 0) + `[${i.done ? 'x' : ' '}] ${i.text}`).join('\n') : b.k === 'img' ? `[Bild${b.cap ? ': ' + b.cap : ''}]` : b.k === 'table' ? (b.title ? b.title + '\n' : '') + b.cells.map(r => r.join('\t')).join('\n') : b.k === 'comment' ? b.thread.map(m => `${m.author} (${fmtDate(m.ts)}): ${textOf(m.html)}`).join('\n') : '').filter(Boolean).join('\n\n') + '\n';
async function dataUrl(key) { try { const b = /^https?:/.test(key) ? await (await fetch(key)).blob() : await getBlob(key); if (!b) return ''; return await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); } catch { return /^https?:/.test(key) ? key : ''; } }
async function toHtml(blocks, title, bg) {
  const parts = []; for (const b of blocks) {
    if (b.k === 'h') parts.push(`<h${Math.min(6, b.level)}>${esc(b.text)}</h${Math.min(6, b.level)}>`); else if (b.k === 'html') parts.push(`<div class="note">${b.html || ''}</div>`); else if (b.k === 'p') parts.push(`<p>${esc(b.text)}</p>`);
    else if (b.k === 'link') parts.push(`<p><a href="${esc(b.url || '')}">${esc(b.title)}</a>${b.desc ? '<br>' + esc(b.desc) : ''}</p>`);
    else if (b.k === 'todo') parts.push((b.title ? `<p><b>${esc(b.title)}</b></p>` : '') + '<ul style="list-style:none;padding-left:0">' + b.items.map(i => `<li style="margin-left:${(i.indent || 0) * 20}px">${i.done ? '☑' : '☐'} ${esc(i.text)}${i.who ? ` <i>(${esc(i.who)})</i>` : ''}${i.due ? ` – ${fmtDate(i.due, !!i.dueTime)}` : ''}</li>`).join('') + '</ul>');
    else if (b.k === 'img') { const u = await dataUrl(b.src); parts.push(`<p>${u ? `<img src="${u}" style="max-width:100%;width:420px">` : ''}${b.cap ? `<br><i>${esc(b.cap)}</i>` : ''}</p>`); }
    else if (b.k === 'table') parts.push((b.title ? `<p><b>${esc(b.title)}</b></p>` : '') + '<table border="1" cellpadding="6" style="border-collapse:collapse">' + b.cells.map(r => '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('') + '</table>');
    else if (b.k === 'comment') parts.push('<blockquote>' + b.thread.map(m => `<p><b>${esc(m.author)}</b> <small>${fmtDate(m.ts)}</small><br>${m.html}</p>`).join('') + '</blockquote>');
    else if (b.k === 'svg') parts.push(`<p>${b.svg.replace('<svg ', '<svg style="max-width:420px;height:auto" ')}</p>`);
  }
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.5;color:#1c1c1e;${bg ? 'background:' + bg : ''}}h1{font-size:28px}h2{font-size:22px}h3{font-size:18px}.note{margin:14px 0}blockquote{border-left:3px solid #ccc;margin-left:0;padding-left:14px;color:#444}pre{background:#f2f2f4;padding:10px;border-radius:6px}ul.chk{list-style:none;padding-left:4px}ul.chk li::before{content:"☐ "}ul.chk li[data-done]::before{content:"☑ "}</style></head><body>${parts.join('\n')}</body></html>`;
}
function printHtml(html) { const f = h('iframe', { style: { position: 'fixed', width: '0', height: '0', border: '0' } }); document.body.append(f); f.srcdoc = html; f.onload = () => { setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); }, 300); }; }

// Bild der Leinwand
async function raster(large) {
  await loadScript(CDN + 'html-to-image@1.11.11/dist/html-to-image.js');
  const world = $('#world'), ns = $$('#cards > .el'); if (!ns.length) throw new Error('Das Board ist leer');
  let b = [1e9, 1e9, -1e9, -1e9]; ns.forEach(n => { const w = A.wrect(n); b = [Math.min(b[0], w.x), Math.min(b[1], w.y), Math.max(b[2], w.x + w.w), Math.max(b[3], w.y + w.h)]; });
  all().filter(e => e.type === 'line' && e.board === A.board && e.loc === 'canvas').forEach(l => ['a', 'b'].forEach(k => { if (!l[k].el) b = [Math.min(b[0], l[k].x), Math.min(b[1], l[k].y), Math.max(b[2], l[k].x), Math.max(b[3], l[k].y)]; }));
  const pad = 60, w = Math.ceil(b[2] - b[0] + pad * 2), hh = Math.ceil(b[3] - b[1] + pad * 2), bg = get(A.board).bg || getComputedStyle($('#stage')).backgroundColor;
  const ratio = Math.min(large ? 3 : 2, Math.sqrt(16e6 * (large ? 4 : 1) / (w * hh)) || 1);
  A.select([]); document.body.classList.add('exporting');
  try { const url = await htmlToImage.toPng(world, { width: w, height: hh, pixelRatio: ratio, backgroundColor: bg, cacheBust: false, skipFonts: true, imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', filter: n => !(n.classList && (n.classList.contains('rz') || n.classList.contains('lh') || n.classList.contains('shield') || n.tagName === 'IFRAME')), style: { transform: `translate(${-b[0] + pad}px,${-b[1] + pad}px) scale(1)`, transformOrigin: '0 0' } }); return { url, w, h: hh }; }
  finally { document.body.classList.remove('exporting'); }
}
export async function exportBoard(id, fmt, o = {}) {
  const b = get(id), name = safe(b.title), deep = A.setting('expDeep', true);
  if (fmt === 'png' || fmt === 'pdf') { A.toast('Export wird erstellt …'); const r = await raster(o.large);
    if (fmt === 'png') return download(await (await fetch(r.url)).blob(), name + '.png');
    await loadScript(CDN + 'jspdf@2.5.1/dist/jspdf.umd.min.js'); const pdf = new jspdf.jsPDF({ orientation: r.w > r.h ? 'l' : 'p', unit: 'pt', format: [r.w * 0.75, r.h * 0.75], compress: true }); pdf.addImage(r.url, 'PNG', 0, 0, r.w * 0.75, r.h * 0.75, undefined, o.large ? 'NONE' : 'FAST'); return pdf.save(name + '.pdf'); }
  const blocks = linear(id, deep);
  if (fmt === 'md') return download(new Blob([toMd(blocks)], { type: 'text/markdown' }), name + '.md');
  if (fmt === 'txt') return download(new Blob([toTxt(blocks)], { type: 'text/plain' }), name + '.txt');
  if (fmt === 'word') return download(new Blob(['﻿', await toHtml(blocks, name)], { type: 'application/msword' }), name + '.doc');
  if (fmt === 'print') return printHtml(await toHtml(blocks, name));
  if (fmt === 'zip') { A.toast('ZIP wird erstellt …'); await loadScript(CDN + 'jszip@3.10.1/dist/jszip.min.js'); const zip = new JSZip(), used = new Set(); let n = 0;
    for (const e of [...all().filter(x => x.board === id), ...descendants(id)]) { const key = e.orig || e.blob || (e.type === 'image' ? e.src : null); if (!key || e.loc === 'trash') continue; let blob; try { blob = /^https?:/.test(key) ? await (await fetch(key)).blob() : await getBlob(key); } catch {} if (!blob) continue; let fn = safe(e.name || (e.caption ? e.caption.slice(0, 40) : 'bild-' + ++n)); if (!/\.\w{2,5}$/.test(fn)) fn += '.' + ((blob.type.split('/')[1] || 'bin').replace('jpeg', 'jpg').replace('svg+xml', 'svg')); while (used.has(fn)) fn = fn.replace(/(\.\w+)$/, '-' + ++n + '$1'); used.add(fn); zip.file(fn, blob); }
    if (!used.size) return A.toast('Dieses Board enthält keine Bilder oder Dateien'); return download(await zip.generateAsync({ type: 'blob' }), name + '.zip'); }
}
export async function exportDoc(id, fmt) {
  const e = get(id), name = safe(e.title || 'Dokument'), blocks = [{ k: 'h', level: 1, text: e.title || 'Dokument' }, { k: 'html', html: e.html }];
  if (fmt === 'md') return download(new Blob([toMd(blocks)], { type: 'text/markdown' }), name + '.md');
  if (fmt === 'txt') return download(new Blob([toTxt(blocks)], { type: 'text/plain' }), name + '.txt');
  if (fmt === 'word') return download(new Blob(['﻿', await toHtml(blocks, name)], { type: 'application/msword' }), name + '.doc');
  await loadScript(CDN + 'jspdf@2.5.1/dist/jspdf.umd.min.js'); const pdf = new jspdf.jsPDF({ unit: 'pt', format: 'a4' }), W = 595 - 120; let y = 70;
  const put = (text, size, style, gap, indent = 0) => { pdf.setFont('helvetica', style); pdf.setFontSize(size); for (const line of pdf.splitTextToSize(text, W - indent)) { if (y > 780) { pdf.addPage(); y = 70; } pdf.text(line, 60 + indent, y); y += size * 1.45; } y += gap; };
  put(e.title || 'Dokument', 24, 'bold', 12); const d = document.createElement('div'); d.innerHTML = e.html || '';
  const walk = n => { for (const c of n.children.length ? n.children : [n]) { const t = c.tagName, txt = c.innerText?.trim(); if (!txt && t !== 'HR') continue; if (t === 'H1') put(txt, 19, 'bold', 6); else if (t === 'H2') put(txt, 15, 'bold', 5); else if (t === 'UL' || t === 'OL') [...c.children].forEach((li, i) => put((t === 'OL' ? i + 1 + '. ' : c.classList.contains('chk') ? (li.hasAttribute('data-done') ? '[x] ' : '[ ] ') : '•  ') + li.innerText.trim(), 11, 'normal', 2, 14)); else if (t === 'BLOCKQUOTE') put(txt, 11, 'italic', 6, 18); else if (t === 'PRE') { pdf.setFont('courier', 'normal'); put(txt, 10, 'normal', 6, 8); } else if (t === 'H6') put(txt, 9, 'normal', 4); else put(txt, 11, 'normal', 6); } };
  if (d.children.length) walk(d); else put(d.innerText, 11, 'normal', 6); pdf.save(name + '.pdf');
}

/* Sicherung als Datei */
export async function backup(boardId) {
  A.toast('Sicherung wird erstellt …'); const full = boardId === 'home', els = full ? all() : [get(boardId), ...descendants(boardId)], blobs = {};
  for (const e of els) for (const k of [e.src, e.blob, e.thumb, e.orig, e.img]) if (k && k[0] === 'b' && !/^(blob|https?|data):/.test(k) && !blobs[k]) blobs[k] = await dataUrl(k);
  const labels = kv('labels', {}); download(new Blob([JSON.stringify({ app: '228board', v: 1, full, root: boardId, els, blobs, labels, people: kv('people', []) })], { type: 'application/json' }), safe(full ? '228 Board Sicherung ' + new Date().toISOString().slice(0, 10) : get(boardId).title) + '.228board');
}
export async function restore(file) {
  let d; try { d = JSON.parse(await file.text()); } catch { return A.toast('Diese Datei lässt sich nicht lesen'); } if (d.app !== '228board') return A.toast('Das ist keine 228-Board-Datei');
  const bmap = {}; for (const k in d.blobs) { try { bmap[k] = await putBlob(await (await fetch(d.blobs[k])).blob()); } catch {} }
  kvSet('labels', { ...d.labels, ...kv('labels', {}) }); kvSet('people', [...new Set([...kv('people', []), ...(d.people || [])])]);
  const idm = new Map(d.els.map(e => [e.id, uid()])); const root = d.full ? 'home' : d.root;
  const els = d.els.filter(e => !(d.full && e.id === 'home')).map(e => { const c = structuredClone(e); c.id = idm.get(e.id); for (const k of ['src', 'blob', 'thumb', 'orig', 'img']) if (bmap[c[k]]) c[k] = bmap[c[k]];
    c.board = e.board === root && d.full ? idm.get('home') : idm.get(e.board) || A.board; if (c.col) c.col = idm.get(c.col) || null; if (c.pin) c.pin = idm.get(c.pin) || null; if (c.alias) c.alias = idm.get(c.alias) || c.alias; if (c.type === 'line') ['a', 'b'].forEach(k => { if (c[k].el) c[k].el = idm.get(c[k].el) || c[k].el; }); return c; });
  let top;
  if (d.full) { top = { id: idm.get('home'), type: 'board', title: 'Import ' + new Date().toLocaleDateString('de-DE'), board: A.board, loc: 'canvas', x: Math.round(A.center()[0]), y: Math.round(A.center()[1]), z: 99 }; els.push(top); }
  else { top = els.find(e => e.id === idm.get(d.root)); Object.assign(top, { board: A.board, loc: 'canvas', col: null, x: Math.round(A.center()[0]), y: Math.round(A.center()[1]) }); }
  tx(() => els.forEach(add)); A.closeModal(); A.select([top.id]); A.toast('Import abgeschlossen', 'Öffnen', () => A.openBoard(top.id));
}
