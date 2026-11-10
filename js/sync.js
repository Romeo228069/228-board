// Stufe 2: Konten, Abgleich zwischen Geräten, Teilen mit Rollen, Echtzeit (Firebase)
import { firebaseConfig } from './config.js';
import { A, $, h, ico, esc, debounce, fmtDate } from './util.js';
import { S, tx, set, get, add, del, all, kv, kvSet, uid, now, applyRemote, getBlob, putBlobAs, descendants, colKids } from './store.js';

const VER = '10.12.2', U = `https://www.gstatic.com/firebasejs/${VER}/`;
export const Y = { on: false, user: null, spaces: new Map(), idx: new Map(), rx: new Map(), peers: [], act: new Map() };
let fa, fs, auth, db, queue = new Map(), flushT, presUnsub, presSid, inboxUnsub, listUnsubs = [];
const me = () => Y.user && !Y.user.isAnonymous ? Y.user : null;
const email = () => (me()?.email || '').toLowerCase();
const sdoc = sid => fs.doc(db, 'spaces', sid);
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const BLOB_KEYS = ['src', 'blob', 'thumb', 'orig', 'img'];

export function spaceOf(el) { let e = el, n = 0; while (e && n++ < 60) { if (e.space) return e.space; if (e.id === 'home') break; e = e.col && !e.board ? get(e.col) : get(e.board); } return me()?.uid || null; }
const roleIn = sid => { const sp = Y.spaces.get(sid)?.data; if (!sp || sid === me()?.uid) return 'edit'; if (sp.owner === Y.user?.uid || (email() && (sp.editors || []).includes(email()))) return 'edit'; return sp.comments && me() ? 'comment' : 'view'; };

export async function initSync() {
  if (!firebaseConfig) return;
  try {
    const [app, a, f] = await Promise.all([import(U + 'firebase-app.js'), import(U + 'firebase-auth.js'), import(U + 'firebase-firestore.js')]);
    fa = a; fs = f; const ap = app.initializeApp(firebaseConfig); auth = a.getAuth(ap);
    db = f.initializeFirestore(ap, { ignoreUndefinedProperties: true, localCache: f.persistentLocalCache({ tabManager: f.persistentMultipleTabManager() }) });
  } catch (e) { console.warn('Sync nicht verfügbar', e); return; }
  Y.on = true; S.sync.add(onLocal); S.blobFetch = fetchBlob;
  A.roleFor = id => { const b = get(id); const sid = b && spaceOf(b); return sid && sid !== me()?.uid ? roleIn(sid) : 'edit'; };
  A.rxOf = el => { const r = { ...(el.reactions || {}) }; (Y.rx.get(el.id) || []).forEach(x => x.emo.forEach(e => (r[e] = [...new Set([...(r[e] || []), x.name])]))); return r; };
  A.remoteRx = (id, emo) => { const sid = spaceOf(get(id)), ref = fs.doc(db, 'spaces', sid, 'rx', id + '_' + Y.user.uid), mine = (Y.rx.get(id) || []).find(x => x.uid === Y.user.uid), s = new Set(mine?.emo || []); s.has(emo) ? s.delete(emo) : s.add(emo); s.size ? fs.setDoc(ref, { el: id, uid: Y.user.uid, name: A.me(), emo: [...s] }) : fs.deleteDoc(ref); };
  A.activity = id => Y.act.get(id) || null;
  A.spaceInfo = id => Y.spaces.get(id)?.data;
  A.account = accountDialog; A.share = shareDialog; A.openRemote = openRemote;
  A.topExtra = () => [Y.peers.length ? h('span.peers', Y.peers.slice(0, 5).map(p => h('i.av', { title: p.name, style: { background: p.color } }, (p.name || '?')[0].toUpperCase()))) : null,
    h('button.ib.acct', { title: me() ? 'Konto: ' + me().email : 'Anmelden', 'aria-label': 'Konto', onclick: accountDialog }, me() ? h('i.av', { style: { background: A.avatarColor(A.me()) } }, A.me()[0].toUpperCase()) : ico('user'))];
  A.paintPeers = paintPeers;
  const people0 = A.people; A.people = () => { const sp = Y.spaces.get(spaceOf(get(A.board)))?.data; return [...new Set([...people0(), ...Object.values(sp?.names || {})])]; };
  const notify0 = A.notify; A.notify = (text, to, elId) => { notify0(text, to, elId); const sid = spaceOf(get(A.board)), sp = Y.spaces.get(sid)?.data; if (!me() || !sp) return; const targets = to ? Object.entries(sp.names || {}).filter(([, n]) => n === to).map(([e]) => e.replace(/․/g, '.')) : [...new Set([...(sp.editors || []), sp.ownerEmail])].filter(Boolean); targets.filter(e => e !== email()).forEach(e => fs.addDoc(fs.collection(db, 'inbox', e, 'items'), { text, ts: now(), board: A.board, el: elId || null, sid, from: A.me() }).catch(() => {})); };
  const onBoard0 = A.onBoard; A.onBoard = b => { onBoard0?.(b); watchPresence(); b && [...Y.act.keys()].forEach(k => get(k)?.board === b.id && 0); };
  fa.onAuthStateChanged(auth, onUser);
  addEventListener('pagehide', () => { flush(); if (presSid && Y.user) fs.deleteDoc(fs.doc(db, 'spaces', presSid, 'presence', Y.user.uid)).catch(() => {}); });
  setInterval(() => { sendPresence(); const t = now() - 70e3; const n = Y.peers.length; Y.peers = Y.peers.filter(p => p.ts > t); if (n !== Y.peers.length) A.render(); }, 25e3);
}

