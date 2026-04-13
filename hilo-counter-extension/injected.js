/**
 * injected.js — executa no contexto da página (não no sandbox da extensão)
 *
 * Estratégia passiva: só OBSERVA, nunca modifica lógica do jogo.
 * Comunica com o content script via window.postMessage.
 *
 * Técnicas usadas:
 *  1. Interceta CanvasRenderingContext2D.drawImage → detecta imagens de carta
 *  2. Interceta Image onload → detecta imagens de carta carregadas
 *  3. Monitoriza atributos de objetos globais comuns (window.game, window.state…)
 *  4. Interceta fetch/XHR → detecta respostas da API do jogo com info de cartas
 *  5. Analisa canvas periodicamente com requestAnimationFrame para mudanças visuais
 */
(function () {
  'use strict';

  const SEND = (card, source) =>
    window.postMessage({ __hilo: true, card, source }, '*');

  // ── 1. Canvas drawImage interceptor ────────────────────────────────────
  const _draw = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (img, ...args) {
    if (img && img instanceof HTMLImageElement) {
      const info = (img.src || '') + ' ' + (img.alt || '') + ' ' + (img.dataset?.card || '');
      const card = extractCardFromString(info);
      if (card) SEND(card, 'canvas-draw');
    }
    return _draw.apply(this, [img, ...args]);
  };

  // ── 2. Image onload interceptor ─────────────────────────────────────────
  const _imgSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (_imgSrc && _imgSrc.set) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      set(val) {
        const card = extractCardFromString(val || '');
        if (card) {
          // Aguarda load para ter certeza que foi renderizada
          this.addEventListener('load', () => SEND(card, 'img-load'), { once: true });
        }
        _imgSrc.set.call(this, val);
      },
      get() { return _imgSrc.get.call(this); },
      configurable: true,
    });
  }

  // ── 3. fetch interceptor ────────────────────────────────────────────────
  const _fetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await _fetch.apply(this, args);
    try {
      const clone = res.clone();
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('json')) {
        clone.json().then(data => scanJsonForCards(data)).catch(() => {});
      }
    } catch (_) {}
    return res;
  };

  // ── 4. XHR interceptor ──────────────────────────────────────────────────
  const _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (...args) {
    this.addEventListener('load', function () {
      try {
        const data = JSON.parse(this.responseText);
        scanJsonForCards(data);
      } catch (_) {}
    });
    return _open.apply(this, args);
  };

  // ── 5. Canvas pixel diff (roda em background com rAF) ──────────────────
  let prevSnapshots = new WeakMap();

  function snapshotCanvas(canvas) {
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const w = Math.min(canvas.width, 1200);
      const h = Math.min(canvas.height, 800);
      if (w < 10 || h < 10) return null;
      return ctx.getImageData(0, 0, w, h);
    } catch (_) { return null; } // cross-origin → ignora
  }

  function diffPixels(a, b) {
    if (!a || !b || a.data.length !== b.data.length) return Infinity;
    let diff = 0;
    const step = 16; // amostra 1 em cada 16 pixels (mais rápido)
    for (let i = 0; i < a.data.length; i += 4 * step) {
      diff += Math.abs(a.data[i] - b.data[i]);
      diff += Math.abs(a.data[i + 1] - b.data[i + 1]);
      diff += Math.abs(a.data[i + 2] - b.data[i + 2]);
    }
    return diff / (a.data.length / (4 * step));
  }

  let rafScheduled = false;
  function monitorCanvases() {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(function tick() {
      rafScheduled = false;
      const canvases = document.querySelectorAll('canvas');
      canvases.forEach(canvas => {
        const curr = snapshotCanvas(canvas);
        const prev = prevSnapshots.get(canvas);
        if (curr && prev) {
          const d = diffPixels(curr, prev);
          if (d > 3 && d < 10000) {
            // Mudança significativa → notifica content script para analisar
            window.postMessage({ __hilo: true, type: 'CANVAS_CHANGED', diff: d }, '*');
          }
        }
        if (curr) prevSnapshots.set(canvas, curr);
      });
      setTimeout(() => {
        requestAnimationFrame(tick);
        rafScheduled = true;
      }, 600);
    });
  }

  // ── 6. Monitorização de objetos globais ─────────────────────────────────
  // Tenta ler estado do jogo de objetos conhecidos
  const GAME_PATHS = [
    'game.currentCards', 'game.playerHand', 'game.dealerHand',
    'blackjack.hand', 'blackjack.cards',
    'state.cards', 'state.hand',
    'App.game', 'App.state',
    '__vue__', 'React',
  ];

  let lastGameState = null;
  function pollGameState() {
    for (const path of GAME_PATHS) {
      try {
        const parts = path.split('.');
        let obj = window;
        for (const p of parts) { obj = obj?.[p]; if (!obj) break; }
        if (obj && typeof obj === 'object') {
          const str = JSON.stringify(obj);
          if (str !== lastGameState) {
            lastGameState = str;
            scanJsonForCards(obj);
          }
          break;
        }
      } catch (_) {}
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const CARD_PATTERN = /\b(ace|king|queen|jack|10|[2-9]|[akqjt])\b/gi;
  const SUIT_PATTERN = /\b(spades?|hearts?|diamonds?|clubs?|[shdc])\b/gi;

  function extractCardFromString(s) {
    if (!s) return null;
    s = s.toLowerCase();

    // Ex: "king_of_hearts", "card_A_S", "10_diamonds", "card-queen-clubs"
    const m = s.match(
      /\b(ace|king|queen|jack|10|[2-9]|[akqjt2-9])[\-_\s\.of]*(spades?|hearts?|diamonds?|clubs?|[shdc])\b/i
    );
    if (m) return normaliseCard(m[1]);

    // Só rank (ex: filename "card_K.png")
    const m2 = s.match(/[\-_\/\.]([akqjt]|10|[2-9])[\-_\.\s]/i);
    if (m2) return normaliseCard(m2[1]);

    return null;
  }

  function normaliseCard(r) {
    const map = {
      ace: 'A', king: 'K', queen: 'Q', jack: 'J',
      a: 'A', k: 'K', q: 'Q', j: 'J', t: '10',
      '10': '10', '2': '2', '3': '3', '4': '4', '5': '5',
      '6': '6', '7': '7', '8': '8', '9': '9',
    };
    return map[r.toLowerCase()] || null;
  }

  function scanJsonForCards(obj) {
    if (!obj || typeof obj !== 'object') return;
    const keys = ['card', 'rank', 'face', 'value', 'suit', 'hand', 'cards'];
    for (const key of Object.keys(obj)) {
      const k = key.toLowerCase();
      const v = obj[key];
      if (keys.some(kk => k.includes(kk))) {
        if (typeof v === 'string') {
          const c = normaliseCard(v) || extractCardFromString(v);
          if (c) SEND(c, 'json-api');
        } else if (Array.isArray(v)) {
          v.forEach(item => {
            if (typeof item === 'string') {
              const c = normaliseCard(item) || extractCardFromString(item);
              if (c) SEND(c, 'json-api');
            } else if (item && typeof item === 'object') {
              scanJsonForCards(item);
            }
          });
        } else if (v && typeof v === 'object') {
          scanJsonForCards(v);
        }
      }
    }
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  monitorCanvases();
  setInterval(pollGameState, 1000);

  // Notifica que injected.js está pronto
  window.postMessage({ __hilo: true, type: 'READY' }, '*');
})();
