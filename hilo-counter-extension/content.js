/**
 * content.js
 * NAO toca no codigo do site. NAO usa MutationObserver. NAO injeta scripts.
 * So adiciona um HUD por cima do jogo e recebe avisos do background.
 */
(function () {
'use strict';
if (document.getElementById('hilo-hud')) return;

// ── Estado ──────────────────────────────────────────────────────────────────
let rc = 0, dealt = 0, numDecks = 6;
let history = [], playerHand = [], dealerCard = null;
let monitoring = false, alertVisible = false;
const seenEls = new WeakSet();

function normalizeRank(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase().split(/[\s♠♥♦♣]/)[0];
  const MAP = {'1':'A','11':'J','12':'Q','13':'K',
    'ACE':'A','JACK':'J','QUEEN':'Q','KING':'K',
    'TWO':'2','THREE':'3','FOUR':'4','FIVE':'5',
    'SIX':'6','SEVEN':'7','EIGHT':'8','NINE':'9','TEN':'10'};
  const v = MAP[s] || s;
  return HILO[v] !== undefined ? v : null;
}

// ── Hi-Lo ────────────────────────────────────────────────────────────────────
const HILO = {'2':1,'3':1,'4':1,'5':1,'6':1,'7':0,'8':0,'9':0,'10':-1,'J':-1,'Q':-1,'K':-1,'A':-1};
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const rankCls = r => HILO[r] > 0 ? 'pv1' : HILO[r] < 0 ? 'pvm1' : 'pv0';

function addCard(rank, source) {
  const hv = HILO[rank];
  if (hv === undefined) return;
  rc += hv; dealt++;
  history.unshift({ rank, hv, rc, source });
  if (history.length > 20) history.pop();
  render(); hideAlert();
}

function resetAll() { rc = 0; dealt = 0; history = []; playerHand = []; dealerCard = null; render(); }

function tc() { return rc / Math.max(0.5, (numDecks * 52 - dealt) / 52); }

// ── Estrategia Basica (6 baralhos S17) ───────────────────────────────────────
const DI = {'2':0,'3':1,'4':2,'5':3,'6':4,'7':5,'8':6,'9':7,'10':8,'J':8,'Q':8,'K':8,'A':9};
const HARD = {
   8:'H H H H H H H H H H', 9:'H D D D D H H H H H',
  10:'D D D D D D D D H H',11:'D D D D D D D D D H',
  12:'H H S S S H H H H H',13:'S S S S S H H H H H',
  14:'S S S S S H H H H H',15:'S S S S S H H H SU H',
  16:'S S S S S H H SU SU SU',17:'S S S S S S S S S S',
};
const SOFT = {
  2:'H H H D D H H H H H',3:'H H H D D H H H H H',
  4:'H H D D D H H H H H',5:'H H D D D H H H H H',
  6:'H D D D D H H H H H',7:'DS DS DS DS DS S S H H H',
  8:'S S S S S S S S S S',9:'S S S S S S S S S S',
};
const PAIR = {
  'A':'SP SP SP SP SP SP SP SP SP SP','2':'SP SP SP SP SP SP H H H H',
  '3':'SP SP SP SP SP SP H H H H','4':'H H H SP SP H H H H H',
  '5':'D D D D D D D D H H','6':'SP SP SP SP SP H H H H H',
  '7':'SP SP SP SP SP SP H H H H','8':'SP SP SP SP SP SP SP SP SP SP',
  '9':'SP SP SP SP SP S SP SP S S','10':'S S S S S S S S S S',
};
const DEVS=[
  {d:'16 vs T',h:16,di:8,tc:0,a:'S'},{d:'15 vs T',h:15,di:8,tc:4,a:'S'},
  {d:'12 vs 3',h:12,di:1,tc:2,a:'S'},{d:'12 vs 2',h:12,di:0,tc:3,a:'S'},
  {d:'11 vs A',h:11,di:9,tc:1,a:'D'},{d:'10 vs A',h:10,di:9,tc:4,a:'D'},
  {d:'9 vs 2', h:9, di:0,tc:1,a:'D'},
];
const LABELS={H:'PEDIR',S:'PARAR',D:'DOBRAR',DS:'DOBRAR',SP:'DIVIDIR',SU:'RENDER',RS:'RENDER'};
const COLORS={H:'#58a6ff',S:'#3fb950',D:'#e3b341',DS:'#e3b341',SP:'#bc8cff',SU:'#e94560',RS:'#e94560'};

function handVal(cards) {
  let t=0,aces=0;
  for(const r of cards){
    if(r==='A'){t+=11;aces++;}
    else if(['J','Q','K'].includes(r))t+=10;
    else t+=parseInt(r)||0;
    while(t>21&&aces>0){t-=10;aces--;}
  }
  return t;
}

function advice() {
  if (!playerHand.length || !dealerCard) return null;
  const di = DI[dealerCard]; if(di===undefined)return null;
  const cur = tc();
  const ins = (dealerCard==='A'&&cur>=3)?'Fazer seguro (TC >= 3)':null;
  if(playerHand.length===2&&playerHand[0]===playerHand[1]){
    const pk=['J','Q','K'].includes(playerHand[0])?'10':playerHand[0];
    return {act:(PAIR[pk]||'').split(' ')[di]||'H',ins};
  }
  const total=handVal(playerHand);
  const hasAce=playerHand.includes('A');
  if(hasAce&&total<=21){
    const sx=total-11;
    if(sx>=2&&sx<=9)return{act:(SOFT[sx]||'').split(' ')[di]||'H',ins};
  }
  const hk=Math.min(Math.max(total,8),17);
  const dev=DEVS.find(d=>d.h===hk&&d.di===di&&cur>=d.tc);
  if(dev)return{act:dev.a,ins,dev:`Desvio: ${dev.d}`};
  return{act:(HARD[hk]||'').split(' ')[di]||'S',ins};
}

function betInfo(){
  const t=tc();
  if(t>=5)return{mult:'12x',tip:'TC muito alto — aposta maxima!',join:'join'};
  if(t>=4)return{mult:'8x', tip:'TC alto — boa oportunidade',    join:'join'};
  if(t>=3)return{mult:'4x', tip:'TC favoravel',                  join:'join'};
  if(t>=2)return{mult:'2x', tip:'TC ligeiramente favoravel',     join:'join'};
  if(t>=0)return{mult:'1x', tip:'TC neutro — aposta minimo',     join:'wait'};
  return       {mult:'1x', tip:'TC negativo — considere sair',  join:'leave'};
}

function advText(){
  const t=tc();
  if(t>=4) return{txt:'Alta ++ up up',col:'#56d364'};
  if(t>=2) return{txt:'Favoravel up', col:'#3fb950'};
  if(t<=-4)return{txt:'Pessimo down', col:'#e94560'};
  if(t<=-2)return{txt:'Desfav. down', col:'#f78166'};
  return       {txt:'Neutro',        col:'#8b949e'};
}

// ── HUD ──────────────────────────────────────────────────────────────────────
function pickerHTML(ctx) {
  return RANKS.map(r=>`<button class="hpick ${rankCls(r)}" data-r="${r}" data-ctx="${ctx}">${r}</button>`).join('');
}

function createHUD() {
  const hud = document.createElement('div');
  hud.id = 'hilo-hud';
  hud.innerHTML = `
<div id="hilo-header">
  <span id="hilo-title">&#9824; Hi-Lo Counter</span>
  <div id="hilo-hbtns">
    <button id="hbtn-mon">&#128065; OFF</button>
    <button id="hbtn-min">&#8722;</button>
    <button id="hbtn-x">&#215;</button>
  </div>
</div>
<div id="hilo-tabs">
  <div class="htab active" data-p="count">Contagem</div>
  <div class="htab" data-p="dec">Decisao</div>
  <div class="htab" data-p="bet">Aposta</div>
</div>

<div class="hpanel active" id="hp-count">
  <div class="hgrid2">
    <div class="hblock"><div class="hbl">Contagem</div><div class="hbv" id="h-rc">0</div></div>
    <div class="hblock"><div class="hbl">Cont. Verdadeira</div><div class="hbv" id="h-tc">0.0</div></div>
    <div class="hblock"><div class="hbl">Cartas vistas</div><div class="hbv" id="h-cd">0</div></div>
    <div class="hblock"><div class="hbl">Vantagem</div><div class="hbv sm" id="h-adv">Neutro</div></div>
  </div>
  <div id="hilo-alert" style="display:none">
    <div id="hilo-alert-txt">Carta nova detectada — qual foi?</div>
    <div class="hpickrow" id="h-alert-picks">${pickerHTML('alert')}</div>
  </div>
  <div class="hrow">
    <span class="hrl">Baralhos:</span>
    <select class="hsel" id="h-decks">
      <option value="1">1</option><option value="2">2</option>
      <option value="4">4</option><option value="6" selected>6</option>
      <option value="8">8</option>
    </select>
    <button class="hbtn-sm" id="h-reset">&#8635; Reset</button>
  </div>
  <div id="h-hist"></div>
  <div id="h-mon-st">&#128065; Desligado — clique em OFF para ligar</div>
  <div class="hshort">Alt+seta cima +1 | baixo -1 | direita 0 | R reset | H ocultar</div>
</div>

<div class="hpanel" id="hp-dec">
  <div id="h-actbox">
    <div id="h-actmain">&#8212;</div>
    <div id="h-actsub">Adicione cartas abaixo</div>
    <div id="h-actdev"></div>
    <div id="h-actins" style="display:none"></div>
  </div>
  <div class="hbl" style="margin-top:6px">Minha mao (clique para remover)</div>
  <div class="hhand" id="h-myhand"></div>
  <div class="hbl" style="margin-top:4px">Carta do dealer</div>
  <div class="hhand" id="h-dealhand"></div>
  <div class="hbl" style="margin-top:6px">Adicionar a minha mao:</div>
  <div class="hpickrow">${pickerHTML('player')}</div>
  <div class="hbl" style="margin-top:4px">Carta do dealer:</div>
  <div class="hpickrow">${pickerHTML('dealer')}</div>
  <div class="hrow" style="margin-top:6px">
    <button class="hbtn-sm" id="h-clrhand">Limpar mao</button>
  </div>
</div>

<div class="hpanel" id="hp-bet">
  <div id="h-betbox">
    <div id="h-betmult">1x minimo</div>
    <div id="h-bettip">TC neutro</div>
  </div>
  <div id="h-joinbox" class="wait">Neutro — apostar minimo</div>
  <div class="hbl" style="margin-top:8px">Registar carta vista:</div>
  <div class="hpickrow">${pickerHTML('manual')}</div>
</div>
`;
  document.body.appendChild(hud);
  makeDraggable(hud);
  bindEvents(hud);
  render();
}

function bindEvents(hud) {
  hud.querySelectorAll('.htab').forEach(tab =>
    tab.addEventListener('click', () => {
      hud.querySelectorAll('.htab').forEach(t=>t.classList.toggle('active',t===tab));
      hud.querySelectorAll('.hpanel').forEach(p=>p.classList.toggle('active',p.id==='hp-'+tab.dataset.p));
    })
  );

  let mini=false;
  hud.querySelector('#hbtn-min').addEventListener('click',()=>{
    mini=!mini;
    hud.querySelector('#hilo-tabs').style.display=mini?'none':'';
    hud.querySelectorAll('.hpanel').forEach(p=>p.style.display=mini?'none':'');
    hud.querySelector('#hbtn-min').innerHTML=mini?'&#43;':'&#8722;';
  });

  hud.querySelector('#hbtn-x').addEventListener('click',()=>hud.remove());
  hud.querySelector('#hbtn-mon').addEventListener('click',toggleMonitor);
  hud.querySelector('#h-decks').addEventListener('change',e=>{numDecks=parseInt(e.target.value);render();});
  hud.querySelector('#h-reset').addEventListener('click',resetAll);
  hud.querySelector('#h-clrhand').addEventListener('click',()=>{playerHand=[];dealerCard=null;render();});

  hud.querySelector('#h-myhand').addEventListener('click',e=>{
    const c=e.target.closest('[data-idx]');
    if(c){playerHand.splice(parseInt(c.dataset.idx),1);render();}
  });
  hud.querySelector('#h-dealhand').addEventListener('click',()=>{dealerCard=null;render();});

  hud.addEventListener('click',e=>{
    const btn=e.target.closest('.hpick');
    if(!btn)return;
    const r=btn.dataset.r, ctx=btn.dataset.ctx;
    if(ctx==='player'||ctx==='alert'){playerHand.push(r);addCard(r,'manual');}
    else if(ctx==='dealer'){dealerCard=r;render();}
    else if(ctx==='manual'){addCard(r,'manual');}
  });
}

function toggleMonitor(){
  monitoring=!monitoring;
  const btn=document.getElementById('hbtn-mon');
  const st=document.getElementById('h-mon-st');
  if(btn)btn.innerHTML=monitoring?'&#128065; ON':'&#128065; OFF';
  if(st){st.textContent=monitoring?'A monitorizar o ecra...':'Desligado — clique em OFF para ligar';st.className=monitoring?'mon-on':'';}
  chrome.runtime.sendMessage({type:monitoring?'START_CAPTURE':'STOP_CAPTURE',tabId:0});
}

chrome.runtime.onMessage.addListener(msg=>{
  if(msg.type!=='SCREEN_CHANGED'||!monitoring)return;
  tryAutoDetect(msg.level);
});

function tryAutoDetect(level) {
  if (level === 'big') { playerHand = []; dealerCard = null; }

  const found = [];

  // Estratégia 1: atributos data-card / data-rank / data-value / data-face
  document.querySelectorAll('[data-card],[data-rank],[data-value],[data-face]').forEach(el => {
    if (seenEls.has(el) || el.closest('#hilo-hud')) return;
    const raw = el.dataset.card || el.dataset.rank || el.dataset.value || el.dataset.face;
    const r = normalizeRank(raw);
    if (r) { seenEls.add(el); found.push(r); }
  });

  // Estratégia 2: elementos .card / [class*="card"] com texto curto (<=3 chars)
  document.querySelectorAll('.card,[class*="card"],[class*="Card"]').forEach(el => {
    if (seenEls.has(el) || el.closest('#hilo-hud')) return;
    const txt = (el.textContent || '').trim().split(/\s/)[0];
    if (txt.length > 3) return;
    const r = normalizeRank(txt);
    if (r) { seenEls.add(el); found.push(r); }
  });

  // Estratégia 3: aria-label / alt com "of " (ex: "King of Spades")
  document.querySelectorAll('[aria-label*=" of "],[alt*=" of "]').forEach(el => {
    if (seenEls.has(el) || el.closest('#hilo-hud')) return;
    const txt = el.getAttribute('aria-label') || el.getAttribute('alt') || '';
    const r = normalizeRank(txt.split(/\s/)[0]);
    if (r) { seenEls.add(el); found.push(r); }
  });

  if (found.length) { found.forEach(r => addCard(r, 'auto')); return; }
  showAlert(level);  // fallback: picker manual
}

function showAlert(level){
  if(alertVisible)return;
  alertVisible=true;
  const box=document.getElementById('hilo-alert');
  const txt=document.getElementById('hilo-alert-txt');
  if(box)box.style.display='';
  if(txt)txt.textContent=level==='big'?'Nova ronda — qual carta saiu?':'Carta detectada — clique para registar:';
  setTimeout(hideAlert,8000);
}

function hideAlert(){
  alertVisible=false;
  const box=document.getElementById('hilo-alert');
  if(box)box.style.display='none';
}

function render(){
  const tv=tc(),av=advText(),bi=betInfo(),adv=advice();
  const g=id=>document.getElementById(id);

  const erc=g('h-rc'); if(erc){erc.textContent=(rc>0?'+':'')+rc;erc.style.color=rc>0?'#3fb950':rc<0?'#e94560':'#c9d1d9';}
  const etc=g('h-tc'); if(etc){etc.textContent=(tv>0?'+':'')+tv.toFixed(1);etc.style.color=tv>0?'#3fb950':tv<0?'#e94560':'#c9d1d9';}
  const ecd=g('h-cd'); if(ecd)ecd.textContent=dealt;
  const eadv=g('h-adv'); if(eadv){eadv.textContent=av.txt;eadv.style.color=av.col;}

  const eh=g('h-hist');
  if(eh)eh.innerHTML=history.slice(0,12).map(h=>`<span class="hchip ${h.hv>0?'p':h.hv<0?'n':'z'}">${h.rank} ${h.hv>0?'+':''}${h.hv}</span>`).join('');

  const mh=g('h-myhand');
  if(mh)mh.innerHTML=playerHand.length
    ?playerHand.map((r,i)=>`<span class="hcard${['J','Q','K','A'].includes(r)?' red':''}" data-idx="${i}">${r}</span>`).join('')
      +`<span class="htotal">= ${handVal(playerHand)}</span>`
    :'<span class="hph">vazia</span>';

  const dh=g('h-dealhand');
  if(dh)dh.innerHTML=dealerCard?`<span class="hcard dealer">${dealerCard}</span>`:'<span class="hph">nenhuma</span>';

  const am=g('h-actmain'),as=g('h-actsub'),ad=g('h-actdev'),ai=g('h-actins'),ab=g('h-actbox');
  if(am){
    if(adv){
      const a=adv.act;
      am.textContent=LABELS[a]||a; am.style.color=COLORS[a]||'#c9d1d9';
      if(as)as.textContent=a==='DS'?'Dobrar ou parar':a==='SU'?'Render ou pedir':'';
      if(ad)ad.textContent=adv.dev||'';
      if(ai){ai.textContent=adv.ins||'';ai.style.display=adv.ins?'':'none';}
      if(ab)ab.style.borderColor=COLORS[a]||'#30363d';
    } else {
      am.textContent='—';am.style.color='#8b949e';
      if(as)as.textContent='Adicione cartas acima';
      if(ad)ad.textContent='';if(ai)ai.style.display='none';
    }
  }

  const bm=g('h-betmult'),bt=g('h-bettip'),jb=g('h-joinbox');
  if(bm)bm.textContent=bi.mult;
  if(bt)bt.textContent=bi.tip;
  if(jb){
    const MAP={join:'ENTRAR — mesa favoravel',wait:'NEUTRO — apostar minimo',leave:'SAIR — mesa desfavoravel'};
    jb.textContent=MAP[bi.join];jb.className=bi.join;
  }
}

function makeDraggable(el){
  const hdr=el.querySelector('#hilo-header');
  let drag=false,ox=0,oy=0;
  hdr.addEventListener('mousedown',e=>{
    if(['BUTTON','SELECT'].includes(e.target.tagName))return;
    drag=true;const r=el.getBoundingClientRect();ox=e.clientX-r.left;oy=e.clientY-r.top;e.preventDefault();
  });
  document.addEventListener('mousemove',e=>{if(!drag)return;el.style.left=(e.clientX-ox)+'px';el.style.top=(e.clientY-oy)+'px';el.style.right='auto';el.style.bottom='auto';});
  document.addEventListener('mouseup',()=>{drag=false;});
}

document.addEventListener('keydown',e=>{
  if(!e.altKey)return;
  if(e.key==='ArrowUp'){addCard('6','key');e.preventDefault();}
  if(e.key==='ArrowDown'){addCard('A','key');e.preventDefault();}
  if(e.key==='ArrowRight'){addCard('8','key');e.preventDefault();}
  if(e.key==='r'||e.key==='R'){resetAll();e.preventDefault();}
  if(e.key==='h'||e.key==='H'){
    const h=document.getElementById('hilo-hud');
    if(h)h.style.opacity=h.style.opacity==='0.15'?'1':'0.15';
    e.preventDefault();
  }
});

createHUD();
})();