/* ---------- Anmeldung ---------- */
async function onUser(u) {
  Y.user = u; listUnsubs.forEach(f => f()); listUnsubs = []; inboxUnsub?.(); inboxUnsub = null;
  for (const [sid, s] of Y.spaces) if (!s.link) { s.unsub?.(); s.unsubRx?.(); Y.spaces.delete(sid); }
  if (me()) {
    const u_ = me(), nm = kv('me') && kv('me') !== 'Ich' ? kv('me') : u_.displayName || u_.email.split('@')[0]; kvSet('me', nm);
    fs.setDoc(fs.doc(db, 'users', u_.uid), { name: nm, email: email() }, { merge: true }).catch(() => {});
    const own = sdoc(u_.uid); try { const d = await fs.getDoc(own); if (!d.exists()) await fs.setDoc(own, { owner: u_.uid, ownerEmail: email(), personal: true, editors: [], names: {} }); } catch (e) { console.warn(e); }
    attach(u_.uid, { owner: u_.uid, personal: true });
    const watch = q => listUnsubs.push(fs.onSnapshot(q, snap => snap.docChanges().forEach(c => { const sid = c.doc.id; if (sid === u_.uid) return; if (c.type === 'removed') return detach(sid); const s = Y.spaces.get(sid); if (s) { s.data = c.doc.data(); A.render(); } else attach(sid, c.doc.data()); }), e => console.warn('Liste', e)));
    watch(fs.query(fs.collection(db, 'spaces'), fs.where('owner', '==', u_.uid)));
    watch(fs.query(fs.collection(db, 'spaces'), fs.where('editors', 'array-contains', email())));
    inboxUnsub = fs.onSnapshot(fs.collection(db, 'inbox', email(), 'items'), snap => { const list = kv('notifs', []); let n = 0; snap.docChanges().forEach(c => { if (c.type !== 'added' || list.some(x => x.id === c.doc.id)) return; const d = c.doc.data(); list.unshift({ id: c.doc.id, text: d.text, ts: d.ts, board: d.board, el: d.el, read: false }); n++; if (d.ts > now() - 60e3) { A.toast(d.text); if (window.Notification?.permission === 'granted') new Notification('228 Board', { body: d.text }); } }); if (n) { kvSet('notifs', list.sort((a, b) => b.ts - a.ts).slice(0, 100)); A.render(); } }, () => {});
  }
  A.role = A.roleFor(A.board); A.render();
}
function detach(sid) { const s = Y.spaces.get(sid); if (!s) return; s.unsub?.(); s.unsubRx?.(); Y.spaces.delete(sid); const ids = all().filter(e => Y.idx.get(e.id) === sid).map(e => e.id); if (ids.length) { applyRemote(new Map(ids.map(i => [i, null]))); ids.forEach(i => Y.idx.delete(i)); } if (get(A.board) == null) A.openBoard('home'); }
function attach(sid, data, link) {
  if (Y.spaces.has(sid)) { Y.spaces.get(sid).data = data; return Y.spaces.get(sid).ready; }
  const s = { data, link, first: true }; Y.spaces.set(sid, s);
  s.ready = new Promise(res => {
    s.unsub = fs.onSnapshot(fs.collection(db, 'spaces', sid, 'els'), { includeMetadataChanges: false }, snap => {
      const map = new Map(), seen = new Set();
      snap.docChanges().forEach(c => { const id = c.doc.id; if (c.doc.metadata.hasPendingWrites) return;
        if (c.type === 'removed') { if (Y.idx.get(id) === sid && get(id)) { map.set(id, null); Y.idx.delete(id); } return; }
        const d = c.doc.data(); let el; try { el = JSON.parse(d.j); } catch { return; } const loc = get(id); Y.idx.set(id, sid);
        if (loc && (loc.modified || 0) >= (el.modified || 0)) return; map.set(id, el);
        if (!s.first && d.by !== Y.user?.uid && el.board === A.board) Y.act.set(id, `${d.name || 'Jemand'} hat das geändert`); });
      if (s.first) { s.first = false; snap.docs.forEach(d => seen.add(d.id)); const last = kv('synced:' + sid, 0);
        if (roleIn(sid) === 'edit') all().forEach(e => { if (seen.has(e.id) || spaceOf(e) !== sid) return; if (last && (e.modified || 0) < last && Y.idx.get(e.id) !== sid && !snap.metadata.fromCache) map.set(e.id, null); else enqueue(sid, e.id, e); });
        kvSet('synced:' + sid, now()); res(); landAlias(sid); }
      if (map.size) { applyRemote(map); if (get(A.board) == null) A.openBoard('home'); }
    }, e => { console.warn('Bereich', sid, e.code); res(); if (e.code === 'permission-denied' && sid !== me()?.uid) { Y.spaces.delete(sid); A.toast('Kein Zugriff auf dieses Board'); } });
    s.unsubRx = fs.onSnapshot(fs.collection(db, 'spaces', sid, 'rx'), snap => { for (const [k, v] of Y.rx) Y.rx.set(k, v.filter(x => x.sid !== sid)); snap.docs.forEach(d => { const x = { ...d.data(), sid }; Y.rx.set(x.el, [...(Y.rx.get(x.el) || []), x]); }); $('#cards').innerHTML = ''; A.render(); }, () => {});
  });
  return s.ready;
}
// Geteiltes Board als Verknüpfung auf dem Startboard ablegen
function landAlias(sid) { const u = me(); if (!u || sid === u.uid || !get(sid)) return; if (all().some(e => e.alias === sid && e.loc !== 'trash')) return; const sp = Y.spaces.get(sid)?.data; if (!sp) return; const mine = sp.owner === u.uid;
  tx(() => add({ id: uid(), type: 'board', alias: sid, board: 'home', loc: mine ? 'canvas' : 'unsorted', x: 80, y: 80, z: 99 }), { undo: false }); if (!mine) { A.toast(`„${get(sid).title || 'Board'}“ wurde mit dir geteilt`, 'Öffnen', () => A.openBoard(sid)); } }

