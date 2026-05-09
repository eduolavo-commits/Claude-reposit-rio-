import { getState, update, findContact, findChannel, findAgent, findQueue, uid } from '../state.js';
import { avatar, refreshIcons, toast, emptyState } from '../components.js';
import { icon } from '../icons.js';

let activeTab = 'favoritos'; // favoritos|chats|fila|contatos
let activeConvId = null;
let chatFilter = '';

function chatTabs() {
  const s = getState();
  const counts = {
    chats: s.conversations.filter(c=>c.status==='open').length,
    fila:  s.conversations.filter(c=>c.status==='queued').length,
  };
  const tabs = [
    { id:'favoritos', label:'Favoritos', ic:'star' },
    { id:'chats',     label:'Chats',     ic:'message-square', count:counts.chats },
    { id:'fila',      label:'Fila',      ic:'inbox',          count:counts.fila  },
    { id:'contatos',  label:'Contatos',  ic:'users' },
  ];
  return `
    <div class="flex items-center justify-around border-b border-slate-100 px-2 pt-2">
      ${tabs.map(t => `
        <div class="tab ${activeTab===t.id?'active':''} relative" data-chat-tab="${t.id}">
          ${icon(t.ic,{size:18})}
          ${t.count ? `<span class="absolute -top-1 right-2 bg-brand-500 text-white text-[10px] px-1.5 rounded-full font-bold">${t.count}</span>`:''}
          <span>${t.label}</span>
        </div>`).join('')}
    </div>
  `;
}

function chatRow(conv) {
  const s = getState();
  const c = findContact(conv.contactId);
  const ch = findChannel(c.channel);
  const last = conv.messages[conv.messages.length-1];
  const isActive = activeConvId === conv.id;
  const checks = last && last.from==='me' ? (last.read ? icon('check-check',{size:14,cls:'text-sky-500'}) : icon('check-check',{size:14,cls:'text-slate-400'})) : '';
  return `
    <div class="flex items-center gap-3 px-4 py-3 row-hover ${isActive?'bg-emerald-50':''} border-b border-slate-100" data-conv="${conv.id}">
      ${avatar(c.name, {size:44})}
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between">
          <div class="font-semibold text-sm text-slate-900 truncate">${c.name}</div>
          <div class="text-[11px] text-slate-500 ml-2 whitespace-nowrap">${conv.time}</div>
        </div>
        <div class="flex items-center gap-1 text-xs text-slate-600 truncate mt-0.5">
          ${checks}
          <span class="truncate">${last ? last.text : ''}</span>
        </div>
        <div class="flex items-center gap-1.5 mt-1">
          ${c.tags.map(t=>`<span class="pill pill-gray text-[10px]">${t}</span>`).join('')}
          ${conv.assigned ? `<span class="pill pill-violet text-[10px]">${icon('bot',{size:10})} ${findAgent(conv.assigned)?.name||'IA'}</span>` : ''}
        </div>
      </div>
      <div class="flex flex-col items-end gap-1">
        ${conv.unread ? `<span class="bg-brand-500 text-white rounded-full text-[10px] font-bold px-1.5 min-w-[20px] text-center">${conv.unread}</span>` : '<span></span>'}
        ${conv.favorite ? icon('star',{size:14,cls:'text-amber-400 fill-amber-400'}) : ''}
      </div>
    </div>
  `;
}

function leftPanel() {
  const s = getState();
  let convs = s.conversations.slice();
  if (activeTab==='favoritos') convs = convs.filter(c=>c.favorite);
  if (activeTab==='chats')     convs = convs.filter(c=>c.status==='open');
  if (activeTab==='fila')      convs = convs.filter(c=>c.status==='queued');
  if (chatFilter) {
    const f = chatFilter.toLowerCase();
    convs = convs.filter(c => {
      const ct = findContact(c.contactId);
      return ct.name.toLowerCase().includes(f) || ct.phone.includes(f);
    });
  }

  const contactsList = activeTab === 'contatos'
    ? s.contacts.map(c => `
        <div class="flex items-center gap-3 px-4 py-3 row-hover border-b border-slate-100" data-new-conv="${c.id}">
          ${avatar(c.name, {size:42})}
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm">${c.name}</div>
            <div class="text-xs text-slate-500">${c.phone}</div>
          </div>
          <button class="btn btn-ghost text-xs">${icon('message-circle',{size:14})} Conversar</button>
        </div>`).join('')
    : null;

  return `
    <div class="w-[400px] flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
      ${chatTabs()}
      <div class="px-3 py-2.5 border-b border-slate-100">
        <div class="relative">
          ${icon('search',{size:16,cls:'absolute left-3 top-1/2 -translate-y-1/2 text-slate-400'})}
          <input id="chat-filter" class="input pl-9" placeholder="Buscar conversas, contatos..." value="${chatFilter}" />
        </div>
      </div>
      <div class="flex-1 overflow-auto scroll-thin">
        ${contactsList !== null
          ? (contactsList || emptyState({ic:'users', title:'Sem contatos'}))
          : (convs.length ? convs.map(chatRow).join('') : emptyState({ic:'message-square',title:'Sem conversas',desc:'Quando seus clientes mandarem mensagem, elas aparecerão aqui.'}))
        }
      </div>
      <div class="border-t border-slate-100 p-3">
        <button class="text-emerald-600 text-sm font-semibold w-full text-center">Ver mais conversas ↓</button>
      </div>
    </div>
  `;
}

