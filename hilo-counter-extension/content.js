/* content.js — parte 1: estado, estratégia, detecção */
(function () {
'use strict';
if (document.getElementById('hilo-hud')) return;

// ══════════════════════════════════════════════════════════════════════════
// ESTADO
// ══════════════════════════════════════════════════════════════════════════
let runningCount = 0, cardsDealt = 0, numDecks = 6;
let history = [], isMinimized = false, activeTab = 'count';
let autoEnabled = true, visualEnabled = false;
let playerHand = [], dealerCard = null;
const counted = new WeakSet();

// Composição do baralho (quantas de cada rank restam)
const INITIAL_PER_RANK = { A:4,2:4,3:4,4:4,5:4,6:4,7:4,8:4,9:4,10:16 };
let deckComp = {};
function resetDeckComp() {
  deckComp = {};
  for (const [k,v] of Object.entries(INITIAL_PER_RANK))
    deckComp[k] = v * numDecks;
}
resetDeckComp();

// ══════════════════════════════════════════════════════════════════════════
// HI-LO
// ══════════════════════════════════════════════════════════════════════════
const HILO_VAL = {
  '2':1,'3':1,'4':1,'5':1,'6':1,
  '7':0,'8':0,'9':0,
  '10':-1,'J':-1,'Q':-1,'K':-1,'A':-1
};

function rankToHilo(r) {
  return HILO_VAL[r] !== undefined ? HILO_VAL[r] : null;
}

function normRank(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase();
  const map = {
    'ACE':'A','TWO':'2','THREE':'3','FOUR':'4','FIVE':'5',
    'SIX':'6','SEVEN':'7','EIGHT':'8','NINE':'9','TEN':'10',
    'JACK':'J','QUEEN':'Q','KING':'K','T':'10','1':'A',
    'A':'A','J':'J','Q':'Q','K':'K',
  };
  if (map[s]) return map[s];
  if (/^10$/.test(s)) return '10';
  if (/^[2-9]$/.test(s)) return s;
  // Tenta extrair de string tipo "K♠" ou "king_of_hearts"
  const m = s.match(/^(ACE|KING|QUEEN|JACK|10|[2-9AaKkQqJjTt])/);
  if (m) return map[m[1].toUpperCase()] || m[1].toUpperCase();
  return null;
}

// ══════════════════════════════════════════════════════════════════════════
// ESTRATÉGIA BÁSICA  (6 baralhos, S17, DAS, LS)
// Colunas: dealer 2,3,4,5,6,7,8,9,T,A
// H=Hit  S=Stand  D=Double(hit)  DS=Double(stand)  SP=Split  SU=Surrender(hit)
// ══════════════════════════════════════════════════════════════════════════
const BS_HARD = {
  5: 'H H H H H H H H H H',
  6: 'H H H H H H H H H H',
  7: 'H H H H H H H H H H',
  8: 'H H H H H H H H H H',
  9: 'H D D D D H H H H H',
 10: 'D D D D D D D D H H',
 11: 'D D D D D D D D D H',
 12: 'H H S S S H H H H H',
 13: 'S S S S S H H H H H',
 14: 'S S S S S H H H H H',
 15: 'S S S S S H H H SU H',
 16: 'S S S S S H H SU SU SU',
 17: 'S S S S S S S S S S',
 18: 'S S S S S S S S S S',
 19: 'S S S S S S S S S S',
 20: 'S S S S S S S S S S',
 21: 'S S S S S S S S S S',
};
const BS_SOFT = { // A + x
  2: 'H H H D D H H H H H',
  3: 'H H H D D H H H H H',
  4: 'H H D D D H H H H H',
  5: 'H H D D D H H H H H',
  6: 'H D D D D H H H H H',
  7: 'DS DS DS DS DS S S H H H',
  8: 'S S S S S S S S S S',
  9: 'S S S S S S S S S S',
};
const BS_PAIR = {
  'A': 'SP SP SP SP SP SP SP SP SP SP',
  '2': 'SP SP SP SP SP SP H H H H',
  '3': 'SP SP SP SP SP SP H H H H',
  '4': 'H H H SP SP H H H H H',
  '5': 'D D D D D D D D H H',
  '6': 'SP SP SP SP SP H H H H H',
  '7': 'SP SP SP SP SP SP H H H H',
  '8': 'SP SP SP SP SP SP SP SP SP SP',
  '9': 'SP SP SP SP SP S SP SP S S',
  '10':'S S S S S S S S S S',
};

// Illustrious 18 desvios por true count
// Formato: [playerKey, dealerIdx, action, tcThreshold, acimaDe]
// dealerIdx: 0=2 … 8=T, 9=A
const DEVIATIONS = [
  // [descrição, hard/soft/pair, valor, dealerIdx, tcThreshold, ação se acima]
  {d:'16 vs T', type:'hard', val:16, di:8, tc:0,  act:'S', base:'SU/H'},
  {d:'15 vs T', type:'hard', val:15, di:8, tc:4,  act:'S', base:'SU'},
  {d:'12 vs 3', type:'hard', val:12, di:1, tc:2,  act:'S', base:'H'},
  {d:'12 vs 2', type:'hard', val:12, di:0, tc:3,  act:'S', base:'H'},
  {d:'11 vs A', type:'hard', val:11, di:9, tc:1,  act:'D', base:'H'},
  {d:'9 vs 2',  type:'hard', val:9,  di:0, tc:1,  act:'D', base:'H'},
  {d:'9 vs 7',  type:'hard', val:9,  di:5, tc:3,  act:'D', base:'H'},
  {d:'10 vs A', type:'hard', val:10, di:9, tc:4,  act:'D', base:'H'},
  {d:'16 vs 9', type:'hard', val:16, di:7, tc:5,  act:'S', base:'SU'},
  {d:'TT vs 6', type:'pair', val:'10',di:4,tc:4,  act:'SP',base:'S'},
  {d:'TT vs 5', type:'pair', val:'10',di:3,tc:5,  act:'SP',base:'S'},
];

const DEALER_IDX = {'2':0,'3':1,'4':2,'5':3,'6':4,'7':5,'8':6,'9':7,'10':8,'J':8,'Q':8,'K':8,'A':9};

function bsLookup(table, key) {
  const row = table[key];
  return row ? row.split(' ') : null;
}

function getAdvice(playerCards, dealerUp) {
  if (!playerCards.length || !dealerUp) return null;
  const di = DEALER_IDX[dealerUp];
  if (di === undefined) return null;
  const tc = trueCount();

  // Seguro (insurance)
  let insurance = null;
  if (dealerUp === 'A' && tc >= 3)
    insurance = 'Fazer seguro (TC≥3)';

  // Detecta pair
  const isPair = playerCards.length === 2 &&
    normRank(playerCards[0]) === normRank(playerCards[1]);

  let action = null, devNote = null;

  if (isPair) {
    const rank = normRank(playerCards[0]);
    const pairKey = rank === 'J' || rank === 'Q' || rank === 'K' ? '10' : rank;
    // Desvio pair
    const dev = DEVIATIONS.find(d => d.type==='pair' && d.val===pairKey && d.di===di && tc>=d.tc);
    if (dev) { action = dev.act; devNote = `Desvio TC${tc>=0?'+':''}${tc.toFixed(1)}: ${dev.d}`; }
    else {
      const row = bsLookup(BS_PAIR, pairKey);
      action = row ? row[di] : 'H';
    }
  } else {
    // Soft hand?
    const hasAce = playerCards.some(c => normRank(c)==='A');
    const total = handValue(playerCards);

    if (hasAce && total <= 21 && total >= 13) {
      const softX = total - 11; // A + x
      if (softX >= 2 && softX <= 9) {
        const row = bsLookup(BS_SOFT, softX);
        action = row ? row[di] : 'H';
      } else {
        action = 'S'; // soft 20/21
      }
    } else {
      // Hard
      const hardKey = Math.min(Math.max(total, 5), 21);
      // Desvio hard
      const dev = DEVIATIONS.find(d => d.type==='hard' && d.val===hardKey && d.di===di && tc>=d.tc);
      if (dev) { action = dev.act; devNote = `Desvio TC${tc>=0?'+':''}${tc.toFixed(1)}: ${dev.d}`; }
      else {
        const row = bsLookup(BS_HARD, hardKey);
        action = row ? row[di] : 'S';
      }
    }
  }

  return { action: action || 'H', devNote, insurance };
}

function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    const r = normRank(c);
    if (!r) continue;
    if (r === 'A') { total += 11; aces++; }
    else if (['J','Q','K'].includes(r)) total += 10;
    else total += parseInt(r) || 0;
    while (total > 21 && aces > 0) { total -= 10; aces--; }
  }
  return total;
}

