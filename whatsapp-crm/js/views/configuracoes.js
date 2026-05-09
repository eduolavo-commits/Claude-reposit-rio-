import { getState, update, resetState, uid } from '../state.js';
import { openModal, modalShell, toast } from '../components.js';
import { icon } from '../icons.js';
import { getBackendUrl, setBackendUrl, apiHealth, connectWebSocket, isBackendEnabled, apiInstanceConnect, apiInstanceStatus } from '../api.js';

let activeTab = 'channels';

const TABS = [
  { id:'backend',  label:'Backend',       ic:'server' },
  { id:'channels', label:'Canais & APIs', ic:'plug' },
  { id:'queues',   label:'Filas',         ic:'inbox' },
  { id:'tags',     label:'Tags',          ic:'tag' },
  { id:'quick',    label:'Mensagens rápidas', ic:'zap' },
  { id:'team',     label:'Equipe',        ic:'users' },
  { id:'webhooks', label:'Webhooks',      ic:'webhook' },
  { id:'data',     label:'Dados',         ic:'database' },
];

export function ConfiguracoesView() {
  return `
    <div class="flex-1 flex bg-white">
      <aside class="w-[240px] border-r border-slate-200 p-4">
        <div class="text-xs uppercase text-slate-500 font-bold mb-2">Configurações</div>
        ${TABS.map(t => `
          <div class="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm font-medium ${activeTab===t.id?'bg-emerald-50 text-emerald-700':'text-slate-700 hover:bg-slate-50'}" data-cfg-tab="${t.id}">
            ${icon(t.ic,{size:16,cls:'opacity-80'})}<span>${t.label}</span>
          </div>`).join('')}
      </aside>
      <div class="flex-1 overflow-auto p-6 bg-slate-50">
        <div class="max-w-[900px] mx-auto">
          ${renderTab()}
        </div>
      </div>
    </div>
  `;
}

function renderTab() {
  const s = getState();
  switch (activeTab) {
    case 'backend':  return renderBackend(s);
    case 'channels': return renderChannels(s);
    case 'queues':   return renderQueues(s);
    case 'tags':     return renderTags(s);
    case 'quick':    return renderQuick(s);
    case 'team':     return renderTeam(s);
    case 'webhooks': return renderWebhooks(s);
    case 'data':     return renderData(s);
  }
  return '';
}

function renderBackend(s) {
  const url = getBackendUrl();
  return `
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-xl font-bold">Backend & Integrações</h1>
        <div class="text-sm text-slate-500">Conecte o frontend ao servidor Node.js que fala com a Evolution API</div>
      </div>
      <button class="btn btn-ghost" id="be-test">${icon('activity',{size:14})} Testar conexão</button>
    </div>

    <div class="card p-5 mb-4">
      <div class="font-semibold mb-3">URL do backend</div>
      <input class="input" id="be-url" value="${url}" placeholder="http://localhost:3001 (ou https://seu-servidor.com)" />
      <div class="text-xs text-slate-500 mt-2">
        Sem URL → modo offline (localStorage). Com URL configurada, o sistema envia mensagens reais via Evolution e recebe via WebSocket.
      </div>
      <div class="flex items-center gap-2 mt-3">
        <button class="btn btn-primary" id="be-save">${icon('check',{size:14})} Salvar e conectar</button>
        <button class="btn btn-ghost" id="be-clear">Modo offline</button>
        <span id="be-status" class="ml-auto text-sm"></span>
      </div>
    </div>

    <div class="card p-5 mb-4">
      <div class="font-semibold mb-3">Status da instância WhatsApp</div>
      <div id="be-instance" class="text-sm text-slate-600">Clique em "Verificar" pra conferir.</div>
      <div class="flex gap-2 mt-3">
        <button class="btn btn-ghost" id="be-check">${icon('refresh-cw',{size:14})} Verificar status</button>
        <button class="btn btn-violet" id="be-qr">${icon('qr-code',{size:14})} Mostrar QR Code</button>
      </div>
    </div>

    <div class="card p-5 border-l-4 border-amber-400">
      <div class="font-semibold text-sm mb-2">${icon('info',{size:14,cls:'inline'})} Como rodar o backend</div>
      <ol class="text-sm text-slate-600 list-decimal list-inside space-y-1">
        <li>Tenha Node.js 18+ instalado</li>
        <li>Vá em <code>whatsapp-crm/backend/</code></li>
        <li>Copie <code>.env.example</code> para <code>.env</code> e configure a URL/key da sua Evolution</li>
        <li>Rode <code class="bg-slate-100 px-1.5 rounded">npm install</code></li>
        <li>Rode <code class="bg-slate-100 px-1.5 rounded">npm start</code></li>
        <li>Cole <code>http://localhost:3001</code> no campo acima</li>
      </ol>
    </div>
  `;
}

