// Texteditor: Formatierung, Markdown-Kürzel, Erwähnungen
import { h, A, mod, isUrl, fixUrl, hexNorm, $ } from './util.js';

const cmd = (c, v = null) => document.execCommand(c, false, v);
export const blockOf = () => { let n = getSelection().anchorNode; while (n && n.nodeType !== 1) n = n.parentNode; return n?.closest?.('h1,h2,h5,h6,p,pre,blockquote,li,div'); };

export const FMT = {
  h1: () => cmd('formatBlock', 'h1'), h2: () => cmd('formatBlock', 'h2'), p: () => cmd('formatBlock', 'p'), small: () => cmd('formatBlock', 'h6'),
  callout: () => cmd('formatBlock', 'h5'), pre: () => cmd('formatBlock', 'pre'), quote: () => cmd('formatBlock', 'blockquote'),
  bold: () => cmd('bold'), italic: () => cmd('italic'), under: () => cmd('underline'), strike: () => cmd('strikeThrough'),
  ul: () => { cmd('insertUnorderedList'); listOf()?.classList.remove('chk'); }, ol: () => cmd('insertOrderedList'),
  chk: () => { if (!listOf() || listOf().tagName !== 'UL') cmd('insertUnorderedList'); listOf()?.classList.toggle('chk', true); },
  center: () => { const b = blockOf(); cmd(b && b.style.textAlign === 'center' ? 'justifyLeft' : 'justifyCenter'); },
  indent: () => cmd('indent'), outdent: () => cmd('outdent'), hr: () => cmd('insertHorizontalRule'),
  color: c => cmd('foreColor', c || 'inherit'), mark: c => { cmd('styleWithCSS', true); cmd('hiliteColor', c || 'transparent'); cmd('styleWithCSS', false); },
  code: () => { const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return; const el = s.anchorNode.parentElement.closest('code'); if (el) { el.replaceWith(...el.childNodes); return; } const r = s.getRangeAt(0), c = document.createElement('code'); try { r.surroundContents(c); } catch { c.append(r.extractContents()); r.insertNode(c); } },
  link: () => { const s = getSelection(); const a = s.anchorNode?.parentElement?.closest('a'); if (a) { cmd('unlink'); return; } const r = s.rangeCount && s.getRangeAt(0).cloneRange(); A.prompt('Link-Adresse', '', url => { if (!url) return; A.editing?.focus(); s.removeAllRanges(); s.addRange(r); if (s.isCollapsed) cmd('insertHTML', `<a href="${fixUrl(url)}">${url}</a>`); else cmd('createLink', fixUrl(url)); }); },
};
const listOf = () => { let n = getSelection().anchorNode; while (n && n.nodeType !== 1) n = n.parentNode; return n?.closest?.('ul,ol'); };

