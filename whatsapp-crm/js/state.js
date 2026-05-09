// Global app state, persisted to localStorage. Single source of truth.
const KEY = 'digisac_state_v1';

const seed = () => ({
  user: { name: 'Lucas Silva', email: 'lucas@digisac.app', role: 'Administrador', status: 'online' },

  view: 'chats', // current view

  channels: [
    { id: 'wa-cloud', name: 'WhatsApp Cloud API (Oficial)', type: 'whatsapp_cloud', connected: true, phone: '+55 11 98765-4321', verified: true },
    { id: 'wa-evo',   name: 'Evolution API — Vendas',       type: 'evolution',     connected: true, phone: '+55 11 91111-2222', verified: false },
    { id: 'wa-evo2',  name: 'Evolution API — Suporte',      type: 'evolution',     connected: false, phone: '+55 11 93333-4444', verified: false },
  ],

  contacts: [
    { id:'c1', name:'Sabrina Oliveira', phone:'+55 11 91234-5678', email:'sabrina@email.com', tags:['Lead Quente'], channel:'wa-cloud', notes:'Interessada no plano Premium' },
    { id:'c2', name:'Renan Nascimento', phone:'+55 11 99876-5432', email:'renan@email.com',   tags:['Suporte'],     channel:'wa-cloud', notes:'' },
    { id:'c3', name:'Mariana Costa',    phone:'+55 21 98888-7777', email:'mariana@email.com', tags:['Cliente'],     channel:'wa-cloud', notes:'Já comprou 2x' },
    { id:'c4', name:'Carlos Eduardo',   phone:'+55 11 95555-4444', email:'carlos@email.com',  tags:['Lead'],        channel:'wa-evo',   notes:'' },
    { id:'c5', name:'Juliana Mendes',   phone:'+55 31 94444-3333', email:'juliana@email.com', tags:['Cancelamento'],channel:'wa-evo',   notes:'Quer cancelar pedido' },
    { id:'c6', name:'Felipe Rocha',     phone:'+55 11 92222-1111', email:'felipe@email.com',  tags:['Cliente'],     channel:'wa-cloud', notes:'' },
    { id:'c7', name:'Beatriz Lima',     phone:'+55 47 96666-5555', email:'bia@email.com',     tags:['Lead'],        channel:'wa-evo2',  notes:'Perguntou sobre estoque' },
    { id:'c8', name:'André Pereira',    phone:'+55 21 97777-8888', email:'andre@email.com',   tags:['Lead'],        channel:'wa-cloud', notes:'' },
    { id:'c9', name:'Patrícia Souza',   phone:'+55 85 93535-7878', email:'patricia@email.com',tags:['VIP'],         channel:'wa-cloud', notes:'' },
  ],

  conversations: [
    { id:'t1', contactId:'c1', favorite:true,  unread:2, time:'09:41', queue:'vendas',   assigned:'agent_sdr',     status:'open',
      messages:[
        {id:'m1', from:'them', text:'Olá! Gostaria de saber mais sobre os planos.', time:'09:30'},
        {id:'m2', from:'me',   text:'Oi Sabrina! Claro, posso te ajudar 😊 Qual é o tamanho da sua operação?', time:'09:33', read:true},
        {id:'m3', from:'them', text:'Somos 8 pessoas, atendemos por WhatsApp.', time:'09:38'},
        {id:'m4', from:'them', text:'Vocês têm integração com a API oficial?', time:'09:41'},
      ]},
    { id:'t2', contactId:'c2', favorite:true,  unread:1, time:'Ontem', queue:'suporte',  assigned:'agent_support', status:'open',
      messages:[
        {id:'m1', from:'them', text:'Bom dia! Preciso de ajuda com meu acesso.', time:'08:21'},
      ]},
    { id:'t3', contactId:'c3', favorite:true,  unread:0, time:'Ontem', queue:'pos_venda',assigned:null,            status:'closed',
      messages:[
        {id:'m1', from:'them', text:'Obrigada pelo atendimento!', time:'17:02'},
        {id:'m2', from:'me',   text:'Disponha! Qualquer coisa estamos aqui 💚', time:'17:05', read:true},
      ]},
    { id:'t4', contactId:'c4', favorite:false, unread:0, time:'Ter',   queue:'vendas',   assigned:'agent_sdr',     status:'open',
      messages:[
        {id:'m1', from:'them', text:'Quando meu pedido será enviado?', time:'14:11'},
        {id:'m2', from:'me',   text:'Vou verificar agora!', time:'14:12', read:true},
      ]},
    { id:'t5', contactId:'c5', favorite:false, unread:0, time:'Ter',   queue:'recuperacao', assigned:'agent_recovery', status:'open',
      messages:[ {id:'m1', from:'them', text:'Quero cancelar meu pedido.', time:'10:00'} ]},
    { id:'t6', contactId:'c6', favorite:false, unread:0, time:'Seg',   queue:'pos_venda',assigned:null, status:'closed',
      messages:[ {id:'m1', from:'them', text:'Tudo certo, obrigado!', time:'09:18'} ]},
    { id:'t7', contactId:'c7', favorite:false, unread:0, time:'Seg',   queue:'vendas',   assigned:null, status:'queued',
      messages:[ {id:'m1', from:'them', text:'Vocês têm esse produto em estoque?', time:'15:33'} ]},
    { id:'t8', contactId:'c8', favorite:false, unread:0, time:'Sex',   queue:'vendas',   assigned:'agent_inside',  status:'open',
      messages:[ {id:'m1', from:'them', text:'Pode me mandar o link do checkout?', time:'11:00'} ]},
    { id:'t9', contactId:'c9', favorite:false, unread:0, time:'Sex',   queue:'vendas',   assigned:null, status:'queued',
      messages:[ {id:'m1', from:'them', text:'Boa tarde, quero conhecer o produto VIP.', time:'13:11'} ]},
  ],

  queues: [
    { id:'vendas',      name:'Vendas',     color:'#16a34a' },
    { id:'suporte',     name:'Suporte',    color:'#3b82f6' },
    { id:'recuperacao', name:'Recuperação',color:'#f59e0b' },
    { id:'pos_venda',   name:'Pós-Venda',  color:'#8b5cf6' },
  ],

  // Simple integrated CRM — kanban
  pipeline: [
    { id:'novo',         name:'Novo Lead' },
    { id:'qualificado',  name:'Qualificado' },
    { id:'proposta',     name:'Proposta' },
    { id:'negociacao',   name:'Negociação' },
    { id:'ganho',        name:'Ganho' },
    { id:'perdido',      name:'Perdido' },
  ],
  deals: [
    { id:'d1', title:'Plano Premium — Sabrina',   contactId:'c1', value:1490, stage:'qualificado', owner:'Lucas Silva', createdAt:'2026-05-08', notes:'Demonstração agendada.' },
    { id:'d2', title:'Plano Pro — Carlos',         contactId:'c4', value:790,  stage:'proposta',    owner:'Lucas Silva', createdAt:'2026-05-07', notes:'' },
    { id:'d3', title:'Upgrade VIP — Patrícia',     contactId:'c9', value:2990, stage:'negociacao',  owner:'Ana',         createdAt:'2026-05-06', notes:'Pediu desconto de 10%.' },
    { id:'d4', title:'Suporte Premium — Renan',    contactId:'c2', value:390,  stage:'novo',        owner:'Bruno',       createdAt:'2026-05-05', notes:'' },
    { id:'d5', title:'Renovação — Mariana',        contactId:'c3', value:990,  stage:'ganho',       owner:'Lucas Silva', createdAt:'2026-05-02', notes:'Pago via PIX.' },
  ],
  sales: [
    { id:'s1', dealId:'d5', contactId:'c3', value:990,  date:'2026-05-02', method:'PIX',         product:'Renovação Anual' },
    { id:'s2', dealId:null, contactId:'c6', value:1290, date:'2026-04-28', method:'Cartão 3x',   product:'Plano Pro Anual' },
  ],

  // Mass dispatch campaigns
  campaigns: [
    { id:'cp1', name:'MKL VIDEO QUINTO DIA UTIL - copy', channel:'wa-cloud', status:'Enviado', audience:4450, sent:4450, delivered:'98.4%', viewed:'60%', clicked:'0%', failed:'0.3%', date:'08/05/2026 16:53' },
    { id:'cp2', name:'betinha',                         channel:'wa-cloud', status:'Enviado', audience:390,  sent:null, delivered:null, viewed:null, clicked:null, failed:null, date:'07/05/2026 19:56' },
    { id:'cp3', name:'betinha',                         channel:'wa-cloud', status:'Enviado', audience:1304, sent:null, delivered:null, viewed:null, clicked:null, failed:null, date:'07/05/2026 15:20' },
    { id:'cp4', name:'leads api',                       channel:'wa-evo',   status:'Cancelado',audience:23712,sent:4080, delivered:'0%',  viewed:'0%',  clicked:'0%', failed:'99.9%', date:'07/05/2026 14:48' },
    { id:'cp5', name:'venda de leads',                  channel:'wa-cloud', status:'Enviado', audience:1328, sent:1328, delivered:'70.3%', viewed:'50.5%', clicked:'0%', failed:'0.7%', date:'07/05/2026 14:33' },
  ],

  // Automation flows
  flows: [
    { id:'f1', name:'Boas-vindas novo lead', active:true,  trigger:'contact_created',
      nodes:[
        { id:'n1', type:'trigger', x:60,  y:80,  title:'Início', body:'Quando: novo contato' },
        { id:'n2', type:'message', x:340, y:80,  title:'Enviar mensagem', body:'Olá {{nome}}! Bem-vindo 👋' },
        { id:'n3', type:'wait',    x:620, y:80,  title:'Esperar 10 min', body:'Aguardar 10 minutos' },
        { id:'n4', type:'message', x:880, y:80,  title:'Enviar mensagem #2', body:'Posso te ajudar a conhecer nossos planos?' },
      ],
      edges:[{from:'n1',to:'n2'},{from:'n2',to:'n3'},{from:'n3',to:'n4'}]
    },
    { id:'f2', name:'Recuperação carrinho', active:true, trigger:'cart_abandoned',
      nodes:[
        { id:'n1', type:'trigger', x:60,  y:80, title:'Início', body:'Quando: carrinho abandonado' },
        { id:'n2', type:'message', x:340, y:80, title:'Mensagem', body:'Você esqueceu algo no carrinho 🛒' },
        { id:'n3', type:'wait',    x:620, y:80, title:'Esperar 1h', body:'Aguardar 1 hora' },
        { id:'n4', type:'message', x:880, y:80, title:'Cupom', body:'Liberei 10% off, use: VOLTA10' },
      ],
      edges:[{from:'n1',to:'n2'},{from:'n2',to:'n3'},{from:'n3',to:'n4'}]
    },
  ],

  // AI Agents (Claude-powered)
  agents: [
    { id:'agent_sdr', name:'SDR Virtual', role:'SDR', model:'claude-opus-4-7', emoji:'🎯',
      goal:'Qualificar novos leads vindos do WhatsApp e marcar reunião com o time comercial.',
      systemPrompt:'Você é uma SDR experiente. Faça perguntas de qualificação BANT (orçamento, autoridade, necessidade, tempo). Seja simpática e objetiva. Sempre tente agendar uma reunião com vendedor humano.',
      temperature:0.4, active:true, channels:['wa-cloud'], queues:['vendas'], handoffOn:['preço','contrato','reunião'] },
    { id:'agent_inside', name:'Inside Sales', role:'Inside Sales', model:'claude-opus-4-7', emoji:'💼',
      goal:'Conduzir leads qualificados até o fechamento da venda.',
      systemPrompt:'Você é um vendedor consultivo. Seu objetivo é fechar a venda. Apresente planos, contorne objeções e envie link de checkout quando o lead estiver pronto.',
      temperature:0.5, active:true, channels:['wa-cloud'], queues:['vendas'], handoffOn:['cancelar','reembolso'] },
    { id:'agent_recovery', name:'Recuperação', role:'Recuperação', model:'claude-sonnet-4-6', emoji:'♻️',
      goal:'Reengajar clientes inativos e recuperar carrinhos/pedidos cancelados.',
      systemPrompt:'Você é especialista em recuperação. Seja empático, entenda o motivo do cancelamento e ofereça uma solução (cupom, parcelamento, suporte).',
      temperature:0.6, active:true, channels:['wa-evo'], queues:['recuperacao'], handoffOn:['jurídico','procon'] },
    { id:'agent_support', name:'Suporte N1', role:'Suporte', model:'claude-haiku-4-5-20251001', emoji:'🛟',
      goal:'Resolver dúvidas frequentes e abrir tickets quando necessário.',
      systemPrompt:'Você é o suporte N1. Responda dúvidas comuns usando a base de conhecimento. Se for caso técnico, abra ticket e transfira para humano.',
      temperature:0.3, active:true, channels:['wa-cloud','wa-evo2'], queues:['suporte'], handoffOn:['bug','reembolso','jurídico'] },
    { id:'agent_posvenda', name:'Pós-Venda', role:'Pós-Venda', model:'claude-sonnet-4-6', emoji:'🎁',
      goal:'Acompanhar clientes após a compra, coletar feedback e gerar upsell.',
      systemPrompt:'Você cuida do pós-venda. Pergunte sobre a experiência (NPS), ofereça upgrades e peça depoimento se a nota for >= 9.',
      temperature:0.6, active:false, channels:['wa-cloud'], queues:['pos_venda'], handoffOn:['problema','quero falar com humano'] },
  ],

  // Quick replies
  quickReplies: [
    { id:'q1', shortcut:'/oi',     text:'Olá! Tudo bem? 😊 Como posso te ajudar hoje?' },
    { id:'q2', shortcut:'/pix',    text:'Segue chave PIX: 00.000.000/0001-00. Após o pagamento, envie o comprovante por aqui.' },
    { id:'q3', shortcut:'/horario',text:'Atendemos de segunda a sexta, das 9h às 18h.' },
  ],

  apiSettings: {
    claude:    { apiKey:'', model:'claude-opus-4-7', maxTokens:1024 },
    waCloud:   { token:'', phoneId:'', businessId:'', wabaId:'' },
    evolution: { baseUrl:'https://evo.suaempresa.com', apiKey:'', instance:'vendas' },
  }
});