const ACTION_LABELS = {
  H:  { pt: 'PEDIR',     en: 'Hit',    cls: 'act-hit'    },
  S:  { pt: 'PARAR',     en: 'Stand',  cls: 'act-stand'  },
  D:  { pt: 'DOBRAR',    en: 'Double', cls: 'act-double' },
  DS: { pt: 'DOBRAR',    en: 'Double/Stand', cls: 'act-double' },
  SP: { pt: 'DIVIDIR',   en: 'Split',  cls: 'act-split'  },
  SU: { pt: 'RENDER',    en: 'Surrender', cls: 'act-surr' },
  RS: { pt: 'RENDER',    en: 'Surrender/Stand', cls: 'act-surr' },
};

// ══════════════════════════════════════════════════════════════════════════
// APOSTAS & MESA
// ══════════════════════════════════════════════════════════════════════════
function betMultiplier() {
  const tc = trueCount();
  if (tc >= 5) return 12;
  if (tc >= 4) return 8;
  if (tc >= 3) return 4;
  if (tc >= 2) return 2;
  return 1;
}

function joinAdvice() {
  const tc = trueCount();
  if (tc >= 2)  return { txt: '✅ ENTRAR — mesa favorável', cls: 'join' };
  if (tc >= 0)  return { txt: '⚖️ NEUTRO — apostar mínimo', cls: 'wait' };
  return        { txt: '❌ SAIR — mesa desfavorável',  cls: 'leave' };
}