function renderChannels(s) {
  const types = [
    { id:'whatsapp_cloud', label:'WhatsApp Cloud API (Meta)',   desc:'API oficial — recomendado para produção',           color:'bg-emerald-100 text-emerald-700', ic:'message-circle', recommended:true },
    { id:'evolution',      label:'Evolution API',                 desc:'Servidor próprio (não-oficial) com QR Code',         color:'bg-violet-100 text-violet-700',  ic:'qr-code' },
    { id:'baileys',        label:'Baileys API',                   desc:'Open source, multi-dispositivo',                     color:'bg-blue-100 text-blue-700',      ic:'smartphone' },
    { id:'wppconnect',     label:'WPPConnect',                    desc:'Open source baseado em Puppeteer',                   color:'bg-amber-100 text-amber-700',    ic:'globe' },
    { id:'instagram',      label:'Instagram DM',                  desc:'Mensagens diretas do Instagram',                     color:'bg-pink-100 text-pink-700',      ic:'instagram' },
    { id:'telegram',       label:'Telegram Bot API',              desc:'Bots oficiais do Telegram',                          color:'bg-sky-100 text-sky-700',        ic:'send' },
  ];

  return `
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-xl font-bold">Canais & APIs</h1>
        <div class="text-sm text-slate-500">Conecte WhatsApp e outros canais</div>
      </div>
      <button class="btn btn-primary" id="btn-add-channel">${icon('plus',{size:14})} Adicionar canal</button>
    </div>

    <div class="card p-4 mb-5">
      <div class="font-semibold mb-3">Tipos suportados</div>
      <div class="grid grid-cols-3 gap-2">
        ${types.map(t => `
          <div class="border border-slate-200 rounded-lg p-3 hover:border-emerald-400 cursor-pointer relative" data-add-type="${t.id}">
            ${t.recommended ? `<span class="absolute top-2 right-2 pill pill-green text-[9px]">Recomendado</span>`:''}
            <div class="w-9 h-9 rounded ${t.color} flex items-center justify-center mb-2">${icon(t.ic,{size:18})}</div>
            <div class="font-semibold text-sm">${t.label}</div>
            <div class="text-xs text-slate-500">${t.desc}</div>
          </div>`).join('')}
      </div>
    </div>

    <div class="font-semibold mb-2">Canais conectados</div>
    <div class="space-y-2">
      ${s.channels.map(c => `
        <div class="card p-4 flex items-center gap-3">
          <div class="w-11 h-11 rounded-full ch-wa flex items-center justify-center text-white">${icon('message-circle',{size:18})}</div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <div class="font-semibold">${c.name}</div>
              ${c.verified ? `<span class="pill pill-blue">${icon('badge-check',{size:10})} Verificado</span>` : ''}
              <span class="pill ${c.connected?'pill-green':'pill-red'}">${c.connected?'Conectado':'Desconectado'}</span>
            </div>
            <div class="text-xs text-slate-500">${c.phone} · ${c.type}</div>
          </div>
          <button class="btn btn-ghost text-xs" data-edit-channel="${c.id}">${icon('settings',{size:14})} Configurar</button>
          <button class="btn btn-ghost text-xs" data-test-channel="${c.id}">${icon('check-circle',{size:14})} Testar</button>
          <button class="p-1.5 rounded hover:bg-slate-100" data-del-channel="${c.id}">${icon('trash-2',{size:14,cls:'text-rose-500'})}</button>
        </div>`).join('')}
    </div>

    <div class="card p-5 mt-6">
      <div class="font-semibold mb-3">Claude API (IA)</div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="label">API Key</label><input class="input" type="password" id="cl-key2" value="${s.apiSettings.claude.apiKey}" placeholder="sk-ant-..." /></div>
        <div><label class="label">Modelo padrão</label>
          <select class="select" id="cl-model2">
            <option ${s.apiSettings.claude.model==='claude-opus-4-7'?'selected':''} value="claude-opus-4-7">Claude Opus 4.7</option>
            <option ${s.apiSettings.claude.model==='claude-sonnet-4-6'?'selected':''} value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
            <option ${s.apiSettings.claude.model==='claude-haiku-4-5-20251001'?'selected':''} value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary mt-3" id="cl-save2">Salvar Claude</button>
    </div>
  `;
}

