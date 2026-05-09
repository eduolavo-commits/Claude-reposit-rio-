import { getState, update, uid, findChannel, findQueue } from '../state.js';
import { openModal, modalShell, toast } from '../components.js';
import { icon } from '../icons.js';

let editingId = null;
let testHistory = []; // [{from:'me'|'ai', text}]

const ROLES = [
  { id:'SDR',           label:'SDR',           desc:'Qualifica leads novos e agenda reuniões'},
  { id:'Inside Sales',  label:'Inside Sales',  desc:'Conduz a venda até o fechamento'},
  { id:'Recuperação',   label:'Recuperação',   desc:'Reengaja clientes inativos / recupera vendas perdidas'},
  { id:'Suporte',       label:'Suporte',       desc:'Atende dúvidas e abre tickets'},
  { id:'Pós-Venda',     label:'Pós-Venda',     desc:'Acompanha pós-compra e gera upsell'},
  { id:'Cobrança',      label:'Cobrança',      desc:'Negocia inadimplência'},
  { id:'Agendamento',   label:'Agendamento',   desc:'Marca consultas/serviços'},
];

const MODELS = [
  { id:'claude-opus-4-7', label:'Claude Opus 4.7 (mais inteligente)' },
  { id:'claude-sonnet-4-6', label:'Claude Sonnet 4.6 (equilíbrio)' },
  { id:'claude-haiku-4-5-20251001', label:'Claude Haiku 4.5 (mais rápido/barato)' },
];