function advantageInfo() {
  const tc = trueCount();
  if (tc >= 4)  return { txt: 'Alta ++ ▲▲', cls: 'adv-high' };
  if (tc >= 2)  return { txt: 'Favor. ▲',   cls: 'adv-good' };
  if (tc <= -4) return { txt: 'Péssimo ▼▼', cls: 'adv-vbad' };
  if (tc <= -2) return { txt: 'Desfav. ▼',  cls: 'adv-bad'  };
  return { txt: 'Neutro —', cls: 'adv-neu' };
}

// ══════════════════════════════════════════════════════════════════════════
// CONTADOR
// ══════════════════════════════════════════════════════════════════════════
function trueCount() {
  const remaining = Math.max(0.5, (numDecks * 52 - cardsDealt) / 52);
  return runningCount / remaining;
}

function addCard(rank, source) {
  const r = normRank(rank);
  if (!r) return;
  const hv = rankToHilo(r);
  if (hv === null) return;
  runningCount += hv;
  cardsDealt++;
  // Actualiza composição
  const compKey = ['J','Q','K'].includes(r) ? '10' : r;
  if (deckComp[compKey] > 0) deckComp[compKey]--;
  history.unshift({ rank: r, hv, count: runningCount, source });
  if (history.length > 30) history.pop();
  updateAll();
}

function resetAll() {
  runningCount = 0; cardsDealt = 0; history = [];
  playerHand = []; dealerCard = null;
  resetDeckComp();
  updateAll();
}

// ══════════════════════════════════════════════════════════════════════════
// DETECÇÃO DOM
// ══════════════════════════════════════════════════════════════════════════
function extractRankFromEl(el) {
  // 1. data attributes
  for (const attr of ['data-card','data-rank','data-face','data-value']) {
    const v = el.getAttribute(attr);
    if (v) { const r = normRank(v); if (r) return r; }
  }
  // 2. aria-label / title
  for (const attr of ['aria-label','title']) {
    const v = el.getAttribute(attr);
    if (v) { const r = normRank(v.split(/[\s,_\-]/)[0]); if (r) return r; }
  }
  // 3. img alt / src
  if (el.tagName === 'IMG') {
    const alt = el.getAttribute('alt') || '';
    const r = normRank(alt.split(/[\s,_\-]/)[0]);
    if (r) return r;
    const src = el.getAttribute('src') || '';
    const m = src.match(/[\/_\-]([akqjt]|10|[2-9])[\._\-]/i);
    if (m) { const r2 = normRank(m[1]); if (r2) return r2; }
  }
  // 4. Classe CSS  ex: card-K, card_10, rank-A
  const cls = (el.className || '') + ' ' + (el.id || '');
  const mc = cls.match(/(?:card|rank|face)[\-_]([akqjt]|10|[2-9])/i);
  if (mc) { const r = normRank(mc[1]); if (r) return r; }
  // 5. Texto curto (≤3 chars) em elemento com "card" no contexto
  const txt = (el.textContent || '').trim();
  if (txt.length <= 3 && /card|rank|face/i.test(cls)) {
    const r = normRank(txt); if (r) return r;
  }
  return null;
}

function scanEl(el) {
  if (!el || el.nodeType !== 1) return;
  if (counted.has(el)) return;
  if (el.id === 'hilo-hud' || el.closest?.('#hilo-hud')) return;
  const r = extractRankFromEl(el);
  if (r) { counted.add(el); addCard(r, 'dom'); }
}

