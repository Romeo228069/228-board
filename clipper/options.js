const app = document.getElementById('app'), sel = document.getElementById('sel');
chrome.storage.sync.get(['app', 'selIcon'], v => { app.value = v.app || 'https://romeo228069.github.io/228-board/'; sel.checked = !!v.selIcon; });
app.onchange = () => chrome.storage.sync.set({ app: app.value.trim().replace(/\/?$/, '/') });
sel.onchange = () => chrome.storage.sync.set({ selIcon: sel.checked });
