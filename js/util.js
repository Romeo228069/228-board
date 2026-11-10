// Gemeinsame Helfer, Symbole, Farben, Einbettungen
export const A = {}; // App-Schnittstelle, wird von app.js gefüllt
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function h(tag, attrs, ...kids) {
  const [t0, ...cls] = tag.split('.'), [t, id] = t0.split('#');
  const n = document.createElement(t || 'div');
  if (id) n.id = id;
  if (cls.length) n.className = cls.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'data') Object.assign(n.dataset, v);
    else if (k[0] === '_') n[k] = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
}
export const ap = (n, ...k) => { for (const c of k.flat(Infinity)) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c)); return n; };
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
export const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
export const mod = e => (isMac ? e.metaKey : e.ctrlKey);
export const textOf = html => { const d = document.createElement('div'); d.innerHTML = html || ''; return d.innerText || d.textContent || ''; };
export const fmtDate = (ts, time = true) => new Date(ts).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit', hour12: A.setting?.('h12', false) } : {}) });
export const fmtSize = b => (b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB');
export function download(blob, name) { const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
export function loadScript(src) { return (loadScript.c[src] ??= new Promise((res, rej) => { const s = h('script', { src }); s.onload = res; s.onerror = rej; document.head.append(s); })); }
loadScript.c = {};

// Symbole (24er Raster, Linienstil)
const P = {
  note: 'M5 4h14v11l-5 5H5zM14 20v-5h5M8 9h8M8 12h5',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  todo: 'M4 6l2 2 3-4M4 14l2 2 3-4M12 7h8M12 15h8',
  line: 'M5 19L19 5M12 5h7v7',
  board: 'M4 5h16v14H4zM4 9h16M9 9v10',
  column: 'M6 4h12v16H6zM9 8h6M9 12h6M9 16h4',
  comment: 'M4 5h16v11H10l-5 4v-4H4z',
  table: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14M15 5v14',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01',
  upload: 'M12 16V5M7 10l5-5 5 5M5 19h14',
  draw: 'M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3',
  swatch: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.500 6-11 6-11z',
  doc: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7',
  audio: 'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  video: 'M4 6h12v12H4zM16 10l4-2v8l-4-2',
  map: 'M12 21s6-5.500 6-10.500a6 6 0 0 0-12 0C6 15.500 12 21 12 21zM12 12.500a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  sketch: 'M4 5h16v14H4zM7 15c2-5 3 2 5-2s3 1 5-3',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  photo: 'M4 7h4l1.500-2h5L16 7h4v12H4zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  tpl: 'M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6',
  inbox: 'M4 13l2-8h12l2 8v6H4zM4 13h5l1 2h4l1-2h5',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  export: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  gear: 'M12 15.500a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7zM19 12l2-1-2-4-2 1-2-1.200L14.500 4h-5L9 6.800 7 8 5 7l-2 4 2 1v0l-2 1 2 4 2-1 2 1.200.500 2.800h5l.500-2.800L17 16l2 1 2-4-2-1z',
  share: 'M12 15V4M8 8l4-4 4 4M6 12H5v8h14v-8h-1',
  bell: 'M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4',
  lock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3',
  x: 'M6 6l12 12M18 6L6 18', plus: 'M12 5v14M5 12h14', check: 'M5 12l5 5 9-10', chev: 'M9 6l6 6-6 6', down: 'M6 9l6 6 6-6',
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z', tag: 'M4 4h8l8 8-8 8-8-8zM8.500 8.500h.01', smile: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.500 14s1.300 2 3.500 2 3.500-2 3.500-2M9 9.500h.01M15 9.500h.01',
  bold: 'M7 5h6a3.500 3.500 0 0 1 0 7H7zM7 12h7a3.500 3.500 0 0 1 0 7H7z', italic: 'M10 5h7M7 19h7M14 5l-4 14', under: 'M7 4v7a5 5 0 0 0 10 0V4M5 20h14', strike: 'M5 12h14M16 7a4 4 0 0 0-4-2c-2.500 0-4 1.300-4 3M8 17a4 4 0 0 0 4 2c2.500 0 4-1.300 4-3',
  ul: 'M9 6h11M9 12h11M9 18h11M4.500 6h.01M4.500 12h.01M4.500 18h.01', ol: 'M10 6h10M10 12h10M10 18h10M4 5l1.500-1v4M4 16h2.500L4 19h2.500', center: 'M5 6h14M8 12h8M6 18h12',
  code: 'M8 8l-4 4 4 4M16 8l4 4-4 4M13 5l-2 14', quote: 'M5 17V11a4 4 0 0 1 4-4M13 17V11a4 4 0 0 1 4-4', indent: 'M4 6h16M11 12h9M4 18h16M4 10l3 2-3 2', outdent: 'M4 6h16M11 12h9M4 18h16M7 10l-3 2 3 2',
  play: 'M7 5l12 7-12 7z', crop: 'M7 3v14h14M3 7h14v14', rotate: 'M20 12a8 8 0 1 1-3-6.200M20 4v5h-5', dl: 'M12 4v11M7 10l5 5 5-5M5 20h14', ext: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  dup: 'M8 8h12v12H8zM4 16V4h12', moon: 'M20 14.500A8 8 0 0 1 9.500 4a8 8 0 1 0 10.500 10.500z', fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', present: 'M3 5h18v11H3zM12 16v4M8 20h8',
  pen: 'M4 20l4-1L19 8l-3-3L5 16z', eraser: 'M4 16l9-9 6 6-6 6H8zM13 19h7', cursor: 'M6 4l12 7-5 1.500L11 18z', pipette: 'M14 6l4 4M12 8l4 4-7 7H5v-4zM16 4l4 4-2 2-4-4z',
  connect: 'M4 6h5v5H4zM15 13h5v5h-5zM9 8.500h4a2 2 0 0 1 2 2V13', distH: 'M4 4v16M20 4v16M9 8h6v8H9z', distV: 'M4 4h16M4 20h16M8 9h8v6H8z',
  cal: 'M5 6h14v14H5zM5 10h14M9 4v4M15 4v4', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0', title: 'M5 6h14M12 6v13', sum: 'M17 5H7l6 7-6 7h10', caption: 'M4 5h16v10H4zM7 19h10',
  back: 'M15 6l-6 6 6 6', grid: 'M5 5h.01M12 5h.01M19 5h.01M5 12h.01M12 12h.01M19 12h.01M5 19h.01M12 19h.01M19 19h.01', help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.700.400-1 1-1 1.700M12 17h.01', pin: 'M9 4h6l-1 6 3 3H7l3-3zM12 13v7',
  bg: 'M5 5h14v14H5zM5 14l5-5 9 9', collapse: 'M6 12h12', wand: 'M5 19L16 8M14 6l1-2 1 2 2 1-2 1-1 2-1-2-2-1zM6 6l.500-1 .500 1 1 .500-1 .500-.500 1-.500-1-1-.500z', sync: 'M4 12a8 8 0 0 1 14-5.300L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.300L4 15M4 20v-5h5',
};
export const ico = (name, size = 20) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('class', 'ico'); s.innerHTML = `<path d="${P[name] || P.more}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`; return s; };
export const icoHtml = (name, size = 20) => ico(name, size).outerHTML;

// Kartenfarben: [Name, Hintergrund, Text] – zweifarbige Paare
export const CARD_COLORS = [
  ['Weiß', '', ''], ['Transparent', 'transparent', ''], ['Graphit', '#2c2c2e', '#fff'], ['Nebel', '#e5e5ea', '#1c1c1e'],
  ['Koralle', '#ff6b5e', '#fff'], ['Mandarine', '#ff9f0a', '#1c1c1e'], ['Sonne', '#ffd60a', '#1c1c1e'], ['Limette', '#b4e33d', '#1c1c1e'],
  ['Minze', '#30d158', '#06260f'], ['Lagune', '#40c8e0', '#06262c'], ['Ozean', '#0a84ff', '#fff'], ['Indigo', '#5e5ce6', '#fff'],
  ['Flieder', '#bf5af2', '#fff'], ['Rosé', '#ff8fb1', '#3a0a1a'], ['Sand', '#f2e3c9', '#3a2a10'], ['Salbei', '#cfe3d4', '#12301c'],
  ['Himmel', '#d6e8ff', '#0b2a4d'], ['Puder', '#fde2e4', '#4a1520'], ['Butter', '#fff3bf', '#3d3200'], ['Lavendel', '#e7defa', '#2a1a55'],
];
export const INK = ['#1c1c1e', '#8e8e93', '#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#40c8e0', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff8fb1', '#ffffff'];
export const LABEL_COLORS = ['#ff6b5e', '#ff9f0a', '#e6b800', '#30b350', '#22a6c0', '#0a84ff', '#5e5ce6', '#bf5af2', '#e0558a', '#8e8e93'];

// Farbrechnung
export const hexNorm = s => { let m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(s).trim()); if (!m) return null; let x = m[1]; if (x.length === 3) x = [...x].map(c => c + c).join(''); return '#' + x.toLowerCase(); };
export const hexRgb = hx => { const n = parseInt(hx.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export const rgbHex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
export function rgbHsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let hh = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; } return [Math.round(hh), Math.round(s * 100), Math.round(l * 100)]; }
export function hslRgb(hh, s, l) { s /= 100; l /= 100; const k = n => (n + hh / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [f(0) * 255, f(8) * 255, f(4) * 255]; }
export const lum = hx => { const [r, g, b] = hexRgb(hx); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
export const inkOn = hx => (!hx || hx === 'transparent' ? '' : lum(hx) > 0.6 ? '#1c1c1e' : '#fff');
const NAMES = [['Schwarz', 0, 0, 5], ['Anthrazit', 0, 0, 18], ['Grau', 0, 0, 50], ['Silber', 0, 0, 75], ['Weiß', 0, 0, 97], ['Rot', 0, 80, 50], ['Weinrot', 345, 70, 30], ['Koralle', 8, 90, 65], ['Orange', 28, 95, 52], ['Bernstein', 40, 95, 50], ['Gelb', 52, 95, 55], ['Creme', 45, 70, 88], ['Sand', 38, 45, 75], ['Braun', 25, 50, 30], ['Oliv', 70, 45, 35], ['Limette', 80, 70, 55], ['Grün', 130, 60, 42], ['Minze', 150, 55, 70], ['Tanne', 155, 60, 22], ['Türkis', 175, 70, 45], ['Cyan', 190, 85, 55], ['Himmelblau', 205, 85, 70], ['Blau', 215, 85, 50], ['Marine', 220, 65, 22], ['Indigo', 245, 65, 50], ['Violett', 270, 65, 52], ['Flieder', 275, 60, 78], ['Magenta', 310, 75, 52], ['Pink', 335, 85, 62], ['Rosé', 345, 75, 85]];
export function colorName(hx) { const [hh, s, l] = rgbHsl(...hexRgb(hx)); let best = '', bd = 1e9; for (const [n, nh, ns, nl] of NAMES) { const dh = Math.min(Math.abs(hh - nh), 360 - Math.abs(hh - nh)) * (s / 100) * (ns ? 1 : 0.2); const d = dh * 1.2 + Math.abs(s - ns) * 0.8 + Math.abs(l - nl) * 1.4; if (d < bd) { bd = d; best = n; } } return best; }
// Farbpalette aus einem Bild
export function palette(img, n = 5) {
  try { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 32, 32); const d = x.getImageData(0, 0, 32, 32).data, m = new Map();
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; const k = (d[i] >> 5) << 6 | (d[i + 1] >> 5) << 3 | (d[i + 2] >> 5); const e = m.get(k) || [0, 0, 0, 0]; e[0] += d[i]; e[1] += d[i + 1]; e[2] += d[i + 2]; e[3]++; m.set(k, e); }
    return [...m.values()].sort((a, b) => b[3] - a[3]).slice(0, n).map(e => rgbHex(e[0] / e[3], e[1] / e[3], e[2] / e[3]));
  } catch { return []; }
}

// Einbettungen: URL -> iframe
export function embedFor(url) {
  let u; try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, ''), p = u.pathname, q = u.searchParams; let m;
  if (host === 'youtu.be') return { src: 'https://www.youtube-nocookie.com/embed/' + p.slice(1), ratio: 16 / 9, kind: 'video' };
  if (/youtube\.com$/.test(host) && host !== 'music.youtube.com') { const id = q.get('v') || (m = /\/(shorts|embed|live)\/([\w-]+)/.exec(p))?.[2]; if (id) return { src: 'https://www.youtube-nocookie.com/embed/' + id, ratio: 16 / 9, kind: 'video' }; if (q.get('list')) return { src: 'https://www.youtube-nocookie.com/embed/videoseries?list=' + q.get('list'), ratio: 16 / 9, kind: 'video' }; }
  if (host === 'music.youtube.com') { const id = q.get('v'); if (id) return { src: 'https://www.youtube-nocookie.com/embed/' + id, h: 200, kind: 'audio' }; if (q.get('list')) return { src: 'https://www.youtube-nocookie.com/embed/videoseries?list=' + q.get('list'), h: 200, kind: 'audio' }; }
  if (host === 'vimeo.com' && (m = /\/(\d+)/.exec(p))) return { src: 'https://player.vimeo.com/video/' + m[1], ratio: 16 / 9, kind: 'video' };
  if (host === 'ted.com' && (m = /\/talks\/([\w-]+)/.exec(p))) return { src: 'https://embed.ted.com/talks/' + m[1], ratio: 16 / 9, kind: 'video' };
  if (host === 'loom.com' && (m = /\/share\/(\w+)/.exec(p))) return { src: 'https://www.loom.com/embed/' + m[1], ratio: 16 / 9, kind: 'video' };
  if (host === 'dailymotion.com' && (m = /\/video\/(\w+)/.exec(p))) return { src: 'https://www.dailymotion.com/embed/video/' + m[1], ratio: 16 / 9, kind: 'video' };
  if (host === 'open.spotify.com' && (m = /\/(?:intl-\w+\/)?(track|album|playlist|episode|show|artist)\/(\w+)/.exec(p))) return { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, h: m[1] === 'track' || m[1] === 'episode' ? 152 : 352, kind: 'audio' };
  if (host === 'soundcloud.com') return { src: 'https://w.soundcloud.com/player/?visual=false&url=' + encodeURIComponent(url), h: 166, kind: 'audio' };
  if (host === 'mixcloud.com') return { src: 'https://www.mixcloud.com/widget/iframe/?feed=' + encodeURIComponent(p), h: 120, kind: 'audio' };
  if (host === 'music.apple.com') return { src: url.replace('music.apple.com', 'embed.music.apple.com'), h: /\?i=|\/song\//.test(url) ? 175 : 450, kind: 'audio' };
  if (host === 'deezer.com' && (m = /\/(track|album|playlist)\/(\d+)/.exec(p))) return { src: `https://widget.deezer.com/widget/auto/${m[1]}/${m[2]}`, h: 300, kind: 'audio' };
  if (/bandcamp\.com$/.test(host) && p.includes('EmbeddedPlayer')) return { src: url, h: 120, kind: 'audio' };
  if (host === 'codepen.io' && (m = /\/([\w-]+)\/(?:pen|full|details)\/(\w+)/.exec(p))) return { src: `https://codepen.io/${m[1]}/embed/${m[2]}?default-tab=result`, h: 360, kind: 'embed' };
  if (host === 'figma.com') return { src: 'https://www.figma.com/embed?embed_host=board228&url=' + encodeURIComponent(url), ratio: 4 / 3, kind: 'embed' };
  if (host === 'airtable.com' && (m = /^\/(?:embed\/)?(shr\w+|app\w+\/shr\w+)/.exec(p))) return { src: 'https://airtable.com/embed/' + m[1], h: 420, kind: 'embed' };
  if (host === 'prezi.com' && (m = /\/(?:view|p|embed)\/([\w-]+)/.exec(p))) return { src: `https://prezi.com/p/embed/${m[1]}/`, ratio: 16 / 9, kind: 'embed' };
  if (host === 'slideshare.net' && p.includes('/slideshow/embed_code')) return { src: url, ratio: 4 / 3, kind: 'embed' };
  if (host === 'marvelapp.com' && (m = /\/(?:prototype\/)?(\w+)/.exec(p))) return { src: `https://marvelapp.com/prototype/${m[1]}?emb=1`, ratio: 3 / 4, kind: 'embed' };
  if (host === 'instagram.com' && (m = /\/(p|reel|tv)\/([\w-]+)/.exec(p))) return { src: `https://www.instagram.com/${m[1]}/${m[2]}/embed`, h: 560, kind: 'embed' };
  if ((host === 'twitter.com' || host === 'x.com') && (m = /\/status\/(\d+)/.exec(p))) return { src: 'https://platform.twitter.com/embed/Tweet.html?dnt=true&id=' + m[1], h: 420, kind: 'embed' };
  if (host === 'flickr.com' && /\/photos\//.test(p)) return { src: url.replace(/\/$/, '') + '/player/', ratio: 3 / 2, kind: 'embed' };
  if (host === 'dropbox.com' && /\.(png|jpe?g|gif|webp)$/i.test(p)) return { img: url.replace(/[?&]dl=0/, '') + (url.includes('?') ? '&' : '?') + 'raw=1', kind: 'img' };
  const map = mapEmbed(url); if (map) return { src: map, ratio: 4 / 3, kind: 'map' };
  return null;
}
export function mapEmbed(url) {
  let u; try { u = new URL(url); } catch { return null; }
  if (!/google\.[a-z.]+$/.test(u.hostname) || !/^\/maps/.test(u.pathname)) return null;
  if (u.pathname.includes('/embed')) return url;
  const at = /@(-?\d+\.\d+),(-?\d+\.\d+),(\d+(?:\.\d+)?)z/.exec(url), place = /\/place\/([^/]+)/.exec(u.pathname), qq = u.searchParams.get('q');
  const q = place ? decodeURIComponent(place[1]).replace(/\+/g, ' ') : qq || (at ? `${at[1]},${at[2]}` : null);
  if (!q) return null;
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}${at ? '&z=' + Math.round(at[3]) : ''}&output=embed`;
}
export const isUrl = s => /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(String(s).trim()) && !/\s/.test(String(s).trim());
export const fixUrl = s => (/^https?:\/\//i.test(s.trim()) ? s.trim() : 'https://' + s.trim());
export const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

// Icon-Bibliothek für Boards: [Emoji, Stichworte]
export const BOARD_ICONS = `📋 board plan projekt liste|🎬 film video dreh klappe schnitt|🎥 kamera film dreh|📷 foto fotografie shooting|🎞 storyboard film streifen|🎨 design farbe mood kunst art|🖌 pinsel illustration malen|✏️ skizze entwurf zeichnen notiz|📝 notizen text brief schreiben|💡 idee brainstorm konzept|🧠 denken strategie research|🎯 ziel fokus kampagne|📣 marketing werbung social|📈 wachstum zahlen analyse|📊 daten report statistik|💰 budget geld kosten angebot finanzen|🗓 kalender woche termin zeitplan|⏱ zeit timing deadline|✅ aufgaben todo erledigt check|🚀 start launch release startup|🧩 produkt feature puzzle|🛠 werkzeug bau tool technik|💻 web software code entwicklung website|📱 app mobil telefon|🎧 audio ton musik podcast|🎵 musik song sound|🎤 interview sprecher podcast|📚 buch recherche wissen lernen kurs|🎓 studium bildung schule|✍️ roman schreiben autor story|🗺 karte reise ort location|📍 ort location scouting|✈️ reise urlaub flug|🏠 haus wohnung zuhause interior|🛋 interior möbel einrichtung|🏗 architektur bau|🌿 natur garten pflanzen|🍽 essen rezept kochen food|☕ kaffee pause café|👗 mode fashion kleidung|👟 schuhe sport sneaker|⚽ sport fußball training|🎮 spiel game|🎭 theater figur charakter|👥 team kunden personen|🤝 kunde partner meeting|🏢 firma agentur büro|🎉 event feier party|💍 hochzeit|🎁 geschenk|❤️ liebe favorit|⭐ wichtig highlight favorit|🔥 trend hot|🌍 welt global|🔬 forschung labor|⚙️ einstellungen system prozess|📦 lieferung paket verpackung|🛒 shop einkauf|🔑 schlüssel zugang|📌 pin merken|🗂 archiv ordner ablage|🧾 rechnung beleg|🖼 bild galerie portfolio|🌙 nacht|☀️ sommer tag|❄️ winter|🐾 tier`.split('|').map(s => { const [e, ...k] = s.split(' '); return [e, k.join(' ')]; });
export function autoIcon(title) { const t = (title || '').toLowerCase(); if (!t) return '📋'; for (const [e, k] of BOARD_ICONS) if (k.split(' ').some(w => t.includes(w))) return e; return '📋'; }
export const EMOJI = '👍 ❤️ 🔥 👏 🎉 😂 😍 🤔 👀 ✅ ❌ ⭐ 💡 🙌 😮 😢 🚀 💯 👌 🙏 😎 🤝 ⚡ 🎯'.split(' ');