/* ---------- Lokale Änderungen hochladen ---------- */
function enqueue(sid, id, el) { if (!sid) return; queue.set(sid + '/' + id, { sid, id, el }); clearTimeout(flushT); flushT = setTimeout(flush, 900); }
function onLocal(after) {
  if (!Y.user) return;
  const work = new Map(after);
  for (const [id, el] of after) if (el && (el.type === 'board' || el.type === 'column') && Y.idx.has(id) && Y.idx.get(id) !== spaceOf(el)) (el.type === 'board' ? descendants(id) : colKids(id)).forEach(d => work.has(d.id) || work.set(d.id, d));
  for (const [id, el] of work) { const old = Y.idx.get(id);
    if (!el) { if (old) { enqueue(old, id, null); Y.idx.delete(id); } continue; }
    const sid = spaceOf(el); if (!sid) continue; if (old && old !== sid) enqueue(old, id, null); enqueue(sid, id, el); Y.idx.set(id, sid); Y.act.delete(id); }
}
async function flush() {
  if (!queue.size || !Y.user) return; const items = [...queue.values()]; queue = new Map();
  for (let i = 0; i < items.length; i += 300) { const b = fs.writeBatch(db);
    for (const { sid, id, el } of items.slice(i, i + 300)) { const ref = fs.doc(db, 'spaces', sid, 'els', id); if (!el) b.delete(ref); else { b.set(ref, { j: JSON.stringify(el), m: el.modified || 0, t: el.type, by: Y.user.uid, name: A.me() }); pushBlobs(sid, el); } }
    b.commit().catch(e => { console.warn('Schreiben abgelehnt', e.code); if (e.code === 'permission-denied') A.toast('Diese Änderung darfst du hier nicht speichern'); }); }
}
async function pushBlobs(sid, el) { const done = kv('upl', {});
  for (const k of BLOB_KEYS) { const id = el[k]; if (!id || id[0] !== 'b' || /^(blob|data):/.test(id) || done[sid + id]) continue; done[sid + id] = 1; kvSet('upl', done);
    try { const blob = await getBlob(id); if (!blob) continue; if (blob.size > 15e6) { A.toast('Dateien über 15 MB bleiben nur auf diesem Gerät'); continue; }
      const buf = new Uint8Array(await blob.arrayBuffer()), CH = 700e3, n = Math.ceil(buf.length / CH) || 1;
      for (let i = 0; i < n; i++) await fs.setDoc(fs.doc(db, 'spaces', sid, 'blobs', id, 'chunks', String(i)), { d: fs.Bytes.fromUint8Array(buf.subarray(i * CH, (i + 1) * CH)) });
      await fs.setDoc(fs.doc(db, 'spaces', sid, 'blobs', id), { type: blob.type, size: blob.size, n });
    } catch (e) { console.warn('Datei', e); delete done[sid + id]; kvSet('upl', done); } }
}
async function fetchBlob(id) {
  for (const sid of Y.spaces.keys()) { try { const m = await fs.getDoc(fs.doc(db, 'spaces', sid, 'blobs', id)); if (!m.exists()) continue; const { type, n } = m.data(), parts = [];
      for (let i = 0; i < n; i++) parts.push((await fs.getDoc(fs.doc(db, 'spaces', sid, 'blobs', id, 'chunks', String(i)))).data().d.toUint8Array());
      const blob = new Blob(parts, { type }); await putBlobAs(id, blob); const done = kv('upl', {}); done[sid + id] = 1; kvSet('upl', done); return blob; } catch {} }
  return null;
}