function scanNodes(nodes) {
  if (!autoEnabled) return;
  nodes.forEach(n => {
    if (n.nodeType !== 1) return;
    scanEl(n);
    n.querySelectorAll?.('[class*=card],[id*=card],[data-card],[data-rank],[data-face],img')
      .forEach(scanEl);
  });
}

function initObserver() {
  const obs = new MutationObserver(muts => {
    const added = [];
    muts.forEach(m => {
      m.addedNodes.forEach(n => added.push(n));
      if (m.type==='attributes' && !counted.has(m.target)) scanEl(m.target);
    });
    if (added.length) scanNodes(added);
  });
  obs.observe(document.body, {
    childList:true, subtree:true, attributes:true,
    attributeFilter:['class','src','data-card','data-rank','data-face','data-value','alt','aria-label','title']
  });
}

function initialScan() {
  document.querySelectorAll(
    '[class*=card],[id*=card],[data-card],[data-rank],[data-face],img[alt],img[src*=card]'
  ).forEach(scanEl);
}

// ══════════════════════════════════════════════════════════════════════════
// INJECTAR injected.js no contexto da página
// ══════════════════════════════════════════════════════════════════════════
function injectPageScript() {
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('injected.js');
  s.onload = () => s.remove();
  (document.head || document.documentElement).appendChild(s);
}

// Ouvir mensagens do injected.js
window.addEventListener('message', e => {
  if (!e.data?.__hilo) return;
  if (e.data.card && autoEnabled) addCard(e.data.card, e.data.source || 'injected');
  if (e.data.type === 'CANVAS_CHANGED') {
    const vs = document.getElementById('hilo-visstatus');
    if (vs) { vs.textContent = '👁 Mudança detectada…'; vs.className = 'alert'; }
  }
});

// ══════════════════════════════════════════════════════════════════════════
// SCREENSHOTS do background
// ══════════════════════════════════════════════════════════════════════════
let prevFrame = null;
const offCanvas = document.createElement('canvas');
const offCtx   = offCanvas.getContext('2d');

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type !== 'SCREENSHOT') return;
  if (!visualEnabled) return;
  analyzeScreenshot(msg.dataUrl);
});

function analyzeScreenshot(dataUrl) {
  const img = new Image();
  img.onload = () => {
    const W = Math.min(img.width, 800), H = Math.min(img.height, 600);
    offCanvas.width = W; offCanvas.height = H;
    offCtx.drawImage(img, 0, 0, W, H);
    const curr = offCtx.getImageData(0, 0, W, H);
    if (prevFrame) {
      const diff = frameDiff(prevFrame, curr);
      if (diff > 4 && diff < 9000) {
        const vs = document.getElementById('hilo-visstatus');
        if (vs) { vs.textContent = '👁 Carta detectada!'; vs.className = 'alert'; }
      }
    }
    prevFrame = curr;
  };
  img.src = dataUrl;
}

function frameDiff(a, b) {
  let d = 0;
  const step = 16;
  for (let i = 0; i < a.data.length; i += 4*step) {
    d += Math.abs(a.data[i]   - b.data[i]);
    d += Math.abs(a.data[i+1] - b.data[i+1]);
    d += Math.abs(a.data[i+2] - b.data[i+2]);
  }
  return d / (a.data.length / (4*step));
}

// Parte 2 carregada em seguida...

