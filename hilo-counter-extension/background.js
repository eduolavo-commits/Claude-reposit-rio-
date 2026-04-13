/**
 * background.js — Service Worker
 *
 * Captura o ecrã do jogo a cada 1 segundo usando captureVisibleTab().
 * Compara frames com OffscreenCanvas para detectar quando uma carta nova aparece.
 * Envia notificação ao content script — não toca em NADA do site.
 */

let captureTabId = null;
let captureTimer = null;
let prevImageData = null;
let offCanvas = null;
let offCtx = null;

const W = 640, H = 400; // resolução de análise (leve)

function getCanvas() {
  if (!offCanvas) {
    offCanvas = new OffscreenCanvas(W, H);
    offCtx = offCanvas.getContext('2d');
  }
  return offCtx;
}

async function captureAndAnalyse(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || tab.status !== 'complete') return;

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg',
      quality: 35
    }).catch(() => null);
    if (!dataUrl) return;

    // Desenha em OffscreenCanvas (thread do service worker, fora da página)
    const resp = await fetch(dataUrl);
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob, { resizeWidth: W, resizeHeight: H });

    const ctx = getCanvas();
    ctx.drawImage(bitmap, 0, 0, W, H);
    bitmap.close();

    const curr = ctx.getImageData(0, 0, W, H);

    if (prevImageData) {
      const diff = pixelDiff(prevImageData.data, curr.data);
      // diff > 8 = mudança real (carta nova); diff > 200 = transição grande (nova ronda)
      if (diff > 8) {
        chrome.tabs.sendMessage(tabId, {
          type: 'SCREEN_CHANGED',
          level: diff > 200 ? 'big' : 'small'
        }).catch(() => {});
      }
    }

    prevImageData = curr;
  } catch (_) {}
}

function pixelDiff(a, b) {
  let total = 0;
  // Amostra 1 pixel a cada 32 — rápido e suficiente
  for (let i = 0; i < a.length; i += 4 * 32) {
    total += Math.abs(a[i]   - b[i]);
    total += Math.abs(a[i+1] - b[i+1]);
    total += Math.abs(a[i+2] - b[i+2]);
  }
  return total / (a.length / (4 * 32));
}

function startCapture(tabId) {
  if (captureTimer) clearInterval(captureTimer);
  captureTabId = tabId;
  prevImageData = null;
  captureAndAnalyse(tabId);
  captureTimer = setInterval(() => captureAndAnalyse(tabId), 1000);
}

function stopCapture() {
  if (captureTimer) clearInterval(captureTimer);
  captureTimer = null;
  captureTabId = null;
  prevImageData = null;
}

// Mensagens do popup / content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_CAPTURE') {
    startCapture(msg.tabId);
    sendResponse({ ok: true });
  }
  if (msg.type === 'STOP_CAPTURE') {
    stopCapture();
    sendResponse({ ok: true });
  }
  if (msg.type === 'IS_CAPTURING') {
    sendResponse({ active: captureTabId === msg.tabId });
  }
  return true;
});

chrome.tabs.onRemoved.addListener(id => { if (id === captureTabId) stopCapture(); });
