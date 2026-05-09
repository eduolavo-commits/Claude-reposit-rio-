import { getState, update, uid } from '../state.js';
import { openModal, modalShell, toast } from '../components.js';
import { icon } from '../icons.js';

let editingFlowId = null;
let selectedNode = null;

export function AutomacoesView() {
  if (editingFlowId) return flowEditor();

  const s = getState();
  return `
    <div class="flex-1 overflow-auto p-6 bg-slate-100">
      <div class="max-w-[1200px] mx-auto">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h1 class="text-xl font-bold">Automações / Fluxos</h1>
            <div class="text-sm text-slate-500">Crie fluxos de mensagens, atrasos e ramificações</div>
          </div>
          <button class="btn btn-violet" data-action="new-flow">${icon('plus',{size:14})} Novo fluxo</button>
        </div>

        <div class="grid grid-cols-3 gap-4">
          ${s.flows.map(f => `
            <div class="card p-4 cursor-pointer hover:shadow-md transition" data-edit-flow="${f.id}">
              <div class="flex items-start justify-between mb-2">
                <div class="w-10 h-10 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">${icon('workflow',{size:20})}</div>
                <span class="pill ${f.active?'pill-green':'pill-gray'}">${f.active?'Ativo':'Pausado'}</span>
              </div>
              <div class="font-semibold mb-1">${f.name}</div>
              <div class="text-xs text-slate-500 mb-3">Gatilho: <code class="bg-slate-100 px-1.5 rounded">${f.trigger}</code></div>
              <div class="flex items-center gap-3 text-xs text-slate-500">
                <span>${icon('share-2',{size:12})} ${f.nodes.length} etapas</span>
                <span>${icon('users',{size:12})} 0 em execução</span>
              </div>
              <div class="mt-3 flex items-center gap-2 pt-3 border-t border-slate-100">
                <button class="btn btn-ghost text-xs" data-edit-flow="${f.id}">${icon('pencil',{size:12})} Editar</button>
                <button class="btn btn-ghost text-xs" data-toggle-flow="${f.id}">${icon('power',{size:12})} ${f.active?'Pausar':'Ativar'}</button>
                <button class="btn btn-ghost text-xs ml-auto" data-del-flow="${f.id}">${icon('trash-2',{size:12,cls:'text-rose-500'})}</button>
              </div>
            </div>`).join('')}

          <div class="card p-4 border-2 border-dashed border-slate-300 bg-transparent shadow-none flex flex-col items-center justify-center cursor-pointer hover:border-violet-400 hover:bg-violet-50/30" data-action="new-flow">
            <div class="w-10 h-10 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center mb-2">${icon('plus',{size:20})}</div>
            <div class="font-semibold text-sm">Criar novo fluxo</div>
            <div class="text-xs text-slate-500 mt-1">Comece do zero ou use template</div>
          </div>
        </div>

        <div class="mt-8">
          <div class="font-semibold text-sm mb-3">Templates prontos</div>
          <div class="grid grid-cols-4 gap-3">
            ${[
              {name:'Boas-vindas',          desc:'Saudação para novos contatos',ic:'hand-heart'},
              {name:'Recuperação carrinho', desc:'Reativar leads inativos',     ic:'shopping-cart'},
              {name:'Confirmação de venda', desc:'Pós-venda automatizado',      ic:'check-circle'},
              {name:'Pesquisa NPS',         desc:'Coletar feedback do cliente', ic:'star'},
            ].map(t => `
              <div class="card p-3 cursor-pointer hover:border-violet-400 hover:shadow-md" data-template="${t.name}">
                <div class="w-8 h-8 rounded bg-violet-100 text-violet-600 flex items-center justify-center mb-2">${icon(t.ic,{size:16})}</div>
                <div class="font-semibold text-sm">${t.name}</div>
                <div class="text-xs text-slate-500">${t.desc}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function flowEditor() {
  const s = getState();
  const f = s.flows.find(x=>x.id===editingFlowId);
  if (!f) { editingFlowId = null; return AutomacoesView(); }

  const nodeIcons = { trigger:'play', message:'message-circle', wait:'clock', condition:'git-branch', tag:'tag', http:'globe', ai:'bot' };
  const nodeColors = { trigger:'#16a34a', message:'#7c5cff', wait:'#f59e0b', condition:'#0ea5e9', tag:'#ec4899', http:'#0891b2', ai:'#7c3aed' };

  const nodesHtml = f.nodes.map(n => `
    <div class="flow-node ${selectedNode===n.id?'selected':''}" data-node="${n.id}" style="left:${n.x}px;top:${n.y}px">
      <h4 style="color:${nodeColors[n.type]||'#0f172a'}">${icon(nodeIcons[n.type]||'circle',{size:14})} ${n.title}</h4>
      <p>${n.body}</p>
      <div class="text-[10px] text-slate-400 mt-1 uppercase font-bold">${n.type}</div>
    </div>
  `).join('');

  // SVG edges
  const edgesHtml = `
    <svg class="absolute inset-0 pointer-events-none" style="width:100%; height:100%">
      ${f.edges.map(e => {
        const a = f.nodes.find(n=>n.id===e.from);
        const b = f.nodes.find(n=>n.id===e.to);
        if (!a||!b) return '';
        const x1 = a.x + 230, y1 = a.y + 40;
        const x2 = b.x,       y2 = b.y + 40;
        const mx = (x1+x2)/2;
        return `<path d="M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" stroke="#94a3b8" stroke-width="2" fill="none" marker-end="url(#arrow)" />`;
      }).join('')}
      <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8"/></marker></defs>
    </svg>
  `;

  return `
    <div class="flex-1 flex flex-col bg-white">
      <div class="h-14 border-b border-slate-200 flex items-center px-4 gap-3 bg-violet-600 text-white">
        <button class="p-1.5 rounded hover:bg-white/10" data-back-flows>${icon('chevron-left',{size:18})}</button>
        <div class="text-sm opacity-80">Fluxos</div>
        <span>/</span>
        <input class="bg-transparent outline-none border-b border-transparent hover:border-white/40 focus:border-white text-sm font-semibold" id="flow-name" value="${f.name}" />
        <div class="flex-1"></div>
        <button class="p-1.5 rounded hover:bg-white/10">${icon('rotate-ccw',{size:16})}</button>
        <button class="p-1.5 rounded hover:bg-white/10">${icon('rotate-cw',{size:16})}</button>
        <button class="px-4 py-1.5 bg-white text-violet-700 rounded font-semibold text-sm" id="flow-publish">Publicar</button>
        <button class="p-1.5 rounded hover:bg-white/10">${icon('more-horizontal',{size:16})}</button>
      </div>

      <div class="flex-1 flex">
        <aside class="w-[260px] border-r border-slate-200 p-4 overflow-auto scroll-thin">
          <div class="font-semibold text-sm mb-3">Adicionar bloco</div>
          <div class="space-y-2">
            ${[
              {type:'message', label:'Enviar Mensagem', ic:'message-circle'},
              {type:'wait',    label:'Esperar',         ic:'clock'},
              {type:'condition',label:'Condição',       ic:'git-branch'},
              {type:'tag',     label:'Adicionar Tag',   ic:'tag'},
              {type:'ai',      label:'Agente IA',       ic:'bot'},
              {type:'http',    label:'Chamada HTTP',    ic:'globe'},
            ].map(b => `
              <button class="w-full flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg hover:border-violet-400 hover:bg-violet-50 text-left" data-add-node="${b.type}">
                <span class="w-8 h-8 rounded bg-violet-100 text-violet-600 flex items-center justify-center">${icon(b.ic,{size:16})}</span>
                <span class="text-sm font-medium">${b.label}</span>
              </button>`).join('')}
          </div>

          ${selectedNode ? renderNodeEditor(f) : `
            <div class="mt-6 p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
              Clique num bloco do canvas para editar.
            </div>
          `}
        </aside>

        <div class="flex-1 relative overflow-auto flow-canvas" id="flow-canvas">
          ${edgesHtml}
          ${nodesHtml}
        </div>
      </div>
    </div>
  `;
}

function renderNodeEditor(flow) {
  const n = flow.nodes.find(x=>x.id===selectedNode);
  if (!n) return '';
  return `
    <div class="mt-6 p-3 bg-violet-50 border border-violet-200 rounded-lg">
      <div class="font-semibold text-sm text-violet-700 mb-2">Editar bloco · ${n.type}</div>
      <label class="label">Título</label>
      <input class="input" id="ne-title" value="${n.title}" />
      <label class="label mt-2">Conteúdo</label>
      <textarea class="textarea" id="ne-body" rows="3">${n.body}</textarea>
      <div class="flex gap-2 mt-3">
        <button class="btn btn-violet flex-1" id="ne-save">Salvar</button>
        <button class="btn btn-danger" id="ne-del">${icon('trash-2',{size:14})}</button>
      </div>
    </div>
  `;
}

export function bindAutomacoes() {
  if (editingFlowId) return bindFlowEditor();

  document.querySelectorAll('[data-edit-flow]').forEach(el => el.addEventListener('click', () => {
    editingFlowId = el.dataset.editFlow;
    selectedNode = null;
    window.dispatchEvent(new CustomEvent('app:render'));
  }));
  document.querySelectorAll('[data-toggle-flow]').forEach(el => el.addEventListener('click', e => {
    e.stopPropagation();
    update(s => { const f=s.flows.find(x=>x.id===el.dataset.toggleFlow); if (f) f.active=!f.active; });
    toast('Status do fluxo atualizado','success');
  }));
  document.querySelectorAll('[data-del-flow]').forEach(el => el.addEventListener('click', e => {
    e.stopPropagation();
    if (!confirm('Excluir fluxo?')) return;
    update(s => { s.flows = s.flows.filter(x=>x.id!==el.dataset.delFlow); });
    toast('Fluxo excluído','success');
  }));

  document.querySelectorAll('[data-action="new-flow"]').forEach(el => el.addEventListener('click', () => createFlow()));
  document.querySelectorAll('[data-template]').forEach(el => el.addEventListener('click', () => createFlow(el.dataset.template)));
}

function createFlow(templateName = null) {
  const id = uid('f');
  const name = templateName || 'Novo fluxo';
  const flow = {
    id, name, active:false, trigger:'manual',
    nodes:[
      { id:'n1', type:'trigger', x:60, y:80, title:'Início', body:'Quando: gatilho' },
      { id:'n2', type:'message', x:340, y:80, title:'Enviar mensagem', body:'Olá {{nome}}!' },
    ],
    edges:[{from:'n1',to:'n2'}],
  };
  update(s => { s.flows.unshift(flow); });
  editingFlowId = id;
  window.dispatchEvent(new CustomEvent('app:render'));
}

function bindFlowEditor() {
  const back = document.querySelector('[data-back-flows]');
  if (back) back.addEventListener('click', () => { editingFlowId = null; selectedNode = null; window.dispatchEvent(new CustomEvent('app:render')); });

  const nameInput = document.getElementById('flow-name');
  if (nameInput) nameInput.addEventListener('change', () => {
    update(s => { const f=s.flows.find(x=>x.id===editingFlowId); if (f) f.name = nameInput.value; });
    toast('Nome do fluxo atualizado','success');
  });

  const pub = document.getElementById('flow-publish');
  if (pub) pub.addEventListener('click', () => {
    update(s => { const f=s.flows.find(x=>x.id===editingFlowId); if (f) f.active = true; });
    toast('Fluxo publicado e ativo 🚀','success');
  });

  document.querySelectorAll('[data-add-node]').forEach(el => el.addEventListener('click', () => {
    const type = el.dataset.addNode;
    update(s => {
      const f = s.flows.find(x=>x.id===editingFlowId);
      if (!f) return;
      const id = uid('n');
      const last = f.nodes[f.nodes.length-1];
      const x = (last?.x || 60) + 280;
      const y = last?.y || 80;
      const titles = { message:'Enviar Mensagem', wait:'Esperar', condition:'Condição', tag:'Adicionar Tag', http:'Chamada HTTP', ai:'Agente IA' };
      f.nodes.push({ id, type, x, y, title: titles[type]||type, body:'Configurar...' });
      if (last) f.edges.push({ from: last.id, to: id });
    });
  }));

  // node click → select
  document.querySelectorAll('[data-node]').forEach(el => {
    el.addEventListener('mousedown', startDrag);
    el.addEventListener('click', e => {
      if (el.dataset.dragged) { delete el.dataset.dragged; return; }
      selectedNode = el.dataset.node;
      window.dispatchEvent(new CustomEvent('app:render'));
    });
  });

  if (selectedNode) {
    const save = document.getElementById('ne-save');
    if (save) save.addEventListener('click', () => {
      update(s => {
        const f = s.flows.find(x=>x.id===editingFlowId);
        const n = f?.nodes.find(x=>x.id===selectedNode);
        if (!n) return;
        n.title = document.getElementById('ne-title').value;
        n.body = document.getElementById('ne-body').value;
      });
      toast('Bloco salvo','success');
    });
    const del = document.getElementById('ne-del');
    if (del) del.addEventListener('click', () => {
      if (!confirm('Excluir bloco?')) return;
      update(s => {
        const f = s.flows.find(x=>x.id===editingFlowId);
        if (!f) return;
        f.nodes = f.nodes.filter(n=>n.id!==selectedNode);
        f.edges = f.edges.filter(e=>e.from!==selectedNode && e.to!==selectedNode);
      });
      selectedNode = null;
      toast('Bloco excluído','success');
    });
  }
}

function startDrag(e) {
  e.preventDefault();
  const el = e.currentTarget;
  const id = el.dataset.node;
  const startX = e.clientX, startY = e.clientY;
  const f = getState().flows.find(x=>x.id===editingFlowId);
  const n = f.nodes.find(x=>x.id===id);
  const ox = n.x, oy = n.y;
  let moved = false;

  function move(ev) {
    const dx = ev.clientX - startX, dy = ev.clientY - startY;
    if (Math.abs(dx)+Math.abs(dy) > 3) moved = true;
    el.style.left = (ox+dx)+'px';
    el.style.top  = (oy+dy)+'px';
  }
  function up(ev) {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    if (!moved) return;
    el.dataset.dragged = '1';
    const dx = ev.clientX - startX, dy = ev.clientY - startY;
    update(s => { const ff=s.flows.find(x=>x.id===editingFlowId); const nn=ff?.nodes.find(x=>x.id===id); if (nn){ nn.x = ox+dx; nn.y = oy+dy; }});
  }
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}