// ══════════════════════════════════════════════════════════════════════════
// HUD — criação
// ══════════════════════════════════════════════════════════════════════════
function createHUD() {
  const hud = document.createElement('div');
  hud.id = 'hilo-hud';
  hud.innerHTML = `
<div id="hilo-header">
  <span id="hilo-title">♠ Hi-Lo Counter</span>
  <div id="hilo-hbtns">
    <button id="hilo-btn-mon" class="off" title="Monitorização visual">👁 OFF</button>
    <button id="hilo-btn-min" title="Minimizar">−</button>
    <button id="hilo-btn-close" title="Fechar">×</button>
  </div>
</div>
<div id="hilo-tabs">
  <div class="hilo-tab active" data-tab="count">Contagem</div>
  <div class="hilo-tab" data-tab="decision">Decisão</div>
  <div class="hilo-tab" data-tab="deck">Baralho</div>
</div>

<!-- TAB 1: CONTAGEM -->
<div class="hilo-panel active" id="hilo-panel-count">
  <div class="hilo-stats">
    <div class="hilo-sblock">
      <div class="hilo-slabel">Contagem</div>
      <div class="hilo-sval" id="hrc">0</div>
    </div>
    <div class="hilo-sblock">
      <div class="hilo-slabel">Cont. Verdadeira</div>
      <div class="hilo-sval" id="htc">0.0</div>
    </div>
    <div class="hilo-sblock">
      <div class="hilo-slabel">Cartas vistas</div>
      <div class="hilo-sval" id="hcd">0</div>
    </div>
    <div class="hilo-sblock">
      <div class="hilo-slabel">Vantagem</div>
      <div class="hilo-sval sm adv-neu" id="hadv">Neutro —</div>
    </div>
  </div>
  <div class="hilo-row">
    <span class="hilo-rlabel">Auto-detect:</span>
    <button class="hilo-toggle on" id="hilo-auto">ON</button>
    <span class="hilo-rlabel">Baralhos:</span>
    <select class="hilo-sel" id="hilo-decks">
      <option value="1">1</option><option value="2">2</option>
      <option value="4">4</option><option value="6" selected>6</option>
      <option value="8">8</option>
    </select>
  </div>
  <div id="hilo-visstatus" class="off">👁 Visual: desligado</div>
  <hr class="hilo-sep">
  <div class="hilo-slabel">Histórico recente</div>
  <div id="hilo-history"></div>
  <div class="hilo-row">
    <button id="hilo-reset">↺ Reset</button>
  </div>
  <div id="hilo-shortcuts-hint">Alt+↑ +1 · Alt+↓ -1 · Alt+→ 0 · Alt+R reset · Alt+H ocultar</div>
</div>

<!-- TAB 2: DECISÃO -->
<div class="hilo-panel" id="hilo-panel-decision">
  <div id="hilo-action-box">
    <div id="hilo-action-main">—</div>
    <div id="hilo-action-sub">Adicione cartas abaixo</div>
    <div id="hilo-action-dev"></div>
  </div>
  <div id="hilo-ins-box" style="display:none;background:#2e2a1a;color:#e3b341;border-radius:6px;padding:5px 8px;font-size:11px;text-align:center;"></div>

  <div class="hilo-hand-section">
    <div class="hilo-hand-label">Minha mão <span style="color:#8b949e;font-size:10px">(clique para remover)</span></div>
    <div class="hilo-hand-display" id="hilo-my-hand">
      <span class="hilo-card-chip placeholder">vazia</span>
    </div>
  </div>
  <div class="hilo-hand-section">
    <div class="hilo-hand-label">Carta do dealer</div>
    <div class="hilo-hand-display" id="hilo-dealer-hand">
      <span class="hilo-card-chip placeholder">nenhuma</span>
    </div>
  </div>

  <div class="hilo-slabel">Adicionar carta (minha mão):</div>
  <div id="hilo-picker-grid">
    <button class="hpick pv1"  data-r="2"  data-t="p">2</button>
    <button class="hpick pv1"  data-r="3"  data-t="p">3</button>
    <button class="hpick pv1"  data-r="4"  data-t="p">4</button>
    <button class="hpick pv1"  data-r="5"  data-t="p">5</button>
    <button class="hpick pv1"  data-r="6"  data-t="p">6</button>
    <button class="hpick pv0"  data-r="7"  data-t="p">7</button>
    <button class="hpick pv0"  data-r="8"  data-t="p">8</button>
    <button class="hpick pv0"  data-r="9"  data-t="p">9</button>
    <button class="hpick pvm1" data-r="10" data-t="p">10</button>
    <button class="hpick pvm1" data-r="J"  data-t="p">J</button>
    <button class="hpick pvm1" data-r="Q"  data-t="p">Q</button>
    <button class="hpick pvm1" data-r="K"  data-t="p">K</button>
    <button class="hpick pvm1" data-r="A"  data-t="p">A</button>
  </div>

  <div class="hilo-slabel" style="margin-top:4px">Carta do dealer:</div>
  <div id="hilo-picker-grid" style="margin-bottom:2px">
    <button class="hpick pv1"  data-r="2"  data-t="d">2</button>
    <button class="hpick pv1"  data-r="3"  data-t="d">3</button>
    <button class="hpick pv1"  data-r="4"  data-t="d">4</button>
    <button class="hpick pv1"  data-r="5"  data-t="d">5</button>
    <button class="hpick pv1"  data-r="6"  data-t="d">6</button>
    <button class="hpick pv0"  data-r="7"  data-t="d">7</button>
    <button class="hpick pv0"  data-r="8"  data-t="d">8</button>
    <button class="hpick pv0"  data-r="9"  data-t="d">9</button>
    <button class="hpick pvm1" data-r="10" data-t="d">10</button>
    <button class="hpick pvm1" data-r="J"  data-t="d">J</button>
    <button class="hpick pvm1" data-r="Q"  data-t="d">Q</button>
    <button class="hpick pvm1" data-r="K"  data-t="d">K</button>
    <button class="hpick pvm1" data-r="A"  data-t="d">A</button>
  </div>

  <div class="hilo-hand-actions">
    <button class="hhand-btn" id="hilo-clear-hand">🗑 Limpar mão</button>
    <button class="hhand-btn primary" id="hilo-calc">⚡ Calcular</button>
  </div>
</div>

<!-- TAB 3: BARALHO -->
<div class="hilo-panel" id="hilo-panel-deck">
  <div id="hilo-bet-box">
    <div id="hilo-bet-icon">💰</div>
    <div id="hilo-bet-info">
      <div id="hilo-bet-main">1× mínimo</div>
      <div id="hilo-bet-sub">TC neutro — apostar mínimo</div>
    </div>
  </div>
  <div id="hilo-join-box" class="wait">⚖️ NEUTRO — apostar mínimo</div>
  <hr class="hilo-sep">
  <div class="hilo-slabel">Composição do baralho</div>
  <div class="hilo-comp-row">
    <div class="hilo-comp-label">
      <span id="hc-low-pct">Baixas (2-6): —%</span>
      <span id="hc-high-pct">Altas (10-A): —%</span>
    </div>
    <div class="hilo-comp-bar">
      <div class="hilo-comp-low"  id="hc-low-bar"  style="width:33%"></div>
      <div class="hilo-comp-neu"  id="hc-neu-bar"  style="width:23%"></div>
      <div class="hilo-comp-high" id="hc-high-bar" style="width:44%"></div>
    </div>
  </div>
  <div class="hilo-slabel" style="margin-top:4px">Cartas restantes estimadas</div>
  <div id="hilo-ranks-grid"></div>
</div>
`;
  document.body.appendChild(hud);
  makeDraggable(hud);
  bindHUDEvents(hud);
  return hud;
}