function welcomePanel() {
  return `
    <div class="flex-1 flex items-center justify-center bg-slate-50 relative overflow-hidden">
      <div class="text-center max-w-2xl px-8">
        <div class="relative mx-auto mb-8 w-44 h-44">
          <div class="absolute inset-0 rounded-full bg-emerald-100/40"></div>
          <div class="absolute top-3 left-3 w-20 h-20 rounded-full bg-emerald-400 flex items-center justify-center text-white shadow-lg">${icon('message-circle',{size:36})}</div>
          <div class="absolute bottom-2 right-3 w-16 h-16 rounded-full bg-blue-300 flex items-center justify-center text-white shadow-lg">${icon('message-square',{size:28})}</div>
          <div class="absolute -top-2 right-8 text-emerald-400 text-2xl">+</div>
          <div class="absolute -bottom-2 left-8 text-blue-300 text-2xl">+</div>
        </div>
        <h2 class="text-xl font-semibold mb-1">Selecione um contato para iniciar uma conversa</h2>
        <p class="text-slate-500 text-sm mb-8">Aqui você pode atender, organizar e acompanhar todas as conversas com seus clientes em um só lugar.</p>
        <div class="grid grid-cols-4 gap-4">
          ${[
            {ic:'message-circle',color:'bg-emerald-50 text-emerald-600',title:'Atendimento rápido',desc:'Responda seus clientes com mais agilidade.'},
            {ic:'users',color:'bg-blue-50 text-blue-600',title:'Organização',desc:'Use filas e etiquetas para manter tudo em ordem.'},
            {ic:'zap',color:'bg-violet-50 text-violet-600',title:'Mensagens rápidas',desc:'Salve mensagens e responda com 1 clique.'},
            {ic:'bar-chart-3',color:'bg-amber-50 text-amber-600',title:'Relatórios',desc:'Acompanhe seus resultados e performance.'},
          ].map(c=>`
            <div class="bg-white rounded-xl p-4 border border-slate-200 shadow-soft text-center">
              <div class="w-10 h-10 mx-auto rounded-lg ${c.color} flex items-center justify-center mb-2">${icon(c.ic,{size:20})}</div>
              <div class="font-semibold text-sm">${c.title}</div>
              <div class="text-xs text-slate-500 mt-1">${c.desc}</div>
            </div>`).join('')}
        </div>
        <div class="mt-8 bg-white border border-slate-200 rounded-xl p-3 text-sm flex items-center justify-center gap-2">
          ${icon('lightbulb',{size:16,cls:'text-amber-500'})}
          <span class="text-slate-700"><b>Dica:</b> Use as mensagens rápidas para otimizar seu atendimento e economizar tempo.</span>
          <a class="text-emerald-600 font-semibold ml-2" href="#" data-quickreply>Criar mensagem rápida</a>
        </div>
      </div>
    </div>
  `;
}