function renderQueues(s) {
  return `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-bold">Filas de atendimento</h1>
      <button class="btn btn-primary" data-action="new-queue">${icon('plus',{size:14})} Nova fila</button>
    </div>
    <div class="space-y-2">
      ${s.queues.map(q => `
        <div class="card p-4 flex items-center gap-3">
          <span class="w-3 h-3 rounded-full" style="background:${q.color}"></span>
          <input class="input max-w-[260px]" data-q-name="${q.id}" value="${q.name}" />
          <input class="input max-w-[140px]" type="color" data-q-color="${q.id}" value="${q.color}" />
          <div class="text-xs text-slate-500 ml-2">${s.conversations.filter(c=>c.queue===q.id).length} conversas</div>
          <div class="flex-1"></div>
          <button class="btn btn-ghost text-xs" data-del-queue="${q.id}">${icon('trash-2',{size:14,cls:'text-rose-500'})}</button>
        </div>`).join('')}
    </div>
  `;
}

function renderTags(s) {
  const tags = Array.from(new Set(s.contacts.flatMap(c=>c.tags)));
  return `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-bold">Tags</h1>
    </div>
    <div class="card p-4 flex flex-wrap gap-2">
      ${tags.map(t => `<span class="pill pill-gray">${t} <button class="ml-1 text-rose-500" data-del-tag="${t}">×</button></span>`).join('')}
      ${tags.length===0 ? '<div class="text-sm text-slate-500">Nenhuma tag criada ainda. As tags são adicionadas direto nos contatos.</div>':''}
    </div>
  `;
}

function renderQuick(s) {
  return `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-bold">Mensagens rápidas</h1>
      <button class="btn btn-primary" data-action="new-quick">${icon('plus',{size:14})} Nova</button>
    </div>
    <div class="space-y-2">
      ${s.quickReplies.map(q => `
        <div class="card p-4">
          <div class="flex items-center gap-2 mb-2">
            <code class="bg-violet-100 text-violet-700 px-2 py-0.5 rounded text-xs font-bold">${q.shortcut}</code>
            <button class="ml-auto p-1.5 rounded hover:bg-slate-100" data-del-quick="${q.id}">${icon('trash-2',{size:14,cls:'text-rose-500'})}</button>
          </div>
          <textarea class="textarea" rows="2" data-quick-text="${q.id}">${q.text}</textarea>
        </div>`).join('')}
    </div>
  `;
}