// ══════════════════════════════════════════════════════════════════════════
// EVENTOS DO HUD
// ══════════════════════════════════════════════════════════════════════════
function bindHUDEvents(hud) {
  // Tabs
  hud.querySelectorAll('.hilo-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      hud.querySelectorAll('.hilo-tab').forEach(t => t.classList.toggle('active', t===tab));
      hud.querySelectorAll('.hilo-panel').forEach(p => p.classList.remove('active'));
      hud.querySelector(`#hilo-panel-${activeTab}`)?.classList.add('active');
    });
  });

  // Minimizar
  hud.querySelector('#hilo-btn-min').addEventListener('click', () => {
    isMinimized = !isMinimized;
    hud.querySelector('#hilo-tabs').style.display        = isMinimized ? 'none' : '';
    hud.querySelectorAll('.hilo-panel').forEach(p => p.style.display = isMinimized ? 'none' : '');
    hud.querySelector('#hilo-btn-min').textContent = isMinimized ? '+' : '−';
  });

  // Fechar
  hud.querySelector('#hilo-btn-close').addEventListener('click', () => hud.remove());

  // Auto-detect toggle
  hud.querySelector('#hilo-auto').addEventListener('click', function() {
    autoEnabled = !autoEnabled;
    this.textContent = autoEnabled ? 'ON' : 'OFF';
    this.classList.toggle('on', autoEnabled);
    this.classList.toggle('off', !autoEnabled);
  });

  // Visual monitor toggle
  hud.querySelector('#hilo-btn-mon').addEventListener('click', function() {
    visualEnabled = !visualEnabled;
    this.textContent = visualEnabled ? '👁 ON' : '👁 OFF';
    this.classList.toggle('off', !visualEnabled);
    const vs = document.getElementById('hilo-visstatus');
    if (vs) { vs.textContent = visualEnabled ? '👁 A monitorizar…' : '👁 Visual: desligado'; vs.className = visualEnabled ? '' : 'off'; }
    chrome.tabs.getCurrent?.((tab) => {
      if (tab) chrome.runtime.sendMessage({ type: visualEnabled ? 'START_CAPTURE' : 'STOP_CAPTURE', tabId: tab.id });
    });
    // fallback: pede ao background via activeTab
    chrome.runtime.sendMessage({ type: visualEnabled ? 'START_CAPTURE' : 'STOP_CAPTURE', tabId: 0 });
  });

  // Baralhos
  hud.querySelector('#hilo-decks').addEventListener('change', e => {
    numDecks = parseInt(e.target.value);
    resetDeckComp();
    updateAll();
  });

  // Reset
  hud.querySelector('#hilo-reset').addEventListener('click', resetAll);

  // Pickers de carta (mão do jogador e dealer)
  hud.querySelectorAll('.hpick').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = btn.dataset.r;
      const t = btn.dataset.t;
      if (t === 'p') {
        playerHand.push(r);
      } else {
        dealerCard = r; // só uma carta do dealer
      }
      updateDecisionTab();
    });
  });

  // Remover carta da mão ao clicar
  hud.querySelector('#hilo-my-hand').addEventListener('click', e => {
    const chip = e.target.closest('.hilo-card-chip:not(.placeholder)');
    if (!chip) return;
    const idx = parseInt(chip.dataset.idx);
    if (!isNaN(idx)) { playerHand.splice(idx, 1); updateDecisionTab(); }
  });

  hud.querySelector('#hilo-dealer-hand').addEventListener('click', e => {
    if (e.target.closest('.hilo-card-chip:not(.placeholder)')) {
      dealerCard = null; updateDecisionTab();
    }
  });

  // Limpar mão
  hud.querySelector('#hilo-clear-hand').addEventListener('click', () => {
    playerHand = []; dealerCard = null; updateDecisionTab();
  });

  // Calcular
  hud.querySelector('#hilo-calc').addEventListener('click', updateDecisionTab);
}

