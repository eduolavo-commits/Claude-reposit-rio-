// Service Worker – Hi-Lo Counter Extension
// Minimal – apenas garante que a extensão esteja registrada como ativa.

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Hi-Lo Counter] Extensão instalada/atualizada.');
});