/* ---------- Präsenz ---------- */
function watchPresence() { const b = get(A.board), sid = b && spaceOf(b); A.role = A.roleFor(A.board);
  if (sid === presSid) return sendPresence(); presUnsub?.(); presUnsub = null; if (presSid && Y.user) fs.deleteDoc(fs.doc(db, 'spaces', presSid, 'presence', Y.user.uid)).catch(() => {}); presSid = null; Y.peers = [];
  if (!sid || !Y.user || sid === me()?.uid || !Y.spaces.has(sid)) return; presSid = sid;
  presUnsub = fs.onSnapshot(fs.collection(db, 'spaces', sid, 'presence'), snap => { Y.peers = snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(p => p.uid !== Y.user.uid && p.ts > now() - 70e3); A.render(); }, () => {});
  sendPresence(); fs.setDoc(fs.doc(db, 'spaces', sid, 'views', Y.user.uid), { ts: now(), anon: !me() }).catch(() => {}); }
const sendPresence = debounce(() => { if (!presSid || !Y.user) return; fs.setDoc(fs.doc(db, 'spaces', presSid, 'presence', Y.user.uid), { name: me() ? A.me() : 'Gast', color: A.avatarColor(me() ? A.me() : Y.user.uid), board: A.board, sel: [...A.sel].slice(0, 20), ts: now() }).catch(() => {}); }, 600);
let lastSel = '';
function paintPeers() { document.querySelectorAll('.peer').forEach(n => { n.classList.remove('peer'); n.style.removeProperty('--peer'); n.removeAttribute('data-peer'); });
  Y.peers.filter(p => p.board === A.board).forEach(p => (p.sel || []).forEach(id => { const n = A.node(id); if (n) { n.classList.add('peer'); n.style.setProperty('--peer', p.color); n.dataset.peer = p.name; } }));
  const s = A.board + [...A.sel].join(); if (s !== lastSel) { lastSel = s; sendPresence(); A.sel.forEach(id => Y.act.delete(id)); } }