// ══════════════════════════════════════════════════════════════════════════
// ACTUALIZAÇÃO DO HUD
// ══════════════════════════════════════════════════════════════════════════
function updateAll() {
  updateCountTab();
  updateDecisionTab();
  updateDeckTab();
}

function updateCountTab() {
  const rc = document.getElementById('hrc');
  const tc = document.getElementById('htc');
  const cd = document.getElementById('hcd');
  const adv = document.getElementById('hadv');
  const hist = document.getElementById('hilo-history');
  if (!rc) return;

  rc.textContent = (runningCount > 0 ? '+' : '') + runningCount;
  rc.className   = 'hilo-sval ' + (runningCount > 0 ? 'pos' : runningCount < 0 ? 'neg' : '');

  const tv = trueCount();
  tc.textContent = (tv > 0 ? '+' : '') + tv.toFixed(1);
  tc.className   = 'hilo-sval ' + (tv > 0 ? 'pos' : tv < 0 ? 'neg' : '');

  cd.textContent = cardsDealt;

  const a = advantageInfo();
  adv.textContent = a.txt;
  adv.className   = 'hilo-sval sm ' + a.cls;

  if (hist) {
    hist.innerHTML = history.slice(0,12).map(h => {
      const cls = h.hv > 0 ? 'p' : h.hv < 0 ? 'n' : 'z';
      const sign = h.hv > 0 ? '+' : '';
      const cnt  = h.count > 0 ? '+' + h.count : h.count;
      return `<span class="hchip ${cls}" title="${h.source}">${h.rank} ${sign}${h.hv} [${cnt}]</span>`;
    }).join('');
  }
}

function updateDecisionTab() {
  const myHandEl  = document.getElementById('hilo-my-hand');
  const dealerEl  = document.getElementById('hilo-dealer-hand');
  const actionBox = document.getElementById('hilo-action-box');
  const actionMain = document.getElementById('hilo-action-main');
  const actionSub  = document.getElementById('hilo-action-sub');
  const actionDev  = document.getElementById('hilo-action-dev');
  const insBox     = document.getElementById('hilo-ins-box');
  if (!myHandEl) return;

  // Render mão do jogador
  if (playerHand.length === 0) {
    myHandEl.innerHTML = '<span class="hilo-card-chip placeholder">vazia</span>';
  } else {
    const total = handValue(playerHand);
    myHandEl.innerHTML = playerHand.map((r,i) => {
      const red = ['A','Q','J'].includes(r) ? ' red' : '';
      return `<span class="hilo-card-chip${red}" data-idx="${i}">${r}</span>`;
    }).join('') + `<span style="font-size:11px;color:#8b949e;margin-left:4px">= ${total}</span>`;
  }

  // Render carta do dealer
  if (!dealerCard) {
    dealerEl.innerHTML = '<span class="hilo-card-chip placeholder">nenhuma</span>';
  } else {
    dealerEl.innerHTML = `<span class="hilo-card-chip dealer">${dealerCard}</span>`;
  }

  // Calcular conselho
  if (playerHand.length === 0 || !dealerCard) {
    actionBox.className = '';
    actionMain.textContent = '—';
    actionSub.textContent  = 'Adicione cartas acima';
    actionDev.textContent  = '';
    if (insBox) insBox.style.display = 'none';
    return;
  }

  const advice = getAdvice(playerHand, dealerCard);
  if (!advice) return;

  const lbl = ACTION_LABELS[advice.action] || ACTION_LABELS['H'];
  actionBox.className = lbl.cls;
  actionMain.textContent = lbl.pt;
  actionSub.textContent  = lbl.en + (advice.action==='DS'?' (dobrar ou parar)':advice.action==='SU'?' (render ou pedir)':'');
  actionDev.textContent  = advice.devNote || '';

  if (insBox) {
    if (advice.insurance) {
      insBox.textContent  = '🛡 ' + advice.insurance;
      insBox.style.display = '';
    } else {
      insBox.style.display = 'none';
    }
  }
}

