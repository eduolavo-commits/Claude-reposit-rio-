/**
 * background.js — Service Worker
 * Captura screenshots da aba activa e envia para o content script analisar.
 * Também faz routing de mensagens entre popup e content script.
 */

let captureIntervals = {}; // tabId → intervalId

// ── Mensagens vindas do popup ou content script ───────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_CAPTURE') {
    startCapture(msg.tabId);
    sendResponse({ ok: true });
  }
  if (msg.type === 'STOP_CAPTURE') {
    stopCapture(msg.tabId);
    sendResponse({ ok: true });
  }
  if (msg.type === 'GET_CAPTURE_STATE') {
    sendResponse({ active: !!captureIntervals[msg.tabId] });
  }
  return true;
});

// Limpa quando tab fecha
chrome.tabs.onRemoved.addListener(tabId => stopCapture(tabId));

// ── Captura ───────────────────────────────────────────────────────────────
function startCapture(tabId) {
  if (captureIntervals[tabId]) return; // já a correr

  let lastDataUrl = null;

  async function captureAndSend() {
    try {
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (!tab || tab.status !== 'complete') return;

      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'jpeg',
        quality: 40   // baixa qualidade = mais rápido, suficiente para diff
      }).catch(() => null);

      if (!dataUrl || dataUrl === lastDataUrl) return;

      chrome.tabs.sendMessage(tabId, {
        type: 'SCREENSHOT',
        dataUrl,
        prev: lastDataUrl
      }).catch(() => {});

      lastDataUrl = dataUrl;
    } catch (_) {}
  }

  captureIntervals[tabId] = setInterval(captureAndSend, 600);
  captureAndSend(); // primeiro disparo imediato
}

function stopCapture(tabId) {
  if (captureIntervals[tabId]) {
    clearInterval(captureIntervals[tabId]);
    delete captureIntervals[tabId];
  }
}
