// 228 Board Clipper: übergibt Inhalte an die App, sie landen in der Ablage des Startboards
const DEFAULT = 'https://romeo228069.github.io/228-board/';
async function save(p) {
  const { app = DEFAULT } = await chrome.storage.sync.get('app');
  const q = new URLSearchParams(); for (const k in p) if (p[k]) q.set(k, String(p[k]).slice(0, 1800));
  chrome.windows.create({ url: app + '?clip=1&' + q, type: 'popup', width: 460, height: 640 });
}
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'sel', title: 'Auswahl in 228 Board speichern', contexts: ['selection'] });
  chrome.contextMenus.create({ id: 'img', title: 'Bild in 228 Board speichern', contexts: ['image'] });
  chrome.contextMenus.create({ id: 'vid', title: 'Video in 228 Board speichern', contexts: ['video'] });
  chrome.contextMenus.create({ id: 'lnk', title: 'Link in 228 Board speichern', contexts: ['link'] });
  chrome.contextMenus.create({ id: 'pg', title: 'Seite in 228 Board speichern', contexts: ['page'] });
});
chrome.contextMenus.onClicked.addListener((i, tab) => {
  if (i.menuItemId === 'sel') save({ text: i.selectionText, src: tab.url, title: tab.title });
  else if (i.menuItemId === 'img') save({ img: i.srcUrl, src: tab.url, title: tab.title });
  else if (i.menuItemId === 'vid') save({ url: i.pageUrl, title: tab.title });
  else if (i.menuItemId === 'lnk') save({ url: i.linkUrl });
  else save({ url: tab.url, title: tab.title });
});
chrome.action.onClicked.addListener(tab => save({ url: tab.url, title: tab.title }));
chrome.runtime.onMessage.addListener(m => { if (m && m.clip) save(m.clip); });