function conversationPanel(conv) {
  const c = findContact(conv.contactId);
  const channel = findChannel(c.channel);
  const queue = findQueue(conv.queue);
  const agent = conv.assigned ? findAgent(conv.assigned) : null;

  const messages = conv.messages.map(m => {
    const isMe = m.from === 'me';
    const checks = isMe ? (m.read ? icon('check-check',{size:14,cls:'text-sky-500'}) : icon('check-check',{size:14,cls:'text-slate-400'})) : '';
    return `
      <div class="flex ${isMe?'justify-end':'justify-start'} mb-2">
        <div class="bubble ${isMe?'bubble-out':'bubble-in'}">
          ${m.text.replace(/</g,'&lt;')}
          <div class="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-500">${m.time}${checks}</div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="flex-1 flex bg-slate-50">
      <div class="flex-1 flex flex-col">
        <div class="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3">
          ${avatar(c.name,{size:38})}
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm truncate">${c.name}</div>
            <div class="text-xs text-slate-500 truncate">${c.phone} · ${channel?.name||''}</div>
          </div>
          ${queue ? `<span class="pill" style="background:${queue.color}20;color:${queue.color}">${queue.name}</span>`:''}
          ${agent ? `<span class="pill pill-violet">${icon('bot',{size:12})} ${agent.name}</span>`:''}
          <button class="btn btn-ghost text-xs" data-action="register-sale">${icon('dollar-sign',{size:14})} Lançar venda</button>
          <button class="btn btn-ghost text-xs" data-action="assign-ia">${icon('bot',{size:14})} Atribuir IA</button>
          <button class="p-2 rounded hover:bg-slate-100">${icon('phone',{size:16,cls:'text-slate-600'})}</button>
          <button class="p-2 rounded hover:bg-slate-100">${icon('more-vertical',{size:16,cls:'text-slate-600'})}</button>
        </div>

        <div id="msg-scroll" class="flex-1 overflow-auto px-6 py-5 scroll-thin"
             style="background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22 viewBox=%220 0 120 120%22><circle cx=%2220%22 cy=%2220%22 r=%221%22 fill=%22%23e2e8f0%22/></svg>');">
          ${messages}
        </div>

        <div class="bg-white border-t border-slate-200 p-3">
          <div class="flex items-end gap-2">
            <button class="p-2 rounded hover:bg-slate-100" data-action="quickreply">${icon('zap',{size:18,cls:'text-violet-600'})}</button>
            <button class="p-2 rounded hover:bg-slate-100">${icon('paperclip',{size:18,cls:'text-slate-500'})}</button>
            <button class="p-2 rounded hover:bg-slate-100">${icon('smile',{size:18,cls:'text-slate-500'})}</button>
            <textarea id="msg-input" rows="1" class="textarea flex-1 resize-none" placeholder="Digite uma mensagem..."></textarea>
            <button class="p-2 rounded hover:bg-slate-100">${icon('mic',{size:18,cls:'text-slate-500'})}</button>
            <button id="btn-send" class="btn btn-primary">${icon('send',{size:16})}</button>
          </div>
          <div class="text-[11px] text-slate-400 mt-1.5 px-1">Pressione <b>/</b> para mensagens rápidas · <b>Enter</b> para enviar</div>
        </div>
      </div>

      <aside class="w-[300px] border-l border-slate-200 bg-white p-4 overflow-auto scroll-thin">
        <div class="text-center mb-4">
          ${avatar(c.name,{size:80,cls:'mx-auto'})}
          <div class="font-semibold mt-2">${c.name}</div>
          <div class="text-xs text-slate-500">${c.phone}</div>
        </div>
        <div class="space-y-3 text-sm">
          <div>
            <div class="label">Email</div>
            <div class="text-slate-700">${c.email||'—'}</div>
          </div>
          <div>
            <div class="label">Tags</div>
            <div class="flex flex-wrap gap-1">${c.tags.map(t=>`<span class="pill pill-gray">${t}</span>`).join('')||'<span class="text-slate-400 text-xs">Nenhuma</span>'}</div>
          </div>
          <div>
            <div class="label">Anotações</div>
            <textarea class="textarea" rows="3" data-notes="${c.id}">${c.notes||''}</textarea>
          </div>
          <div class="pt-2 border-t border-slate-100">
            <div class="label">Histórico de vendas</div>
            ${(getState().sales.filter(s=>s.contactId===c.id).map(s=>`
              <div class="flex items-center justify-between text-xs py-1">
                <span>${s.product}</span>
                <span class="font-semibold text-emerald-600">R$ ${s.value.toLocaleString('pt-BR')}</span>
              </div>`).join('')||'<div class="text-xs text-slate-400">Nenhuma venda registrada</div>')}
          </div>
          <button class="btn btn-ghost w-full justify-center" data-action="register-sale">${icon('plus',{size:14})} Registrar venda</button>
        </div>
      </aside>
    </div>
  `;
}

export function ChatsView() {
  const s = getState();
  const conv = activeConvId ? s.conversations.find(c=>c.id===activeConvId) : null;
  return `
    <div class="flex-1 flex h-full">
      ${leftPanel()}
      ${conv ? conversationPanel(conv) : welcomePanel()}
    </div>
  `;
}

export function bindChats() {
  document.querySelectorAll('[data-chat-tab]').forEach(el => {
    el.addEventListener('click', () => { activeTab = el.dataset.chatTab; window.dispatchEvent(new CustomEvent('app:render')); });
  });
  const filter = document.getElementById('chat-filter');
  if (filter) {
    filter.addEventListener('input', () => {
      chatFilter = filter.value;
      // re-render only the list pane efficiently — full rerender is fine
      window.dispatchEvent(new CustomEvent('app:render'));
      // restore focus
      setTimeout(()=>{ const f=document.getElementById('chat-filter'); if(f){ f.focus(); f.setSelectionRange(chatFilter.length,chatFilter.length);} },0);
    });
  }
  document.querySelectorAll('[data-conv]').forEach(el => {
    el.addEventListener('click', () => {
      activeConvId = el.dataset.conv;
      update(s => {
        const c = s.conversations.find(c=>c.id===activeConvId);
        if (c) c.unread = 0;
      });
    });
  });
  document.querySelectorAll('[data-new-conv]').forEach(el => {
    el.addEventListener('click', () => { toast('Nova conversa iniciada','success'); activeTab='chats'; window.dispatchEvent(new CustomEvent('app:render')); });
  });

  const send = document.getElementById('btn-send');
  const ta = document.getElementById('msg-input');
  const sendNow = () => {
    if (!ta || !ta.value.trim()) return;
    const text = ta.value.trim();
    update(s => {
      const c = s.conversations.find(c=>c.id===activeConvId);
      if (!c) return;
      c.messages.push({id:uid('m'), from:'me', text, time:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}), read:false});
      c.time = 'agora';
    });
    setTimeout(()=>{ const sc=document.getElementById('msg-scroll'); if(sc) sc.scrollTop = sc.scrollHeight; },10);
  };
  if (send) send.addEventListener('click', sendNow);
  if (ta) {
    ta.addEventListener('keydown', e => {
      if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendNow(); }
    });
    // auto scroll on render
    const sc = document.getElementById('msg-scroll');
    if (sc) sc.scrollTop = sc.scrollHeight;
  }

  // notes save
  document.querySelectorAll('[data-notes]').forEach(el => {
    el.addEventListener('blur', () => {
      const id = el.dataset.notes;
      update(s => { const ct = s.contacts.find(c=>c.id===id); if (ct) ct.notes = el.value; });
      toast('Anotações salvas','success');
    });
  });

  // register sale
  document.querySelectorAll('[data-action="register-sale"]').forEach(el => {
    el.addEventListener('click', () => {
      import('./crm.js').then(m => m.openSaleModal(activeConvId ? getState().conversations.find(c=>c.id===activeConvId)?.contactId : null));
    });
  });

  // assign IA
  document.querySelectorAll('[data-action="assign-ia"]').forEach(el => {
    el.addEventListener('click', () => openAssignAgent());
  });

  // quickreply
  document.querySelectorAll('[data-action="quickreply"]').forEach(el => {
    el.addEventListener('click', () => openQuickReplies());
  });
}