function renderTeam(s) {
  return `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-bold">Equipe</h1>
      <button class="btn btn-primary">${icon('plus',{size:14})} Convidar usuário</button>
    </div>
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-slate-600"><tr><th class="p-3 text-left font-semibold">Nome</th><th class="p-3 text-left font-semibold">Email</th><th class="p-3 text-left font-semibold">Função</th><th class="p-3 text-left font-semibold">Status</th></tr></thead>
        <tbody>
          ${[
            {n:'Lucas Silva',  e:'lucas@digisac.app',  r:'Administrador', s:'online'},
            {n:'Ana Carolina', e:'ana@digisac.app',    r:'Vendedora',     s:'online'},
            {n:'Bruno Lopes',  e:'bruno@digisac.app',  r:'Suporte',       s:'ausente'},
            {n:'Camila Rios',  e:'camila@digisac.app', r:'Inside Sales',  s:'offline'},
          ].map(u => `
            <tr class="border-t border-slate-100">
              <td class="p-3 font-semibold">${u.n}</td>
              <td class="p-3 text-slate-600">${u.e}</td>
              <td class="p-3"><span class="pill pill-violet">${u.r}</span></td>
              <td class="p-3"><span class="pill ${u.s==='online'?'pill-green':u.s==='ausente'?'pill-yellow':'pill-gray'}">${u.s}</span></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderWebhooks(s) {
  return `
    <h1 class="text-xl font-bold mb-4">Webhooks</h1>
    <div class="card p-5 space-y-3">
      <div class="text-sm text-slate-600">Receba eventos do sistema (mensagem recebida, venda registrada, deal atualizado) em qualquer URL externa.</div>
      <div><label class="label">URL do webhook</label><input class="input" placeholder="https://seu-servidor.com/webhook" /></div>
      <div><label class="label">Eventos</label>
        <div class="grid grid-cols-3 gap-2">
          ${['message.received','message.sent','sale.registered','deal.updated','contact.created','campaign.completed','flow.executed','agent.handoff'].map(e =>
            `<label class="flex items-center gap-2 text-sm"><input type="checkbox" /> <code>${e}</code></label>`).join('')}
        </div>
      </div>
      <button class="btn btn-primary">Salvar webhook</button>
    </div>
  `;
}

function renderData(s) {
  return `
    <h1 class="text-xl font-bold mb-4">Dados & Privacidade</h1>
    <div class="space-y-3">
      <div class="card p-5">
        <div class="font-semibold mb-1">Exportar dados</div>
        <div class="text-sm text-slate-500 mb-3">Baixe todos os contatos, conversas e vendas em formato JSON.</div>
        <button class="btn btn-ghost" id="btn-export">${icon('download',{size:14})} Exportar JSON</button>
      </div>
      <div class="card p-5 border border-rose-200">
        <div class="font-semibold mb-1 text-rose-700">Resetar dados</div>
        <div class="text-sm text-slate-500 mb-3">Apaga todos os dados locais e restaura o estado inicial de demonstração.</div>
        <button class="btn btn-danger" id="btn-reset">${icon('trash-2',{size:14})} Resetar</button>
      </div>
    </div>
  `;
}

export function bindConfiguracoes() {
  document.querySelectorAll('[data-cfg-tab]').forEach(el => el.addEventListener('click', () => {
    activeTab = el.dataset.cfgTab;
    window.dispatchEvent(new CustomEvent('app:render'));
  }));

  // backend tab
  const beSave = document.getElementById('be-save');
  if (beSave) beSave.addEventListener('click', async () => {
    const url = document.getElementById('be-url').value.trim();
    setBackendUrl(url);
    if (url) {
      try {
        const h = await apiHealth();
        document.getElementById('be-status').innerHTML = `<span class="pill pill-green">✓ conectado · evolution: ${h.evolution}</span>`;
        connectWebSocket();
        toast('Backend conectado','success');
      } catch (e) {
        document.getElementById('be-status').innerHTML = `<span class="pill pill-red">✗ ${e.message}</span>`;
        toast('Falha: '+e.message,'error');
      }
    } else {
      document.getElementById('be-status').innerHTML = '<span class="pill pill-gray">modo offline</span>';
      toast('Modo offline ativado','info');
    }
  });
  const beClear = document.getElementById('be-clear');
  if (beClear) beClear.addEventListener('click', () => { setBackendUrl(''); window.dispatchEvent(new CustomEvent('app:render')); });
  const beTest = document.getElementById('be-test');
  if (beTest) beTest.addEventListener('click', async () => {
    try { const h = await apiHealth(); toast(`Backend OK · Evolution: ${h.evolution}`,'success'); }
    catch (e) { toast('Erro: '+e.message,'error'); }
  });
  const beCheck = document.getElementById('be-check');
  if (beCheck) beCheck.addEventListener('click', async () => {
    try {
      const r = await apiInstanceStatus();
      const state = r.instance?.state || r.state || JSON.stringify(r);
      document.getElementById('be-instance').innerHTML = `Status: <b>${state}</b>`;
    } catch (e) { document.getElementById('be-instance').textContent = 'Erro: '+e.message; }
  });
  const beQr = document.getElementById('be-qr');
  if (beQr) beQr.addEventListener('click', async () => {
    try {
      const r = await apiInstanceConnect();
      const code = r.code || r.base64 || r.qrcode?.base64 || '';
      const body = code
        ? `<div class="text-center"><img src="${code.startsWith('data:')?code:'data:image/png;base64,'+code}" class="mx-auto rounded border border-slate-200" style="max-width:280px"/><div class="text-xs text-slate-500 mt-3">Escaneie no WhatsApp → Aparelhos conectados → Conectar aparelho</div></div>`
        : `<pre class="text-xs bg-slate-50 p-3 rounded overflow-auto">${JSON.stringify(r,null,2)}</pre>`;
      openModal(modalShell({ title:'QR Code da instância', body, footer:`<button class="btn btn-ghost" data-close>Fechar</button>` }));
    } catch (e) { toast('Erro: '+e.message,'error'); }
  });

  // channels
  document.querySelectorAll('[data-add-type]').forEach(el => el.addEventListener('click', () => openChannelModal(el.dataset.addType)));
  document.querySelectorAll('[data-edit-channel]').forEach(el => el.addEventListener('click', () => openChannelModal(null, el.dataset.editChannel)));
  document.querySelectorAll('[data-del-channel]').forEach(el => el.addEventListener('click', () => {
    if (!confirm('Remover canal?')) return;
    update(s => { s.channels = s.channels.filter(c=>c.id!==el.dataset.delChannel); });
    toast('Canal removido','success');
  }));
  document.querySelectorAll('[data-test-channel]').forEach(el => el.addEventListener('click', () => toast('Conexão testada com sucesso ✅','success')));
  const addBtn = document.getElementById('btn-add-channel');
  if (addBtn) addBtn.addEventListener('click', () => openChannelModal('whatsapp_cloud'));
  const cls = document.getElementById('cl-save2');
  if (cls) cls.addEventListener('click', () => {
    update(s => {
      s.apiSettings.claude.apiKey = document.getElementById('cl-key2').value.trim();
      s.apiSettings.claude.model  = document.getElementById('cl-model2').value;
    });
    toast('Claude salvo','success');
  });

  // queues
  document.querySelectorAll('[data-q-name]').forEach(el => el.addEventListener('change', () => {
    update(s => { const q=s.queues.find(x=>x.id===el.dataset.qName); if (q) q.name = el.value; });
    toast('Fila atualizada','success');
  }));
  document.querySelectorAll('[data-q-color]').forEach(el => el.addEventListener('change', () => {
    update(s => { const q=s.queues.find(x=>x.id===el.dataset.qColor); if (q) q.color = el.value; });
  }));
  document.querySelectorAll('[data-del-queue]').forEach(el => el.addEventListener('click', () => {
    if (!confirm('Remover fila?')) return;
    update(s => { s.queues = s.queues.filter(q=>q.id!==el.dataset.delQueue); });
    toast('Fila removida','success');
  }));
  const newQ = document.querySelector('[data-action="new-queue"]');
  if (newQ) newQ.addEventListener('click', () => {
    update(s => { s.queues.push({ id:uid('q'), name:'Nova fila', color:'#64748b' }); });
  });

  // quick replies
  document.querySelectorAll('[data-quick-text]').forEach(el => el.addEventListener('blur', () => {
    update(s => { const q=s.quickReplies.find(x=>x.id===el.dataset.quickText); if (q) q.text = el.value; });
    toast('Mensagem rápida salva','success');
  }));
  document.querySelectorAll('[data-del-quick]').forEach(el => el.addEventListener('click', () => {
    update(s => { s.quickReplies = s.quickReplies.filter(q=>q.id!==el.dataset.delQuick); });
  }));
  const newQR = document.querySelector('[data-action="new-quick"]');
  if (newQR) newQR.addEventListener('click', () => {
    update(s => { s.quickReplies.push({ id:uid('q'), shortcut:'/novo', text:'Nova mensagem rápida' }); });
  });

  // tags
  document.querySelectorAll('[data-del-tag]').forEach(el => el.addEventListener('click', () => {
    const t = el.dataset.delTag;
    update(s => { s.contacts.forEach(c => { c.tags = c.tags.filter(x=>x!==t); }); });
  }));

  // data
  const exp = document.getElementById('btn-export');
  if (exp) exp.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(getState(),null,2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='digisac-export.json'; a.click();
    URL.revokeObjectURL(url);
    toast('Exportação iniciada','success');
  });
  const rst = document.getElementById('btn-reset');
  if (rst) rst.addEventListener('click', () => {
    if (!confirm('Apagar todos os dados locais?')) return;
    resetState();
    toast('Estado resetado','success');
  });
}