export function AgentesView() {
  if (editingId) return AgentEditor();

  const s = getState();
  return `
    <div class="flex-1 overflow-auto p-6 bg-slate-100">
      <div class="max-w-[1200px] mx-auto">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h1 class="text-xl font-bold flex items-center gap-2">${icon('bot',{size:22,cls:'text-violet-600'})} Agentes IA</h1>
            <div class="text-sm text-slate-500">Atendentes virtuais integrados ao Claude — crie um por função</div>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn btn-ghost" data-action="config-claude">${icon('key',{size:14})} Configurar Claude</button>
            <button class="btn btn-violet" data-action="new-agent">${icon('plus',{size:14})} Novo agente</button>
          </div>
        </div>

        <div class="card p-4 mb-5 flex items-center gap-3 border-l-4 border-violet-500">
          ${icon('sparkles',{size:20,cls:'text-violet-600'})}
          <div class="flex-1">
            <div class="font-semibold text-sm">Atendimento humanizado com IA</div>
            <div class="text-xs text-slate-500">Cada agente tem prompt, modelo, fila e regras de handoff próprias. Ele atende automaticamente conversas atribuídas e transfere para humano quando necessário.</div>
          </div>
          <div class="text-xs text-slate-500">Status:
            <span class="pill pill-green">${s.agents.filter(a=>a.active).length} ativos</span>
            <span class="pill pill-gray">${s.agents.filter(a=>!a.active).length} pausados</span>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4">
          ${s.agents.map(a => `
            <div class="card p-4 hover:shadow-md transition cursor-pointer" data-edit-agent="${a.id}">
              <div class="flex items-start justify-between mb-3">
                <div class="text-3xl">${a.emoji}</div>
                <span class="pill ${a.active?'pill-green':'pill-gray'}">${a.active?'Ativo':'Pausado'}</span>
              </div>
              <div class="font-semibold">${a.name}</div>
              <span class="pill pill-violet text-[10px] mt-1">${a.role}</span>
              <div class="text-xs text-slate-500 mt-2 line-clamp-2 min-h-[2.5em]">${a.goal}</div>
              <div class="mt-3 pt-3 border-t border-slate-100 text-xs space-y-1">
                <div class="flex items-center gap-1.5"><span class="text-slate-400">Modelo:</span> <span class="font-mono text-[11px]">${a.model}</span></div>
                <div class="flex items-center gap-1.5"><span class="text-slate-400">Filas:</span> ${a.queues.map(q=>`<span class="pill pill-gray text-[10px]">${findQueue(q)?.name||q}</span>`).join('')}</div>
                <div class="flex items-center gap-1.5"><span class="text-slate-400">Canais:</span> ${a.channels.length} conectado(s)</div>
              </div>
              <div class="mt-3 flex items-center gap-2">
                <button class="btn btn-ghost text-xs flex-1" data-edit-agent="${a.id}">${icon('pencil',{size:12})} Editar</button>
                <button class="btn btn-ghost text-xs" data-toggle-agent="${a.id}">${icon('power',{size:12})}</button>
                <button class="btn btn-ghost text-xs" data-test-agent="${a.id}">${icon('flask-conical',{size:12})} Testar</button>
              </div>
            </div>`).join('')}

          <div class="card p-4 border-2 border-dashed border-slate-300 bg-transparent shadow-none flex flex-col items-center justify-center cursor-pointer hover:border-violet-400 hover:bg-violet-50/30 min-h-[260px]" data-action="new-agent">
            <div class="w-12 h-12 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center mb-2">${icon('plus',{size:22})}</div>
            <div class="font-semibold">Criar novo agente</div>
            <div class="text-xs text-slate-500 mt-1">Comece em branco ou use template</div>
          </div>
        </div>

        <div class="mt-8">
          <div class="font-semibold text-sm mb-3">Templates de função</div>
          <div class="grid grid-cols-4 gap-3">
            ${ROLES.map(r => `
              <div class="card p-3 cursor-pointer hover:border-violet-400 hover:shadow" data-template-role="${r.id}">
                <div class="font-semibold text-sm">${r.label}</div>
                <div class="text-xs text-slate-500 mt-1">${r.desc}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function AgentEditor() {
  const s = getState();
  const a = s.agents.find(x=>x.id===editingId);
  if (!a) { editingId = null; return AgentesView(); }

  const channelsHtml = s.channels.map(c => `
    <label class="flex items-center gap-2 p-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
      <input type="checkbox" data-ch="${c.id}" ${a.channels.includes(c.id)?'checked':''} />
      <div class="flex-1">
        <div class="text-sm font-semibold">${c.name}</div>
        <div class="text-xs text-slate-500">${c.phone}</div>
      </div>
      <span class="pill ${c.connected?'pill-green':'pill-gray'}">${c.connected?'conectado':'desconectado'}</span>
    </label>`).join('');

  const queuesHtml = s.queues.map(q => `
    <label class="flex items-center gap-2 p-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
      <input type="checkbox" data-q="${q.id}" ${a.queues.includes(q.id)?'checked':''} />
      <span class="text-sm" style="color:${q.color}">●</span>
      <span class="text-sm">${q.name}</span>
    </label>`).join('');

  return `
    <div class="flex-1 overflow-auto bg-slate-100">
      <div class="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4">
        <button class="p-2 rounded hover:bg-slate-100" data-back-agents>${icon('chevron-left',{size:18})}</button>
        <div class="text-3xl">${a.emoji}</div>
        <div class="flex-1">
          <div class="font-bold text-lg">${a.name}</div>
          <div class="text-xs text-slate-500">${a.role} · ${a.model}</div>
        </div>
        <button class="btn btn-ghost" id="ag-test">${icon('flask-conical',{size:14})} Testar conversa</button>
        <button class="btn btn-violet" id="ag-save">${icon('check',{size:14})} Salvar</button>
      </div>

      <div class="p-6 max-w-[1100px] mx-auto grid grid-cols-3 gap-5">
        <div class="col-span-2 space-y-4">
          <div class="card p-5">
            <div class="font-semibold mb-3">Identidade</div>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="label">Nome do agente</label><input class="input" id="ag-name" value="${a.name}" /></div>
              <div><label class="label">Emoji</label><input class="input" id="ag-emoji" value="${a.emoji}" /></div>
              <div>
                <label class="label">Função</label>
                <select class="select" id="ag-role">
                  ${ROLES.map(r=>`<option value="${r.id}" ${r.id===a.role?'selected':''}>${r.label}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="label">Modelo Claude</label>
                <select class="select" id="ag-model">
                  ${MODELS.map(m=>`<option value="${m.id}" ${m.id===a.model?'selected':''}>${m.label}</option>`).join('')}
                </select>
              </div>
              <div class="col-span-2"><label class="label">Objetivo do agente</label><input class="input" id="ag-goal" value="${a.goal}" /></div>
            </div>
          </div>

          <div class="card p-5">
            <div class="font-semibold mb-3">Prompt do sistema</div>
            <textarea class="textarea font-mono text-xs" id="ag-prompt" rows="10">${a.systemPrompt}</textarea>
            <div class="text-[11px] text-slate-500 mt-2">Variáveis: {{nome}} {{telefone}} {{email}} {{ultima_msg}} {{historico}} {{empresa}}</div>
          </div>

          <div class="card p-5">
            <div class="font-semibold mb-3">Comportamento</div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label">Temperatura: <span id="ag-temp-val" class="font-bold">${a.temperature}</span></label>
                <input type="range" id="ag-temp" min="0" max="1" step="0.1" value="${a.temperature}" class="w-full" />
                <div class="text-[11px] text-slate-500">0 = direto · 1 = criativo</div>
              </div>
              <div>
                <label class="label">Palavras-chave de handoff (vírgula)</label>
                <input class="input" id="ag-handoff" value="${a.handoffOn.join(', ')}" placeholder="ex: humano, contrato" />
                <div class="text-[11px] text-slate-500">Quando detectadas, transfere para humano</div>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div class="card p-5">
            <div class="font-semibold mb-3">Canais</div>
            <div class="space-y-2">${channelsHtml}</div>
          </div>
          <div class="card p-5">
            <div class="font-semibold mb-3">Filas atribuídas</div>
            <div class="grid grid-cols-2 gap-2">${queuesHtml}</div>
          </div>
          <div class="card p-5">
            <div class="font-semibold mb-3">Status</div>
            <label class="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" id="ag-active" ${a.active?'checked':''} class="w-5 h-5" />
              <div>
                <div class="text-sm font-semibold">Agente ativo</div>
                <div class="text-xs text-slate-500">Quando ativo, atende as conversas atribuídas</div>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function bindAgentes() {
  if (editingId) return bindEditor();

  document.querySelectorAll('[data-edit-agent]').forEach(el => el.addEventListener('click', () => {
    editingId = el.dataset.editAgent;
    window.dispatchEvent(new CustomEvent('app:render'));
  }));
  document.querySelectorAll('[data-toggle-agent]').forEach(el => el.addEventListener('click', e => {
    e.stopPropagation();
    update(s => { const a=s.agents.find(x=>x.id===el.dataset.toggleAgent); if (a) a.active=!a.active; });
    toast('Status atualizado','success');
  }));
  document.querySelectorAll('[data-test-agent]').forEach(el => el.addEventListener('click', e => {
    e.stopPropagation();
    openTestChat(el.dataset.testAgent);
  }));

  document.querySelectorAll('[data-action="new-agent"]').forEach(el => el.addEventListener('click', () => createAgent()));
  document.querySelectorAll('[data-template-role]').forEach(el => el.addEventListener('click', () => createAgent(el.dataset.templateRole)));

  const cfg = document.querySelector('[data-action="config-claude"]');
  if (cfg) cfg.addEventListener('click', openClaudeConfig);
}

function createAgent(roleTemplate = null) {
  const role = roleTemplate || 'SDR';
  const presets = {
    'SDR':          { emoji:'🎯', goal:'Qualificar leads e marcar reunião', prompt:'Você é uma SDR experiente. Faça perguntas BANT (orçamento, autoridade, necessidade, tempo). Seja simpática e objetiva.' },
    'Inside Sales': { emoji:'💼', goal:'Conduzir leads ao fechamento',      prompt:'Você é um vendedor consultivo. Apresente planos, contorne objeções e envie link de checkout.' },
    'Recuperação':  { emoji:'♻️', goal:'Reengajar e recuperar clientes',    prompt:'Você é especialista em recuperação. Seja empático e ofereça soluções.' },
    'Suporte':      { emoji:'🛟', goal:'Resolver dúvidas e abrir tickets',  prompt:'Você é o suporte N1. Responda dúvidas e escale quando necessário.' },
    'Pós-Venda':    { emoji:'🎁', goal:'Acompanhar pós-compra',             prompt:'Você cuida do pós-venda. Pergunte sobre experiência, ofereça upgrades.' },
    'Cobrança':     { emoji:'💳', goal:'Negociar inadimplência',            prompt:'Você é especialista em cobrança humanizada. Ofereça acordos.' },
    'Agendamento':  { emoji:'📅', goal:'Marcar consultas/serviços',         prompt:'Você marca compromissos. Confirme dia, hora e disponibilidade.' },
  };
  const p = presets[role] || presets['SDR'];
  const id = uid('agent');
  const agent = {
    id, name:`Novo ${role}`, role, model:'claude-opus-4-7', emoji:p.emoji,
    goal:p.goal, systemPrompt:p.prompt, temperature:0.5,
    active:false, channels:[], queues:[], handoffOn:['humano','reembolso','jurídico'],
  };
  update(s => { s.agents.unshift(agent); });
  editingId = id;
  window.dispatchEvent(new CustomEvent('app:render'));
}

function bindEditor() {
  const back = document.querySelector('[data-back-agents]');
  if (back) back.addEventListener('click', () => { editingId = null; window.dispatchEvent(new CustomEvent('app:render')); });

  const tempEl = document.getElementById('ag-temp');
  const tempVal = document.getElementById('ag-temp-val');
  if (tempEl) tempEl.addEventListener('input', () => { tempVal.textContent = tempEl.value; });

  const save = document.getElementById('ag-save');
  if (save) save.addEventListener('click', () => {
    update(s => {
      const a = s.agents.find(x=>x.id===editingId);
      if (!a) return;
      a.name = document.getElementById('ag-name').value;
      a.emoji = document.getElementById('ag-emoji').value;
      a.role = document.getElementById('ag-role').value;
      a.model = document.getElementById('ag-model').value;
      a.goal = document.getElementById('ag-goal').value;
      a.systemPrompt = document.getElementById('ag-prompt').value;
      a.temperature = parseFloat(document.getElementById('ag-temp').value);
      a.handoffOn = document.getElementById('ag-handoff').value.split(',').map(s=>s.trim()).filter(Boolean);
      a.active = document.getElementById('ag-active').checked;
      a.channels = Array.from(document.querySelectorAll('[data-ch]:checked')).map(e=>e.dataset.ch);
      a.queues   = Array.from(document.querySelectorAll('[data-q]:checked')).map(e=>e.dataset.q);
    });
    toast('Agente salvo com sucesso','success');
  });

  const test = document.getElementById('ag-test');
  if (test) test.addEventListener('click', () => openTestChat(editingId));
}

function openTestChat(agentId) {
  const s = getState();
  const a = s.agents.find(x=>x.id===agentId);
  if (!a) return;
  testHistory = [];
  const apiKey = s.apiSettings.claude.apiKey;

  const renderChat = () => `
    <div class="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
      <div class="text-2xl">${a.emoji}</div>
      <div class="flex-1">
        <div class="font-semibold">${a.name} <span class="pill pill-violet ml-1">${a.role}</span></div>
        <div class="text-xs text-slate-500">${a.model} · temp ${a.temperature}</div>
      </div>
      <button class="p-1.5 rounded hover:bg-slate-100" data-close>${icon('x',{size:18})}</button>
    </div>
    <div class="px-6 py-4 max-h-[60vh] overflow-auto" id="test-scroll" style="background:#f8fafc">
      ${testHistory.length===0 ? `<div class="text-center text-sm text-slate-500 py-8">Envie a primeira mensagem para testar o agente.</div>` : ''}
      ${testHistory.map(m => `
        <div class="flex ${m.from==='me'?'justify-end':'justify-start'} mb-2">
          <div class="bubble ${m.from==='me'?'bubble-out':'bubble-in'}">${m.text.replace(/</g,'&lt;')}</div>
        </div>`).join('')}
    </div>
    <div class="px-6 py-3 border-t border-slate-100">
      ${!apiKey ? `<div class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-2">⚠️ Sem chave Claude configurada — modo demonstração (respostas simuladas). Configure em <b>Configurações → Claude</b>.</div>` : ''}
      <div class="flex gap-2">
        <input class="input flex-1" id="test-msg" placeholder="Digite uma mensagem..." />
        <button class="btn btn-violet" id="test-send">${icon('send',{size:14})}</button>
      </div>
    </div>`;

  openModal(`<div>${renderChat()}</div>`, { size:'lg' });
  hookTest();

  function hookTest() {
    const root = document.getElementById('modal-root');
    root.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => document.getElementById('modal-root').innerHTML=''));

    const send = document.getElementById('test-send');
    const inp = document.getElementById('test-msg');
    const sc = document.getElementById('test-scroll');
    if (sc) sc.scrollTop = sc.scrollHeight;

    const doSend = async () => {
      const txt = (inp?.value||'').trim();
      if (!txt) return;
      testHistory.push({from:'me', text: txt});
      inp.value = '';
      rerender();
      // simulated response (or real Claude if key present — left as a future hook)
      setTimeout(() => {
        const replies = {
          'SDR': `Olá! Sou ${a.name}, da equipe comercial. Pra te ajudar melhor, posso te perguntar 3 coisas? 🙂\n1) Qual é o tamanho da sua operação?\n2) Hoje, qual é a sua principal dificuldade?\n3) Tem urgência em resolver isso?`,
          'Inside Sales': `Perfeito! Pelo que entendi, o plano que melhor encaixa pra vocês é o Pro (R$ 790/mês). Te mando o link de checkout?`,
          'Recuperação': `Que pena ver você indo... Tem algo específico que te fez pensar em cancelar? Posso liberar 20% off por 3 meses se quiser tentar de novo.`,
          'Suporte': `Claro! Pra te ajudar, vou abrir um ticket. Pode me confirmar o email cadastrado e descrever o problema com mais detalhes?`,
          'Pós-Venda': `Que legal te ver de volta! 🎉 De 0 a 10, qual nota você daria pra sua experiência até aqui?`,
          'Cobrança': `Oi! Notei que tem uma fatura em aberto. Posso te ajudar a regularizar com um parcelamento?`,
          'Agendamento': `Posso te ajudar a marcar! Qual dia da semana funciona melhor pra você — terça ou quinta?`,
        };
        testHistory.push({ from:'ai', text: replies[a.role] || `(${apiKey?'Claude':'demo'}) Entendi sua mensagem: "${txt}". Vou te ajudar com isso.` });
        rerender();
      }, 600);
    };

    if (send) send.addEventListener('click', doSend);
    if (inp) inp.addEventListener('keydown', e => { if (e.key==='Enter') doSend(); });
  }

  function rerender() {
    document.querySelector('#modal-root .modal').innerHTML = renderChat();
    hookTest();
  }
}

function openClaudeConfig() {
  const s = getState();
  const cfg = s.apiSettings.claude;
  const body = `
    <div class="space-y-4">
      <div class="bg-violet-50 border border-violet-200 rounded-lg p-3 text-xs text-violet-900 flex gap-2">
        ${icon('info',{size:16,cls:'flex-shrink-0 mt-0.5'})}
        <div>Os agentes IA usam a Claude API (Anthropic). Crie sua chave em <b>console.anthropic.com</b> e cole abaixo. A chave é armazenada apenas neste navegador.</div>
      </div>
      <div><label class="label">API Key</label><input class="input" id="cl-key" type="password" placeholder="sk-ant-..." value="${cfg.apiKey}" /></div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label">Modelo padrão</label>
          <select class="select" id="cl-model">
            ${MODELS.map(m=>`<option value="${m.id}" ${m.id===cfg.model?'selected':''}>${m.label}</option>`).join('')}
          </select>
        </div>
        <div><label class="label">Max tokens</label><input class="input" type="number" id="cl-tokens" value="${cfg.maxTokens}" /></div>
      </div>
    </div>`;
  openModal(modalShell({
    title:'Configurar Claude',
    body,
    footer:`<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="cl-save">Salvar</button>`
  }));
  document.getElementById('cl-save').addEventListener('click', () => {
    update(s => {
      s.apiSettings.claude.apiKey = document.getElementById('cl-key').value.trim();
      s.apiSettings.claude.model  = document.getElementById('cl-model').value;
      s.apiSettings.claude.maxTokens = parseInt(document.getElementById('cl-tokens').value||'1024');
    });
    document.getElementById('modal-root').innerHTML='';
    toast('Configuração Claude salva','success');
  });
}
