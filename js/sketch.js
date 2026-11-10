// Zeichnen: Striche als Daten, Darstellung als SVG, Editor für Skizzen, Bilder und freies Zeichnen
import { h, ap, ico, A, INK, $, clamp, rgbHex } from './util.js';

const SIZES = [2, 4, 8, 16];
export function strokePath(pts) {
  if (!pts.length) return '';
  if (pts.length < 3) return `M${pts[0][0]} ${pts[0][1]} L${pts[pts.length - 1][0] + 0.01} ${pts[pts.length - 1][1]}`;
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; d += ` Q${pts[i][0]} ${pts[i][1]} ${mx.toFixed(1)} ${my.toFixed(1)}`; }
  const l = pts[pts.length - 1]; return d + ` L${l[0]} ${l[1]}`;
}
// Tinteneffekt: Breite folgt Druck bzw. Tempo, als gefüllte Kontur
function inkOutline(pts, size) {
  if (pts.length < 3) return null;
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const w = (size / 2) * clamp(pts[i][2] ?? 1, 0.35, 1.5);
    L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]); R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  return 'M' + L.concat(R.reverse()).map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L') + ' Z';
}
export function strokesSvg(strokes, w, hh, cls = 'strokes') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', `0 0 ${w} ${hh}`); s.setAttribute('class', cls); s.setAttribute('preserveAspectRatio', 'none');
  s.innerHTML = strokesMarkup(strokes);
  return s;
}
export function strokesMarkup(strokes) {
  return (strokes || []).map(st => {
    const o = st.ink && inkOutline(st.pts, st.size);
    return o ? `<path d="${o}" fill="${st.color}"/>` : `<path d="${strokePath(st.pts)}" fill="none" stroke="${st.color}" stroke-width="${st.size}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('');
}
export function svgFile(strokes, w, hh) { return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hh}" width="${w}" height="${hh}">${strokesMarkup(strokes)}</svg>`; }

/* Zeichenfläche. opts: {host, w, h, strokes, bg(img url), toWorld(evt)->[x,y], onDone(strokes|null)} */
export function openPad(opts) {
  let strokes = structuredClone(opts.strokes || []), tool = 'pen', color = A.setting('penColor', '#1c1c1e'), prev = '#ff453a', size = A.setting('penSize', 1), curr = null, sel = new Set(), moving = null, redoS = [];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'pad-svg'); if (opts.w) { svg.setAttribute('viewBox', `0 0 ${opts.w} ${opts.h}`); }
  const pt = e => { if (opts.toWorld) return opts.toWorld(e); const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * opts.w, (e.clientY - r.top) / r.height * opts.h]; };
  const draw = () => { svg.innerHTML = strokesMarkup(strokes) + (curr ? strokesMarkup([curr]) : '') + [...sel].map(i => { const b = bbox(strokes[i]); return `<rect x="${b[0] - 4}" y="${b[1] - 4}" width="${b[2] - b[0] + 8}" height="${b[3] - b[1] + 8}" fill="none" stroke="#0a84ff" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>`; }).join(''); };
  const bbox = st => st.pts.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
  const hit = (p, tol) => { for (let i = strokes.length - 1; i >= 0; i--) if (strokes[i].pts.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < tol + strokes[i].size / 2)) return i; return -1; };
  const scale = () => (opts.scale ? opts.scale() : opts.w / (svg.getBoundingClientRect().width || 1));
  let lastT = 0, lastP = null;
  svg.addEventListener('pointerdown', e => {
    if (e.button) return; e.preventDefault(); e.stopPropagation(); svg.setPointerCapture(e.pointerId); const p = pt(e);
    if (tool === 'pick') { pickFrom(e); return; }
    if (tool === 'pen') { const ink = A.setting('ink', true); curr = { color, size: SIZES[size] * scale(), ink, pts: [[+p[0].toFixed(1), +p[1].toFixed(1), e.pressure && e.pointerType === 'pen' ? e.pressure * 1.6 : 1]] }; lastT = e.timeStamp; lastP = p; }
    else if (tool === 'erase') { erase(p); curr = 'erase'; }
    else { const i = hit(p, 8 * scale()); if (i < 0) sel.clear(); else if (!sel.has(i)) { if (!e.shiftKey) sel.clear(); sel.add(i); } moving = i >= 0 ? p : null; draw(); }
  });
  const erase = p => { const i = hit(p, 6 * scale()); if (i >= 0) { strokes.splice(i, 1); sel.clear(); draw(); } };
  svg.addEventListener('pointermove', e => {
    const p = pt(e);
    if (curr === 'erase') return erase(p);
    if (curr) { let w = 1; if (curr.ink) { if (e.pointerType === 'pen' && e.pressure) w = e.pressure * 1.6; else { const v = Math.hypot(p[0] - lastP[0], p[1] - lastP[1]) / scale() / Math.max(1, e.timeStamp - lastT); const lw = curr.pts[curr.pts.length - 1][2]; w = lw + (clamp(1.35 - v * 0.45, 0.45, 1.35) - lw) * 0.3; } }
      if (Math.hypot(p[0] - lastP[0], p[1] - lastP[1]) > 1.5 * scale()) { curr.pts.push([+p[0].toFixed(1), +p[1].toFixed(1), +w.toFixed(2)]); lastP = p; lastT = e.timeStamp; draw(); } }
    else if (moving) { const dx = p[0] - moving[0], dy = p[1] - moving[1]; sel.forEach(i => strokes[i].pts.forEach(q => { q[0] += dx; q[1] += dy; })); moving = p; draw(); }
  });
  const up = () => { if (curr && curr !== 'erase') { strokes.push(curr); redoS = []; } curr = null; moving = null; draw(); };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  async function pickFrom(e) {
    if (window.EyeDropper) { try { const r = await new EyeDropper().open(); setColor(r.sRGBHex); } catch {} }
    else if (opts.bgImg) { try { const c = document.createElement('canvas'); c.width = opts.w; c.height = opts.h; const x = c.getContext('2d'); x.drawImage(opts.bgImg, 0, 0, opts.w, opts.h); const p = pt(e), d = x.getImageData(p[0], p[1], 1, 1).data; setColor(rgbHex(d[0], d[1], d[2])); } catch {} }
    setTool('pen');
  }
  // Leiste
  const bar = h('div.pad-bar.glass.nodrag');
  const setTool = t => { tool = t; bar.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t)); svg.style.cursor = t === 'sel' ? 'default' : 'crosshair'; };
  const setColor = c => { if (c !== color) prev = color; color = c; A.setSetting('penColor', c); dot.style.background = c; sw.querySelectorAll('i').forEach(i => i.classList.toggle('on', i.dataset.c === c)); };
  const setSize = i => { size = i; A.setSetting('penSize', i); bar.querySelectorAll('[data-s]').forEach(b => b.classList.toggle('on', +b.dataset.s === i)); };
  const dot = h('i.dot', { style: { background: color } });
  const sw = h('div.pad-colors', INK.map(c => h('i', { data: { c }, style: { background: c }, onclick: () => setColor(c) })), h('label.custom', { title: 'Eigene Farbe' }, '+', h('input', { type: 'color', oninput: e => setColor(e.target.value) })));
  const tb = (t, i, title) => h('button', { data: { t }, title, onclick: () => setTool(t) }, ico(i));
  ap(bar, tb('pen', 'pen', 'Stift (D)'), tb('erase', 'eraser', 'Radierer (E)'), tb('sel', 'cursor', 'Auswahl (V)'), tb('pick', 'pipette', 'Pipette'), h('span.sep'),
    SIZES.map((s, i) => h('button.sz', { data: { s: i }, title: 'Stiftgröße ' + (i + 1), onclick: () => setSize(i) }, h('i', { style: { width: 4 + i * 4 + 'px', height: 4 + i * 4 + 'px' } }))), h('span.sep'),
    h('button', { title: 'Farbe', onclick: () => sw.classList.toggle('open') }, dot), sw, h('span.sep'),
    h('button', { title: 'Rückgängig', onclick: () => { if (strokes.length) { redoS.push(strokes.pop()); sel.clear(); draw(); } } }, ico('undo')),
    h('button', { title: 'Wiederholen', onclick: () => { if (redoS.length) { strokes.push(redoS.pop()); draw(); } } }, ico('redo')),
    h('button.txt', { onclick: () => close(false) }, 'Verwerfen'), h('button.txt.primary', { onclick: () => close(true) }, 'Fertig'));
  const key = e => {
    if (e.target.matches('input')) return; const k = e.key.toLowerCase(); let used = true;
    if (k === 'escape') close(true); else if (k === 'd') setTool('pen'); else if (k === 'e') setTool('erase'); else if (k === 'v') setTool('sel'); else if (k === 'x') setColor(prev);
    else if ('1234'.includes(k)) setSize(+k - 1); else if ((k === 'backspace' || k === 'delete') && sel.size) { strokes = strokes.filter((_, i) => !sel.has(i)); sel.clear(); draw(); }
    else if (k === 'z' && (e.metaKey || e.ctrlKey)) { if (strokes.length) { redoS.push(strokes.pop()); sel.clear(); draw(); } } else used = false;
    if (used) { e.preventDefault(); e.stopPropagation(); }
  };
  function close(save) { window.removeEventListener('keydown', key, true); bar.remove(); svg.remove(); A.pad = null; opts.onDone(save ? strokes : null); }
  window.addEventListener('keydown', key, true);
  opts.host.append(svg); document.body.append(bar); setTool('pen'); setSize(size); setColor(color); draw();
  A.pad = { close };
  return { close };
}
