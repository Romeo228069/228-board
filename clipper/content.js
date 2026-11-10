// Zeigt beim Überfahren größerer Bilder einen Speichern-Knopf, optional ein Symbol neben markiertem Text
(() => {
  if (window.__b228) return; window.__b228 = 1;
  const mk = (txt) => { const b = document.createElement('button'); b.textContent = txt; b.style.cssText = 'position:fixed;z-index:2147483647;display:none;font:600 12px -apple-system,Helvetica,Arial,sans-serif;padding:6px 10px;border:0;border-radius:8px;background:#0a84ff;color:#fff;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.3)'; document.documentElement.appendChild(b); return b; };
  const btn = mk('In 228 Board'), sel = mk('In 228 Board'); let cur = null, hideT, showSel = false;
  chrome.storage.sync.get('selIcon', v => (showSel = !!v.selIcon));
  const send = clip => chrome.runtime.sendMessage({ clip });
  document.addEventListener('mouseover', e => { const im = e.target; if (im === btn) return clearTimeout(hideT); if (!(im instanceof HTMLImageElement) || im.width < 120 || im.height < 90) return; clearTimeout(hideT); cur = im; const r = im.getBoundingClientRect(); btn.style.left = Math.max(4, r.left + 8) + 'px'; btn.style.top = Math.max(4, r.top + 8) + 'px'; btn.style.display = 'block'; }, true);
  document.addEventListener('mouseout', e => { if (e.target === cur || e.target === btn) hideT = setTimeout(() => (btn.style.display = 'none'), 250); }, true);
  btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (cur) send({ img: cur.currentSrc || cur.src, src: location.href, title: document.title }); btn.style.display = 'none'; });
  document.addEventListener('mouseup', e => { if (e.target === sel) return; setTimeout(() => { const s = getSelection(), t = s && s.toString().trim(); if (!showSel || !t || t.length < 3) return (sel.style.display = 'none'); const r = s.getRangeAt(0).getBoundingClientRect(); sel.style.left = Math.min(innerWidth - 110, r.right + 6) + 'px'; sel.style.top = Math.max(4, r.top - 4) + 'px'; sel.style.display = 'block'; }, 10); });
  sel.addEventListener('click', e => { e.preventDefault(); send({ text: getSelection().toString(), src: location.href, title: document.title }); sel.style.display = 'none'; });
})();