export function richKey(e, node) {
  const k = e.key.toLowerCase();
  if (mod(e)) {
    const map = e.shiftKey ? { '1': 'h1', '2': 'h2', '0': 'p', '9': 'small', u: 'ul', o: 'ol', x: 'strike', '.': 'pre', '>': 'pre', "'": 'quote', '"': 'quote' } : { b: 'bold', i: 'italic', u: 'under', k: 'link', j: 'mark', '\\': 'center' };
    let f = map[k]; if (!f && e.shiftKey) f = { Digit1: 'h1', Digit2: 'h2', Digit0: 'p', Digit9: 'small' }[e.code];
    if (f) { e.preventDefault(); f === 'mark' ? FMT.mark(marked() ? '' : '#ffe066') : FMT[f](); return true; }
  }
  if (e.key === 'Tab') { e.preventDefault(); if (listOf()) FMT[e.shiftKey ? 'outdent' : 'indent'](); else if (!e.shiftKey) cmd('insertText', '\t'); return true; }
  if (e.key === ' ' && !e.shiftKey) return markdown(e);
  if (e.key === 'Enter' && !e.shiftKey) { const b = blockOf(); const t = b?.textContent; if (t === '---') { e.preventDefault(); b.textContent = ''; FMT.hr(); return true; } }
  if (e.key === 'Backspace') { const s = getSelection(); const b = blockOf(); if (b && s.isCollapsed && s.anchorOffset === 0 && /^(H1|H2|H5|H6|BLOCKQUOTE|PRE)$/.test(b.tagName) && isStart(b)) { e.preventDefault(); cmd('formatBlock', 'p'); return true; } }
  if (e.key === '@') setTimeout(() => mention(node), 0);
  return false;
}
const marked = () => { const n = getSelection().anchorNode?.parentElement; return n && n.closest('[style*="background"]'); };
function isStart(b) { const s = getSelection(), r = document.createRange(); r.selectNodeContents(b); r.setEnd(s.anchorNode, s.anchorOffset); return r.toString() === ''; }
function markdown(e) {
  const s = getSelection(); if (!s.isCollapsed) return false; const b = blockOf(); if (!b) return false;
  const r = document.createRange(); r.selectNodeContents(b); r.setEnd(s.anchorNode, s.anchorOffset); const pre = r.toString();
  const f = { '#': 'h1', '##': 'h2', '.': 'ul', '-': 'ul', '*': 'ul', '1.': 'ol', '[ ]': 'chk', '[]': 'chk', '>': 'quote' }[pre];
  if (!f || (b.tagName === 'LI' && f !== 'chk')) return false;
  e.preventDefault(); r.deleteContents(); FMT[f](); return true;
}
export function toggleCheck(e) { const li = e.target.closest('ul.chk > li'); if (!li) return false; const r = li.getBoundingClientRect(); if (e.clientX - r.left > 0) return false; li.toggleAttribute('data-done'); return true; }

// @Erwähnung
function mention(node) {
  const people = A.people(); const s = getSelection(); if (!s.rangeCount) return;
  const rect = s.getRangeAt(0).getBoundingClientRect();
  A.menu(people.map(p => ({ label: p, act: () => { node.focus(); const sel = getSelection(); sel.modify('extend', 'backward', 'character'); cmd('insertHTML', `<span class="mention" contenteditable="false">@${p}</span>&nbsp;`); A.notify(`${A.me()} hat ${p} erwähnt`, p); } })).concat([{ label: 'Person hinzufügen …', act: () => A.prompt('Name oder E-Mail', '', v => { if (v) { A.addPerson(v); node.focus(); } }) }]), rect.left, rect.bottom + 4, { keep: true });
}
// Inhalt aufräumen, Farbwerte im Text als Farbfeld
export function clean(node) {
  node.querySelectorAll('script,style,meta,link').forEach(n => n.remove());
  node.querySelectorAll('*').forEach(n => { for (const a of [...n.attributes]) if (/^on/i.test(a.name)) n.removeAttribute(a.name); });
  return !node.textContent.trim() && !node.querySelector('li,hr,img') ? '' : node.innerHTML;
}
export function hexChips(node) {
  const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT); const hits = [];
  while (w.nextNode()) { const t = w.currentNode; if (t.parentElement.closest('.hexchip,code,pre,a')) continue; if (/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/i.test(t.data)) hits.push(t); }
  hits.forEach(t => { const f = document.createDocumentFragment(); t.data.split(/(#(?:[0-9a-f]{6}|[0-9a-f]{3})\b)/i).forEach(part => { const hx = /^#/.test(part) && hexNorm(part); f.append(hx ? h('span.hexchip', h('i', { style: { background: hx } }), part) : part); }); t.replaceWith(f); });
}
export function pastePlain(e, node) {
  const t = e.clipboardData.getData('text/plain'); if (!t) return;
  e.preventDefault(); const s = getSelection();
  if (isUrl(t) && !s.isCollapsed) cmd('createLink', fixUrl(t)); else cmd('insertText', t);
}