/* ---------- Geteilte Links öffnen ---------- */
async function openRemote(hash) {
  const m = /#\/(b|v|j)\/([\w-]+)(?:\/([\w-]+))?/.exec(hash); if (!m) return false; const [, kind, sid, token] = m;
  if (!Y.user) { if (kind === 'j') { A.toast('Bitte zuerst anmelden, um die Einladung anzunehmen'); accountDialog(); return false; } try { await fa.signInAnonymously(auth); } catch (e) { A.toast('Zum Ansehen bitte anmelden'); accountDialog(); return false; } }
  let sp; try { sp = (await fs.getDoc(sdoc(sid))).data(); } catch { } if (!sp) { A.toast('Dieses Board gibt es nicht oder es ist nicht freigegeben'); return false; }
  const member = sp.owner === Y.user.uid || (email() && (sp.editors || []).includes(email()));
  if (kind === 'j' && !member) { if (!me()) { A.toast('Bitte zuerst anmelden, um die Einladung anzunehmen'); accountDialog(); return false; }
    try { await fs.setDoc(fs.doc(db, 'spaces', sid, 'join', Y.user.uid), { t: token }); await fs.updateDoc(sdoc(sid), { editors: fs.arrayUnion(email()), ['names.' + email().replace(/\./g, '․')]: A.me() }); sp = (await fs.getDoc(sdoc(sid))).data(); } catch (e) { A.toast('Dieser Einladungslink ist nicht mehr gültig'); return false; } }
  else if (!member) { if (!sp.view) { A.toast('Dieses Board ist nicht freigegeben'); return false; }
    if (sp.pw) { const ok = await new Promise(res => A.prompt('Passwort für dieses Board', '', async v => { if (!v) return res(false); try { await fs.setDoc(fs.doc(db, 'spaces', sid, 'pass', Y.user.uid), { h: await sha(v + sid) }); res(true); } catch { A.toast('Das Passwort stimmt nicht'); res(false); } }, { type: 'password', ok: 'Öffnen' })); if (!ok) return false; } }
  await attach(sid, sp, !member); if (!get(sid)) { A.toast('Das Board konnte nicht geladen werden'); return false; }
  A.openBoard(sid); if (!member && sp.welcome) A.toast(sp.welcome);
  if (!member && me()) A.toast('Geteiltes Board', 'Auf Start sichern', () => { landAliasForce(sid); });
  return true;
}
function landAliasForce(sid) { if (!all().some(e => e.alias === sid && e.loc !== 'trash')) tx(() => add({ id: uid(), type: 'board', alias: sid, board: 'home', loc: 'unsorted', x: 80, y: 80, z: 99 }), { undo: false }); A.toast('Liegt jetzt in der Ablage deines Startboards'); }