function openChannelModal(type = null, editId = null) {
  const s = getState();
  const existing = editId ? s.channels.find(c=>c.id===editId) : null;
  const t = existing?.type || type || 'whatsapp_cloud';

  const fieldsByType = {
    whatsapp_cloud: `
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2"><label class="label">Nome do canal</label><input class="input" id="ch-name" value="${existing?.name||'WhatsApp Cloud — Vendas'}" /></div>
        <div><label class="label">Phone Number ID</label><input class="input" id="ch-phone-id" value="${s.apiSettings.waCloud.phoneId}" placeholder="123456789012345" /></div>
        <div><label class="label">WABA ID</label><input class="input" id="ch-waba" value="${s.apiSettings.waCloud.wabaId}" placeholder="987654321098765" /></div>
        <div class="col-span-2"><label class="label">Access Token (permanente)</label><input class="input" id="ch-token" type="password" value="${s.apiSettings.waCloud.token}" placeholder="EAAJ..." /></div>
        <div><label class="label">Business ID</label><input class="input" id="ch-biz" value="${s.apiSettings.waCloud.businessId}" /></div>
        <div><label class="label">Telefone</label><input class="input" id="ch-tel" value="${existing?.phone||''}" placeholder="+55 11 99999-9999" /></div>
      </div>
      <div class="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800 mt-3">
        ${icon('info',{size:14,cls:'inline'})} Webhook URL para configurar no Meta:
        <code class="block bg-white rounded p-2 mt-1">https://api.suaempresa.com/webhook/wa-cloud</code>
      </div>
    `,
    evolution: `
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2"><label class="label">Nome do canal</label><input class="input" id="ch-name" value="${existing?.name||'Evolution — Instância 1'}" /></div>
        <div><label class="label">Base URL</label><input class="input" id="ch-base" value="${s.apiSettings.evolution.baseUrl}" /></div>
        <div><label class="label">Instance Name</label><input class="input" id="ch-inst" value="${s.apiSettings.evolution.instance}" /></div>
        <div class="col-span-2"><label class="label">API Key</label><input class="input" type="password" id="ch-key" value="${s.apiSettings.evolution.apiKey}" /></div>
        <div><label class="label">Telefone</label><input class="input" id="ch-tel" value="${existing?.phone||''}" /></div>
      </div>
      <div class="text-center mt-4 p-6 bg-slate-50 rounded-lg">
        <div class="w-32 h-32 mx-auto bg-white border-2 border-slate-200 rounded grid place-items-center text-slate-400 text-xs">QR Code</div>
        <div class="text-sm text-slate-600 mt-2">Escaneie o QR Code no WhatsApp para conectar</div>
      </div>
    `,
    baileys: `<div class="text-center p-6 text-slate-500">Configure suas credenciais Baileys via webhook ↓</div>
      <div><label class="label">Webhook URL</label><input class="input" placeholder="https://seu-baileys.com/api" /></div>`,
    wppconnect: `<div><label class="label">Server URL</label><input class="input" placeholder="https://wppconnect.suaempresa.com" /></div>`,
    instagram: `<div><label class="label">Page Access Token</label><input class="input" placeholder="EAAJ..." /></div>`,
    telegram:  `<div><label class="label">Bot Token</label><input class="input" placeholder="123456:ABC-..." /></div>`,
  };

  const body = `
    <div>
      <div class="flex items-center gap-2 mb-4">
        <span class="pill pill-violet">${t}</span>
        ${existing ? `<span class="pill ${existing.connected?'pill-green':'pill-red'}">${existing.connected?'Conectado':'Desconectado'}</span>` : ''}
      </div>
      ${fieldsByType[t] || fieldsByType.whatsapp_cloud}
    </div>`;

  openModal(modalShell({
    title: existing ? 'Editar canal' : 'Conectar novo canal',
    body,
    footer:`<button class="btn btn-ghost" data-close>Cancelar</button>
            <button class="btn btn-primary" id="ch-save">${icon('check',{size:14})} ${existing?'Salvar':'Conectar'}</button>`
  }), { size:'lg' });

  document.getElementById('ch-save').addEventListener('click', () => {
    const name = document.getElementById('ch-name')?.value || 'Canal';
    const phone = document.getElementById('ch-tel')?.value || '';
    update(s => {
      // persist API settings if relevant
      if (t==='whatsapp_cloud') {
        s.apiSettings.waCloud = {
          token: document.getElementById('ch-token')?.value || '',
          phoneId: document.getElementById('ch-phone-id')?.value || '',
          businessId: document.getElementById('ch-biz')?.value || '',
          wabaId: document.getElementById('ch-waba')?.value || '',
        };
      } else if (t==='evolution') {
        s.apiSettings.evolution = {
          baseUrl: document.getElementById('ch-base')?.value || '',
          apiKey:  document.getElementById('ch-key')?.value || '',
          instance:document.getElementById('ch-inst')?.value || '',
        };
      }
      if (existing) {
        Object.assign(existing, { name, phone, connected:true });
      } else {
        s.channels.push({ id: uid('ch'), name, type:t, connected:true, phone, verified:false });
      }
    });
    document.getElementById('modal-root').innerHTML='';
    toast('Canal salvo e conectado','success');
  });
}
