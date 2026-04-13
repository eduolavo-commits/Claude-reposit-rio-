/**
 * Blackjack Hi-Lo Counter – Content Script
 *
 * Sistema Hi-Lo:
 *   2 a 6  → +1  (cartas baixas favorecem o dealer)
 *   7 a 9  →  0  (neutras)
 *   10, J, Q, K, A → -1 (cartas altas favorecem o jogador)
 *
 * Detecção automática:
 *   – Observa mutações do DOM (MutationObserver)
 *   – Verifica texto, atributos data-*, alt/src de imagens e aria-label
 *   – Nunca conta o mesmo elemento duas vezes
 *
 * Atalhos de teclado (Alt + tecla):
 *   Alt+↑  → adiciona +1 manualmente
 *   Alt+↓  → adiciona -1 manualmente
 *   Alt+→  → adiciona  0 manualmente
 *   Alt+R  → reset
 *   Alt+H  → ocultar/mostrar HUD
 */

(function () {
  'use strict';

  if (document.getElementById('hilo-hud')) return; // já iniciado

  // ── Constantes Hi-Lo ──────────────────────────────────────────────────────
  const HILO = {
    '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
    '7': 0, '8': 0, '9': 0,
    '10': -1, 'T': -1,
    'J': -1, 'JACK': -1,
    'Q': -1, 'QUEEN': -1,
    'K': -1, 'KING': -1,
    'A': -1, 'ACE': -1,
    'ONE': -1  // ás mostrado como 1 ou "one"
  };

  const WORD_TO_HILO = {
    ACE: -1, TWO: 1, THREE: 1, FOUR: 1, FIVE: 1, SIX: 1,
    SEVEN: 0, EIGHT: 0, NINE: 0, TEN: -1,
    JACK: -1, QUEEN: -1, KING: -1
  };

  // ── Estado ─────────────────────────────────────────────────────────────────
  let runningCount = 0;
  let cardsDealt = 0;
  let numDecks = 6;
  let history = [];
  let isMinimized = false;
  let isHidden = false;
  let autoEnabled = true;
  const countedElements = new WeakSet();

  // ── Extração de valor Hi-Lo ────────────────────────────────────────────────
  function hiloFromText(raw) {
    if (!raw) return null;
    const t = raw.trim().toUpperCase();

    // "Ace of Spades", "King of Hearts" …
    for (const word of Object.keys(WORD_TO_HILO)) {
      if (t.startsWith(word)) return WORD_TO_HILO[word];
    }

    // Notação curta: "A♠", "10♦", "KH", "2S" …
    const m = t.match(/^(A|10|[2-9]|J|Q|K|T)/);
    if (m) {
      const v = HILO[m[1]];
      return v !== undefined ? v : null;
    }

    return null;
  }

  function hiloFromSrc(src) {
    // ex: "cards/ace_of_spades.png", "img/10_hearts.png", "card_K_D.svg"
    const m = (src || '').match(
      /\b(ace|king|queen|jack|10|[2-9]|[akqjt])[\-_\.](spade|heart|diamond|club|[shdc])\b/i
    );
    if (!m) return null;
    return hiloFromText(m[1]);
  }

  function hiloFromClassName(cls) {
    // ex: "card-value-K", "card_10", "card-ace"
    const m = (cls || '').match(
      /card[\-_](ace|king|queen|jack|10|[2-9a-z])(?:[\-_]|$)/i
    );
    if (!m) return null;
    return hiloFromText(m[1]);
  }

  // ── Escanear um elemento ───────────────────────────────────────────────────
  function scanElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    if (countedElements.has(el)) return;
    if (el.closest && el.closest('#hilo-hud')) return;

    let value = null;
    let label = '';

    // 1) Atributos data-card / data-value / data-rank
    for (const attr of ['data-card', 'data-rank', 'data-value', 'data-face']) {
      const v = el.getAttribute(attr);
      if (v) {
        value = hiloFromText(v);
        label = v;
        if (value !== null) break;
      }
    }

    // 2) Imagem – alt e src
    if (value === null && el.tagName === 'IMG') {
      const alt = el.getAttribute('alt') || '';
      value = hiloFromText(alt);
      label = alt;
      if (value === null) {
        value = hiloFromSrc(el.getAttribute('src') || '');
        label = el.getAttribute('src') || '';
      }
    }

    // 3) aria-label / title
    if (value === null) {
      for (const attr of ['aria-label', 'title']) {
        const v = el.getAttribute(attr) || '';
        if (v) {
          value = hiloFromText(v);
          label = v;
          if (value !== null) break;
        }
      }
    }

    // 4) Classe CSS
    if (value === null) {
      value = hiloFromClassName(el.className || '');
      label = el.className || '';
    }

    // 5) Texto curto (até 3 chars) em elemento com "card" na classe/id
    if (value === null) {
      const txt = (el.textContent || '').trim();
      const cls = (el.className + ' ' + el.id).toLowerCase();
      if (txt.length <= 3 && cls.includes('card')) {
        value = hiloFromText(txt);
        label = txt;
      }
    }

    if (value !== null) {
      countedElements.add(el);
      addToCount(value, 'auto', label || '?');
    }
  }

  // ── Escanear novos nós ─────────────────────────────────────────────────────
  function scanNodes(nodes) {
    if (!autoEnabled) return;
    nodes.forEach(node => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      scanElement(node);

      // filhos que parecem cartas
      const q = node.querySelectorAll(
        '[class*="card"],[id*="card"],[data-card],[data-rank],[data-face],img[alt],img[src]'
      );
      q.forEach(scanElement);
    });
  }

  // ── Lógica de contagem ─────────────────────────────────────────────────────
  function addToCount(value, source, cardLabel) {
    runningCount += value;
    cardsDealt++;
    history.unshift({ value, count: runningCount, label: cardLabel, source });
    if (history.length > 20) history.pop();
    updateDisplay();
  }

  function resetCount() {
    runningCount = 0;
    cardsDealt = 0;
    history = [];
    // Não limpa countedElements – reset apenas visual
    // Para limpar o rastreio, recarregue a página
    updateDisplay();
  }

  function decksRemaining() {
    const total = numDecks * 52;
    return Math.max(0.5, (total - cardsDealt) / 52);
  }

  function trueCount() {
    return runningCount / decksRemaining();
  }

  function advantageInfo() {
    const tc = trueCount();
    if (tc >= 4)  return { text: 'Alta ++ ▲▲', cls: 'hilo-adv-high' };
    if (tc >= 2)  return { text: 'Favorável ▲', cls: 'hilo-adv-good' };
    if (tc <= -4) return { text: 'Péssimo ▼▼', cls: 'hilo-adv-vbad' };
    if (tc <= -2) return { text: 'Desfav. ▼', cls: 'hilo-adv-bad' };
    return { text: 'Neutro —', cls: 'hilo-adv-neutral' };
  }

  // ── HUD ───────────────────────────────────────────────────────────────────
  function createHUD() {
    const hud = document.createElement('div');
    hud.id = 'hilo-hud';
    hud.setAttribute('role', 'dialog');
    hud.setAttribute('aria-label', 'Hi-Lo Counter');

    hud.innerHTML = `
      <div id="hilo-header">
        <span id="hilo-title">&#9824; Hi-Lo Counter</span>
        <div id="hilo-header-btns">
          <button id="hilo-btn-min" title="Minimizar">&#8722;</button>
          <button id="hilo-btn-close" title="Fechar">&#215;</button>
        </div>
      </div>

      <div id="hilo-body">

        <!-- Contadores principais -->
        <div id="hilo-stats">
          <div class="hilo-stat-block">
            <div class="hilo-stat-label">Contagem</div>
            <div id="hilo-rc" class="hilo-stat-value">0</div>
          </div>
          <div class="hilo-stat-block">
            <div class="hilo-stat-label">Cont. Verdadeira</div>
            <div id="hilo-tc" class="hilo-stat-value">0.0</div>
          </div>
          <div class="hilo-stat-block">
            <div class="hilo-stat-label">Cartas vistas</div>
            <div id="hilo-cd" class="hilo-stat-value">0</div>
          </div>
          <div class="hilo-stat-block">
            <div class="hilo-stat-label">Vantagem</div>
            <div id="hilo-adv" class="hilo-stat-value hilo-adv-neutral">Neutro —</div>
          </div>
        </div>

        <!-- Baralhos -->
        <div class="hilo-row">
          <label class="hilo-row-label" for="hilo-decks">Baralhos:</label>
          <select id="hilo-decks">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="4">4</option>
            <option value="6" selected>6</option>
            <option value="8">8</option>
          </select>
        </div>

        <!-- Auto-detecção toggle -->
        <div class="hilo-row">
          <label class="hilo-row-label">Auto-detect:</label>
          <button id="hilo-auto-toggle" class="hilo-toggle on">ON</button>
        </div>

        <!-- Entrada manual por tipo de carta -->
        <div id="hilo-manual-section">
          <div class="hilo-row-label" style="margin-bottom:4px;">Adicionar manualmente:</div>
          <div id="hilo-manual-grid">
            <button class="hilo-card-quick" data-v="1"  title="2-6 (+1)">2–6 +1</button>
            <button class="hilo-card-quick" data-v="0"  title="7-9 (0)">7–9  0</button>
            <button class="hilo-card-quick" data-v="-1" title="10,J,Q,K,A (-1)">10–A -1</button>
          </div>
          <div id="hilo-card-picker">
            <div class="hilo-picker-label">Carta exata:</div>
            <div id="hilo-picker-row">
              <button class="hilo-pick" data-v="1"  data-c="2">2</button>
              <button class="hilo-pick" data-v="1"  data-c="3">3</button>
              <button class="hilo-pick" data-v="1"  data-c="4">4</button>
              <button class="hilo-pick" data-v="1"  data-c="5">5</button>
              <button class="hilo-pick" data-v="1"  data-c="6">6</button>
              <button class="hilo-pick" data-v="0"  data-c="7">7</button>
              <button class="hilo-pick" data-v="0"  data-c="8">8</button>
              <button class="hilo-pick" data-v="0"  data-c="9">9</button>
              <button class="hilo-pick" data-v="-1" data-c="10">10</button>
              <button class="hilo-pick" data-v="-1" data-c="J">J</button>
              <button class="hilo-pick" data-v="-1" data-c="Q">Q</button>
              <button class="hilo-pick" data-v="-1" data-c="K">K</button>
              <button class="hilo-pick" data-v="-1" data-c="A">A</button>
            </div>
          </div>
        </div>

        <!-- Histórico -->
        <div id="hilo-history-section">
          <div class="hilo-row-label">Histórico recente:</div>
          <div id="hilo-history"></div>
        </div>

        <!-- Ações -->
        <div id="hilo-actions">
          <button id="hilo-reset">&#8635; Reset</button>
          <span id="hilo-shortcuts" title="Alt+↑ +1 | Alt+↓ -1 | Alt+→ 0 | Alt+R reset | Alt+H ocultar">&#9000; Atalhos</span>
        </div>

      </div><!-- /body -->
    `;

    document.body.appendChild(hud);
    makeDraggable(hud);
    bindEvents(hud);
    return hud;
  }

  function bindEvents(hud) {
    hud.querySelector('#hilo-btn-min').addEventListener('click', () => {
      isMinimized = !isMinimized;
      hud.querySelector('#hilo-body').style.display = isMinimized ? 'none' : '';
      hud.querySelector('#hilo-btn-min').innerHTML = isMinimized ? '&#43;' : '&#8722;';
    });

    hud.querySelector('#hilo-btn-close').addEventListener('click', () => hud.remove());

    hud.querySelector('#hilo-decks').addEventListener('change', e => {
      numDecks = parseInt(e.target.value);
      updateDisplay();
    });

    hud.querySelector('#hilo-auto-toggle').addEventListener('click', function () {
      autoEnabled = !autoEnabled;
      this.textContent = autoEnabled ? 'ON' : 'OFF';
      this.classList.toggle('on', autoEnabled);
      this.classList.toggle('off', !autoEnabled);
    });

    hud.querySelectorAll('.hilo-card-quick').forEach(btn => {
      btn.addEventListener('click', () => {
        addToCount(parseInt(btn.dataset.v), 'manual', `quick ${btn.dataset.v > 0 ? '+' : ''}${btn.dataset.v}`);
      });
    });

    hud.querySelectorAll('.hilo-pick').forEach(btn => {
      btn.addEventListener('click', () => {
        addToCount(parseInt(btn.dataset.v), 'manual', btn.dataset.c);
      });
    });

    hud.querySelector('#hilo-reset').addEventListener('click', resetCount);
  }

  function updateDisplay() {
    const rc  = document.getElementById('hilo-rc');
    const tc  = document.getElementById('hilo-tc');
    const cd  = document.getElementById('hilo-cd');
    const adv = document.getElementById('hilo-adv');
    const hist = document.getElementById('hilo-history');
    if (!rc) return;

    // Running count
    rc.textContent = (runningCount > 0 ? '+' : '') + runningCount;
    rc.className = 'hilo-stat-value ' + (runningCount > 0 ? 'hilo-pos' : runningCount < 0 ? 'hilo-neg' : '');

    // True count
    const tc_val = trueCount();
    tc.textContent = (tc_val > 0 ? '+' : '') + tc_val.toFixed(1);
    tc.className = 'hilo-stat-value ' + (tc_val > 0 ? 'hilo-pos' : tc_val < 0 ? 'hilo-neg' : '');

    // Cards dealt
    cd.textContent = cardsDealt;

    // Advantage
    const advi = advantageInfo();
    adv.textContent = advi.text;
    adv.className = 'hilo-stat-value ' + advi.cls;

    // History
    hist.innerHTML = history.slice(0, 10).map(h => {
      const cls = h.value > 0 ? 'hist-p' : h.value < 0 ? 'hist-n' : 'hist-z';
      const sign = h.value > 0 ? '+' : '';
      const cnt  = h.count > 0 ? '+' + h.count : h.count;
      return `<span class="hist-chip ${cls}" title="${h.label}">${sign}${h.value} [${cnt}]</span>`;
    }).join('');
  }

  // ── Arrastar HUD ──────────────────────────────────────────────────────────
  function makeDraggable(el) {
    const header = el.querySelector('#hilo-header');
    let dragging = false, ox = 0, oy = 0;

    header.addEventListener('mousedown', e => {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return;
      dragging = true;
      const r = el.getBoundingClientRect();
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      el.style.left   = (e.clientX - ox) + 'px';
      el.style.top    = (e.clientY - oy) + 'px';
      el.style.right  = 'auto';
      el.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => { dragging = false; });
  }

  // ── MutationObserver ──────────────────────────────────────────────────────
  function initObserver() {
    const observer = new MutationObserver(mutations => {
      const added = [];
      mutations.forEach(m => {
        m.addedNodes.forEach(n => added.push(n));
        // Mudanças de atributo em elementos existentes (ex: flip de carta)
        if (m.type === 'attributes' && m.target && !countedElements.has(m.target)) {
          scanElement(m.target);
        }
      });
      if (added.length) scanNodes(added);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'src', 'data-card', 'data-rank', 'data-face',
                        'data-value', 'alt', 'aria-label', 'title']
    });
  }

  // ── Escaneamento inicial ──────────────────────────────────────────────────
  function initialScan() {
    document.querySelectorAll(
      '[class*="card"],[id*="card"],[data-card],[data-rank],[data-face],img[alt],img[src*="card"]'
    ).forEach(scanElement);
  }

  // ── Atalhos de teclado ────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (!e.altKey) return;
    switch (e.key) {
      case 'ArrowUp':    addToCount(1,  'key', 'key:+1'); e.preventDefault(); break;
      case 'ArrowDown':  addToCount(-1, 'key', 'key:-1'); e.preventDefault(); break;
      case 'ArrowRight': addToCount(0,  'key', 'key:0');  e.preventDefault(); break;
      case 'r': case 'R': resetCount(); e.preventDefault(); break;
      case 'h': case 'H': {
        const hud = document.getElementById('hilo-hud');
        if (hud) {
          isHidden = !isHidden;
          hud.style.opacity = isHidden ? '0.1' : '1';
        }
        e.preventDefault();
        break;
      }
    }
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  createHUD();
  initObserver();
  setTimeout(initialScan, 800);

})();