/* ---------- Dialoge ---------- */
function accountDialog() {
  const u = me(), msg = h('p.warn.small');
  const err = e => (msg.textContent = { 'auth/invalid-credential': 'E-Mail oder Passwort stimmen nicht.', 'auth/email-already-in-use': 'Für diese E-Mail gibt es schon ein Konto.', 'auth/weak-password': 'Das Passwort braucht mindestens 6 Zeichen.', 'auth/invalid-email': 'Diese E-Mail-Adresse ist ungültig.', 'auth/popup-closed-by-user': '', 'auth/unauthorized-domain': 'Diese Adresse ist für die Anmeldung noch nicht freigegeben.' }[e.code] ?? 'Das hat nicht geklappt (' + (e.code || e.message) + ').');
  if (u) return A.modal('Konto', h('div.settings', h('div.setrow', h('span', h('b', A.me()), h('small', u.email + (u.emailVerified ? ' · bestätigt' : ' · noch nicht bestätigt'))), h('i.av.big', { style: { background: A.avatarColor(A.me()) } }, A.me()[0].toUpperCase())),
    h('label.setrow', h('span', 'Anzeigename'), h('input.field', { value: A.me(), onkeydown: e => e.stopPropagation(), onchange: e => { const v = e.target.value.trim(); if (!v) return; kvSet('me', v); fa.updateProfile(u, { displayName: v }); fs.setDoc(fs.doc(db, 'users', u.uid), { name: v }, { merge: true }); A.render(); } })),
    u.emailVerified ? null : h('div.setrow', h('span', 'E-Mail bestätigen', h('small', 'Du bekommst einen Link per E-Mail')), h('button.btn', { onclick: async e => { await fa.sendEmailVerification(u).catch(err); e.target.textContent = 'Gesendet'; } }, 'Link senden')),
    h('p.mut.small', 'Deine Boards werden mit diesem Konto abgeglichen und sind auf allen Geräten verfügbar, auf denen du dich anmeldest.'), msg,
    h('div.row.end', h('button.btn', { onclick: async () => { await flush(); await fa.signOut(auth); A.closeModal(); A.toast('Abgemeldet – deine Inhalte bleiben auf diesem Gerät'); } }, 'Abmelden'))), { cls: 'small wide' });
  const em = h('input.field', { type: 'email', placeholder: 'E-Mail', autocomplete: 'email' }), pw = h('input.field', { type: 'password', placeholder: 'Passwort', autocomplete: 'current-password' });
  [em, pw].forEach(i => i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') go(false); }));
  const done = () => { A.closeModal(); A.toast('Angemeldet – deine Boards werden abgeglichen'); if (/#\/(j|v)\//.test(location.hash)) openRemote(location.hash); };
  const go = async reg => { msg.textContent = ''; try { await (reg ? fa.createUserWithEmailAndPassword : fa.signInWithEmailAndPassword)(auth, em.value.trim(), pw.value); if (reg) fa.sendEmailVerification(auth.currentUser).catch(() => {}); done(); } catch (e) { err(e); } };
  A.modal('Anmelden', h('div.settings', h('p', 'Mit einem Konto liegen deine Boards auf allen Geräten, und du kannst sie mit anderen teilen und gemeinsam bearbeiten.'), em, pw, msg,
    h('div.row.wrap', h('button.btn.primary', { onclick: () => go(false) }, 'Anmelden'), h('button.btn', { onclick: () => go(true) }, 'Konto anlegen'), h('button.btn', { onclick: async () => { try { await fa.signInWithPopup(auth, new fa.GoogleAuthProvider()); done(); } catch (e) { err(e); } } }, 'Mit Google anmelden')),
    h('button.link', { onclick: async () => { if (!em.value) return (msg.textContent = 'Bitte zuerst die E-Mail eintragen.'); try { await fa.sendPasswordResetEmail(auth, em.value.trim()); msg.textContent = 'E-Mail zum Zurücksetzen ist unterwegs.'; } catch (e) { err(e); } } }, 'Passwort vergessen?'),
    h('p.mut.small', 'Ohne Konto bleibt alles wie bisher nur auf diesem Gerät.')), { cls: 'small wide' });
}
async function shareBoard(id) { // Board in einen eigenen, teilbaren Bereich legen
  const b = get(id), u = me(); await fs.setDoc(sdoc(id), { owner: u.uid, ownerEmail: email(), editors: [], names: { [email().replace(/\./g, '․')]: A.me() }, view: false, comments: true, pw: false, downloads: true, title: b.title || '' });
  await fs.setDoc(fs.doc(db, 'spaces', id, 'private', 'cfg'), { editToken: null, pwHash: null });
  Y.spaces.set(id, { data: (await fs.getDoc(sdoc(id))).data(), first: false, ready: Promise.resolve() }); const s = Y.spaces.get(id);
  tx(() => { add({ id: uid(), type: 'board', alias: id, board: b.board, loc: b.loc, col: b.col || null, ord: b.ord, x: b.x, y: b.y, z: b.z }); set(id, { space: id, board: null, loc: 'root', col: null }); }, { undo: false });
  await flush(); Y.spaces.delete(id); attach(id, s.data);
}
async function shareDialog() {
  if (!me()) { A.toast('Zum Teilen bitte anmelden'); return accountDialog(); }
  const b = get(A.board), sid = spaceOf(b), root = sid !== me().uid ? get(sid) : null;
  if (!root) return A.modal('Board teilen', h('div.sharem', h('p', `„${b.title || 'Board'}“ samt Unterboards für andere freigeben. Danach kannst du Personen einladen und Links erstellen.`), h('div.row.end', h('button.btn.primary', { onclick: async e => { e.target.disabled = true; e.target.textContent = 'Wird eingerichtet …'; try { await shareBoard(b.id); shareDialog(); } catch (er) { console.warn(er); A.toast('Freigabe fehlgeschlagen: ' + (er.code || er.message)); A.closeModal(); } } }, 'Freigabe einrichten'))), { cls: 'small wide' });
  let sp = (await fs.getDoc(sdoc(sid))).data(); const owner = sp.owner === me().uid, base = location.origin + location.pathname, nameOf = e => sp.names?.[e.replace(/\./g, '․')] || e;
  let priv = owner ? (await fs.getDoc(fs.doc(db, 'spaces', sid, 'private', 'cfg'))).data() || {} : {}, views = 0; if (owner) try { views = (await fs.getCountFromServer(fs.collection(db, 'spaces', sid, 'views'))).data().count; } catch {}
  const upd = async (patch, p2) => { await fs.updateDoc(sdoc(sid), patch); if (p2) await fs.setDoc(fs.doc(db, 'spaces', sid, 'private', 'cfg'), p2, { merge: true }); shareDialog(); };
  const copy = (t, l = 'Link kopiert') => { navigator.clipboard?.writeText(t); A.toast(l); };
  const inv = h('input.field', { placeholder: 'E-Mail-Adressen, mit Komma getrennt', onkeydown: e => { e.stopPropagation(); if (e.key === 'Enter') invite(); } });
  const invite = async () => { const list = inv.value.split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(x => /.+@.+\..+/.test(x)); if (!list.length) return; await fs.updateDoc(sdoc(sid), { editors: fs.arrayUnion(...list) }); list.forEach(e => fs.addDoc(fs.collection(db, 'inbox', e, 'items'), { text: `${A.me()} hat „${root.title || 'Board'}“ mit dir geteilt`, ts: now(), board: sid, sid, from: A.me() }).catch(() => {}));
    A.toast('Eingeladen', 'E-Mail schreiben', () => window.open(`mailto:${list.join(',')}?subject=${encodeURIComponent('Einladung zu ' + (root.title || 'einem Board'))}&body=${encodeURIComponent(`Ich habe ein Board mit dir geteilt. Melde dich mit dieser E-Mail-Adresse an:\n${base}#/b/${sid}`)}`)); shareDialog(); };
  const viewUrl = `${base}#/v/${sid}`, tog = (label, key, hint) => h('label.setrow', h('span', label, hint ? h('small', hint) : null), h('input.switch', { type: 'checkbox', checked: sp[key] || null, disabled: !owner || null, onchange: e => upd({ [key]: e.target.checked }) }));
  A.modal('Board teilen', h('div.sharem',
    root.id !== b.id ? h('p.mut.small', `Die Freigabe gilt für „${root.title || 'Board'}“ und alle Unterboards.`) : null,
    h('div.sharebox', h('b', 'Personen zum Bearbeiten einladen'), h('div.row', inv, h('button.btn.primary', { onclick: invite }, 'Einladen')),
      h('div.plist', h('div.prow', h('i.av', { style: { background: A.avatarColor(nameOf(sp.ownerEmail)) } }, nameOf(sp.ownerEmail)[0].toUpperCase()), h('span.grow', nameOf(sp.ownerEmail), h('small', ' ' + sp.ownerEmail)), h('span.mut.small', 'Besitzer')),
        (sp.editors || []).map(e => h('div.prow', h('i.av', { style: { background: A.avatarColor(nameOf(e)) } }, nameOf(e)[0].toUpperCase()), h('span.grow', nameOf(e), nameOf(e) !== e ? h('small', ' ' + e) : null),
          owner ? h('button.link', { onclick: async () => { const usr = await fs.getDocs(fs.query(fs.collection(db, 'users'), fs.where('email', '==', e))); if (usr.empty) return A.toast('Diese Person hat sich noch nicht angemeldet'); A.confirm(`${nameOf(e)} zum Besitzer machen?`, 'Übertragen', () => upd({ owner: usr.docs[0].id, ownerEmail: e, editors: [...sp.editors.filter(x => x !== e), sp.ownerEmail] })); } }, 'Zum Besitzer machen') : null,
          owner || e === email() ? h('button.link.dangerl', { onclick: () => upd({ editors: fs.arrayRemove(e) }) }, 'Entfernen') : null)))),
    owner ? h('div.sharebox', h('label.setrow', h('span', h('b', 'Einladungslink zum Bearbeiten'), h('small', 'Wer den Link hat und angemeldet ist, kann mitarbeiten')), h('input.switch', { type: 'checkbox', checked: priv.editToken || null, onchange: e => upd({ editLink: e.target.checked }, { editToken: e.target.checked ? uid() + uid() : null }) })),
      priv.editToken ? h('div.row', h('input.field', { readonly: true, value: `${base}#/j/${sid}/${priv.editToken}`, onclick: e => e.target.select() }), h('button.btn', { onclick: () => copy(`${base}#/j/${sid}/${priv.editToken}`) }, 'Kopieren')) : null) : null,
    h('div.sharebox', tog(h('b', 'Link nur zum Ansehen'), 'view', views ? `${views} ${views === 1 ? 'Person hat' : 'Personen haben'} dieses Board geöffnet` : 'Ohne Konto sichtbar, aufgeräumte Ansicht ohne Werkzeuge'),
      sp.view ? [h('div.row', h('input.field', { readonly: true, value: viewUrl, onclick: e => e.target.select() }), h('button.btn', { onclick: () => copy(viewUrl) }, 'Kopieren')),
        tog('Kommentare, Reaktionen und Zeichnen erlauben', 'comments', 'Dafür ist ein Konto nötig'), tog('Download von Bildern und Dateien erlauben', 'downloads'),
        owner ? h('label.setrow', h('span', 'Passwort', h('small', sp.pw ? 'Aktiv – neues Passwort eintragen oder leeren und bestätigen' : 'Optional')), h('input.field', { type: 'text', placeholder: sp.pw ? '••••••' : 'Kein Passwort', onkeydown: e => e.stopPropagation(), onchange: async e => { const v = e.target.value.trim(); upd({ pw: !!v }, { pwHash: v ? await sha(v + sid) : null }); } })) : null,
        owner ? h('label.setrow', h('span', 'Begrüßung'), h('input.field', { value: sp.welcome || '', placeholder: 'Kurzer Text für Besucher', onkeydown: e => e.stopPropagation(), onchange: e => upd({ welcome: e.target.value.trim() }) })) : null,
        h('div.row', h('button.btn', { onclick: () => copy(`<iframe src="${viewUrl}" width="100%" height="600" style="border:0;border-radius:12px" allowfullscreen></iframe>`, 'Einbettcode kopiert') }, ico('code', 16), 'Einbettcode kopieren'))] : null),
    owner ? h('div.row.end', h('button.btn', { onclick: () => A.confirm('Freigabe für alle beenden? Links werden ungültig.', 'Beenden', () => upd({ editors: [], view: false, editLink: false }, { editToken: null })) }, 'Freigabe für alle beenden')) : null), { cls: 'small wide' });
}
