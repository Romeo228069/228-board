// Datenhaltung: alle Elemente in IndexedDB, Transaktionen mit Undo/Redo.
export const S = { els: new Map(), kv: {}, undo: [], redo: [], subs: new Set(), sync: new Set() };
let db, cur = null;
const clone = o => (o == null ? o : structuredClone(o));
export const now = () => Date.now();
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export async function open() {
  db = await new Promise((res, rej) => {
    const r = indexedDB.open('board228', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('els', { keyPath: 'id' }); d.createObjectStore('blobs'); d.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const t = db.transaction(['els', 'kv']);
  (await req(t.objectStore('els').getAll())).forEach(e => S.els.set(e.id, e));
  const keys = await req(t.objectStore('kv').getAllKeys()), vals = await req(t.objectStore('kv').getAll());
  keys.forEach((k, i) => (S.kv[k] = vals[i]));
  if (!S.els.has('home')) tx(() => add({ id: 'home', type: 'board', title: 'Start', board: null, loc: 'root', created: now(), modified: now() }), { undo: false });
}
export function kvSet(k, v) { S.kv[k] = v; db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); }
export const kv = (k, d) => (k in S.kv ? S.kv[k] : d);

function persist(after) {
  const st = db.transaction('els', 'readwrite').objectStore('els');
  for (const [id, el] of after) el ? st.put(el) : st.delete(id);
}
function emit(ids) { S.subs.forEach(f => f(ids)); }

export function tx(fn, { undo = true, merge = null } = {}) {
  if (cur) return fn();
  cur = { before: new Map() };
  let r;
  try { r = fn(); } finally {
    const t = cur; cur = null;
    if (t.before.size) {
      const after = new Map();
      for (const id of t.before.keys()) after.set(id, clone(S.els.get(id)) || null);
      persist(after);
      S.sync.forEach(f => f(after));
      if (undo) {
        const top = S.undo[S.undo.length - 1];
        if (merge && top && top.merge === merge) {
          for (const [id, b] of t.before) if (!top.before.has(id)) top.before.set(id, b);
          for (const [id, a] of after) top.after.set(id, a);
        } else { S.undo.push({ before: t.before, after, merge }); if (S.undo.length > 300) S.undo.shift(); }
        S.redo.length = 0;
      }
      emit([...t.before.keys()]);
    }
  }
  return r;
}
export function seal() { const t = S.undo[S.undo.length - 1]; if (t) t.merge = null; }
function touch(id) { if (!cur.before.has(id)) cur.before.set(id, clone(S.els.get(id)) || null); }
export function add(el) { return tx(() => { touch(el.id); el.created ??= now(); el.modified = now(); S.els.set(el.id, el); return el; }); }
export function set(id, patch) { return tx(() => { const e = S.els.get(id); if (!e) return; touch(id); Object.assign(e, patch, { modified: now() }); return e; }); }
export function del(id) { return tx(() => { if (!S.els.has(id)) return; touch(id); S.els.delete(id); }); }
export const get = id => S.els.get(id);

function apply(map) {
  for (const [id, el] of map) el ? S.els.set(id, clone(el)) : S.els.delete(id);
  persist(map); S.sync.forEach(f => f(map)); emit([...map.keys()]);
}
export function undo() { const t = S.undo.pop(); if (!t) return false; S.redo.push(t); apply(t.before); return true; }
export function redo() { const t = S.redo.pop(); if (!t) return false; S.undo.push(t); apply(t.after); return true; }
// Änderungen von außen (Sync) ohne Undo-Eintrag einspielen
export function applyRemote(map) { for (const [id, el] of map) el ? S.els.set(id, el) : S.els.delete(id); persist(map); emit([...map.keys()]); }

// Abfragen
export const all = () => [...S.els.values()];
export const kids = (board, loc = 'canvas') => all().filter(e => e.board === board && e.loc === loc && !e.col);
export const colKids = col => all().filter(e => e.col === col && e.loc !== 'trash').sort((a, b) => (a.ord || 0) - (b.ord || 0));
export const realBoard = el => (el && el.alias ? get(el.alias) : el);
export function path(id) { const p = []; let e = get(id), n = 0; while (e && n++ < 50) { p.unshift(e); e = get(e.board); } return p; }
export function descendants(boardId, out = []) {
  for (const e of all()) if (e.board === boardId) { out.push(e); if (e.type === 'board' && !e.alias) descendants(e.id, out); }
  return out;
}
export const maxZ = board => kids(board).reduce((m, e) => Math.max(m, e.z || 0), 0);

// Tiefes Duplizieren (Boards samt Inhalt), Verweise werden umgeschrieben
export function cloneEls(list, patch = {}) {
  const map = new Map(), out = [];
  const collect = e => { if (map.has(e.id)) return; map.set(e.id, uid()); out.push(e);
    if (e.type === 'board' && !e.alias) all().filter(c => c.board === e.id).forEach(collect);
    if (e.type === 'column') colKids(e.id).forEach(collect); };
  list.forEach(collect);
  const top = new Set(list.map(e => e.id));
  const res = out.map(e => {
    const c = clone(e); c.id = map.get(e.id); c.created = c.modified = now(); c.reactions = {};
    if (map.has(c.board)) c.board = map.get(c.board);
    if (c.col) c.col = map.get(c.col) || (top.has(e.id) ? c.col : null);
    if (c.pin) c.pin = map.get(c.pin) || null;
    if (c.type === 'line') for (const k of ['a', 'b']) if (c[k].el) { if (map.has(c[k].el)) c[k].el = map.get(c[k].el); else delete c[k].el; }
    if (top.has(e.id)) Object.assign(c, typeof patch === 'function' ? patch(c, e) : patch);
    return c;
  });
  res.tops = res.filter((c, i) => top.has(out[i].id));
  return res;
}

// Dateien
const urls = new Map();
export async function putBlob(blob) { const id = 'b' + uid(); await req(db.transaction('blobs', 'readwrite').objectStore('blobs').put(blob, id)); urls.set(id, URL.createObjectURL(blob)); return id; }
export const getBlob = id => req(db.transaction('blobs').objectStore('blobs').get(id));
export async function blobUrl(id) { if (!id) return ''; if (/^(https?:|data:|blob:)/.test(id)) return id; if (urls.has(id)) return urls.get(id); const b = await getBlob(id); if (!b) return ''; const u = URL.createObjectURL(b); urls.set(id, u); return u; }
export const blobUrlNow = id => (/^(https?:|data:|blob:)/.test(id || '') ? id : urls.get(id) || '');
export function delBlob(id) { if (id && id[0] === 'b') db.transaction('blobs', 'readwrite').objectStore('blobs').delete(id); }
export async function dump() {
  const blobs = {}; const st = db.transaction('blobs').objectStore('blobs');
  const keys = await req(st.getAllKeys());
  return { keys, els: all(), kv: S.kv };
}