function openAssignAgent() {
  import('../components.js').then(({openModal, modalShell}) => {
    const s = getState();
    const body = `
      <div class="space-y-3">
        <div class="text-sm text-slate-600">Selecione um agente IA para conduzir essa conversa.</div>
        ${s.agents.map(a => `
          <label class="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-emerald-400 cursor-pointer" data-pick-agent="${a.id}">
            <div class="text-2xl">${a.emoji}</div>
            <div class="flex-1">
              <div class="font-semibold text-sm">${a.name} <span class="pill pill-gray ml-1">${a.role}</span></div>
              <div class="text-xs text-slate-500">${a.goal}</div>
              <div class="text-[11px] text-slate-400 mt-1">Modelo: ${a.model}</div>
            </div>
            <input type="radio" name="agent" />
          </label>`).join('')}
      </div>`;
    openModal(modalShell({title:'Atribuir Agente IA', body, footer:`<button class="btn btn-ghost" data-close>Cancelar</button>`}));
    document.querySelectorAll('[data-pick-agent]').forEach(el => {
      el.addEventListener('click', () => {
        const aid = el.dataset.pickAgent;
        update(s => { const c=s.conversations.find(c=>c.id===activeConvId); if (c) c.assigned = aid; });
        toast('Agente atribuído. A IA assumirá a próxima resposta.','success');
        document.getElementById('modal-root').innerHTML='';
      });
    });
  });
}

function openQuickReplies() {
  import('../components.js').then(({openModal, modalShell}) => {
    const s = getState();
    const body = `
      <div class="space-y-2">
        ${s.quickReplies.map(q => `
          <div class="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer" data-qr="${q.id}">
            <div>
              <div class="font-mono text-xs text-violet-600">${q.shortcut}</div>
              <div class="text-sm text-slate-700">${q.text}</div>
            </div>
            ${icon('arrow-right',{size:16,cls:'text-slate-400'})}
          </div>`).join('')}
      </div>`;
    openModal(modalShell({title:'Mensagens Rápidas', body, footer:`<button class="btn btn-ghost" data-close>Fechar</button>`}));
    document.querySelectorAll('[data-qr]').forEach(el => {
      el.addEventListener('click', () => {
        const q = getState().quickReplies.find(x=>x.id===el.dataset.qr);
        const ta = document.getElementById('msg-input');
        if (ta) ta.value = (ta.value ? ta.value+'\n' : '') + q.text;
        document.getElementById('modal-root').innerHTML='';
        if (ta) ta.focus();
      });
    });
  });
}