let _state = null;

export function loadState() {
  if (_state) return _state;
  try {
    const raw = localStorage.getItem(KEY);
    _state = raw ? JSON.parse(raw) : seed();
  } catch (e) {
    _state = seed();
  }
  return _state;
}

export function saveState() {
  if (!_state) return;
  localStorage.setItem(KEY, JSON.stringify(_state));
}

export function getState() { return loadState(); }

export function setView(view) {
  const s = getState();
  s.view = view;
  saveState();
  window.dispatchEvent(new CustomEvent('app:render'));
}

export function update(mutator) {
  const s = getState();
  mutator(s);
  saveState();
  window.dispatchEvent(new CustomEvent('app:render'));
}

export function resetState() {
  localStorage.removeItem(KEY);
  _state = null;
  loadState();
  window.dispatchEvent(new CustomEvent('app:render'));
}

// helpers
export function findContact(id) { return getState().contacts.find(c => c.id === id); }
export function findConv(id)    { return getState().conversations.find(c => c.id === id); }
export function findAgent(id)   { return getState().agents.find(a => a.id === id); }
export function findChannel(id) { return getState().channels.find(c => c.id === id); }
export function findQueue(id)   { return getState().queues.find(q => q.id === id); }

export function uid(prefix='id') { return prefix + '_' + Math.random().toString(36).slice(2,9); }