function updateDeckTab() {
  const betMain = document.getElementById('hilo-bet-main');
  const betSub  = document.getElementById('hilo-bet-sub');
  const joinBox = document.getElementById('hilo-join-box');
  const lowBar  = document.getElementById('hc-low-bar');
  const neuBar  = document.getElementById('hc-neu-bar');
  const highBar = document.getElementById('hc-high-bar');
  const lowPct  = document.getElementById('hc-low-pct');
  const highPct = document.getElementById('hc-high-pct');
  const ranksGrid = document.getElementById('hilo-ranks-grid');
  if (!betMain) return;

  const mult = betMultiplier();
  const tv   = trueCount();
  betMain.textContent = mult === 1 ? '1× mínimo' : `${mult}× mínimo`;
  betSub.textContent  = tv >= 2 ? `TC ${tv > 0 ? '+' : ''}${tv.toFixed(1)} — boa oportunidade!`
                                 : tv < 0 ? `TC ${tv.toFixed(1)} — mesa fria`
                                 : `TC ${tv.toFixed(1)} — neutro`;

  const ja = joinAdvice();
  if (joinBox) { joinBox.textContent = ja.txt; joinBox.className = ja.cls; }

  // Barras de composição
  const low  = (deckComp[2]||0)+(deckComp[3]||0)+(deckComp[4]||0)+(deckComp[5]||0)+(deckComp[6]||0);
  const neu  = (deckComp[7]||0)+(deckComp[8]||0)+(deckComp[9]||0);
  const high = (deckComp[10]||0)+(deckComp['A']||0);
  const total = low + neu + high || 1;
  const lp = (low/total*100).toFixed(0), np = (neu/total*100).toFixed(0), hp = (high/total*100).toFixed(0);
  if (lowBar)  lowBar.style.width  = lp + '%';
  if (neuBar)  neuBar.style.width  = np + '%';
  if (highBar) highBar.style.width = hp + '%';
  if (lowPct)  lowPct.textContent  = `Baixas (2-6): ${lp}%`;
  if (highPct) highPct.textContent = `Altas (10-A): ${hp}%`;

  // Grid de ranks
  if (ranksGrid) {
    const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    const maxPerRank = numDecks * 4;
    ranksGrid.innerHTML = ranks.map(r => {
      const key = ['J','Q','K'].includes(r) ? '10' : r;
      const rem = deckComp[key] !== undefined ? deckComp[key] : maxPerRank;
      const depClass = rem === 0 ? ' depleted' : rem > maxPerRank * 0.7 ? ' high-rem' : '';
      return `<div class="hrank${depClass}"><div class="hr-name">${r}</div><div class="hr-val">${rem}</div></div>`;
    }).join('');
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ARRASTAR
// ══════════════════════════════════════════════════════════════════════════
function makeDraggable(el) {
  const header = el.querySelector('#hilo-header');
  let drag = false, ox = 0, oy = 0;
  header.addEventListener('mousedown', e => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return;
    drag = true;
    const r = el.getBoundingClientRect();
    ox = e.clientX - r.left; oy = e.clientY - r.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!drag) return;
    el.style.left = (e.clientX - ox) + 'px';
    el.style.top  = (e.clientY - oy) + 'px';
    el.style.right = 'auto'; el.style.bottom = 'auto';
  });
  document.addEventListener('mouseup', () => { drag = false; });
}

// ══════════════════════════════════════════════════════════════════════════
// ATALHOS DE TECLADO
// ══════════════════════════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (!e.altKey) return;
  switch (e.key) {
    case 'ArrowUp':    addCard('6', 'key'); e.preventDefault(); break;
    case 'ArrowDown':  addCard('A', 'key'); e.preventDefault(); break;
    case 'ArrowRight': addCard('8', 'key'); e.preventDefault(); break;
    case 'r': case 'R': resetAll(); e.preventDefault(); break;
    case 'h': case 'H': {
      const hud = document.getElementById('hilo-hud');
      if (hud) hud.style.opacity = hud.style.opacity === '0.1' ? '1' : '0.1';
      e.preventDefault(); break;
    }
  }
});

// ══════════════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════════════
injectPageScript();
createHUD();
initObserver();
setTimeout(initialScan, 800);
updateAll();

})();
