import { icon, refreshIcons } from './icons.js';
import { getState, setView, findContact, findChannel } from './state.js';

// ---- Sidebar ----
export function Sidebar() {
  const s = getState();
  const items = [
    { id:'chats',         label:'Chats',           ic:'message-circle', badge: s.conversations.filter(c=>c.unread>0).length },
    { id:'fila',          label:'Fila',            ic:'inbox',          badge: s.conversations.filter(c=>c.status==='queued').length },
    { id:'contatos',      label:'Contatos',        ic:'users' },
    { id:'crm',           label:'CRM / Vendas',    ic:'briefcase' },
    { id:'disparo',       label:'Disparo em Massa',ic:'megaphone' },
    { id:'automacoes',    label:'Automações',      ic:'workflow' },
    { id:'agentes',       label:'Agentes IA',      ic:'bot' },
    { id:'relatorios',    label:'Relatórios',      ic:'bar-chart-3' },
    { id:'configuracoes', label:'Configurações',   ic:'settings' },
  ];

  return `
    <aside class="w-[240px] bg-sidebar flex-shrink-0 flex flex-col text-white">
      <div class="px-5 pt-5 pb-3 flex items-center gap-2">
        <div class="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center font-extrabold text-brand-500 text-lg">d</div>
        <div class="font-extrabold text-lg tracking-tight">digisac</div>
      </div>

      <button id="btn-new" class="mx-3 mt-2 mb-3 inline-flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold px-3 py-2.5 rounded-xl text-sm">
        ${icon('message-circle-plus',{size:16})} Novo atendimento
      </button>

      <nav class="flex-1 overflow-auto scroll-thin px-2 space-y-0.5">
        ${items.map(it => `
          <div class="side-link ${s.view===it.id?'active':''}" data-nav="${it.id}">
            ${icon(it.ic,{size:18,cls:'opacity-80'})}
            <span class="flex-1">${it.label}</span>
            ${it.badge ? `<span class="side-badge">${it.badge}</span>` : ''}
          </div>`).join('')}
      </nav>

      <div class="m-3 rounded-xl bg-white/5 p-3 text-sm">
        <div class="flex items-center gap-2 mb-1">
          <span class="w-2 h-2 rounded-full bg-brand-500"></span>
          <span class="font-semibold">Você está disponível</span>
        </div>
        <div class="text-white/60 text-xs">Atendendo normalmente</div>
      </div>

      <div class="px-3 pb-4">
        <button id="btn-logout" class="side-link w-full">${icon('log-out',{size:18,cls:'opacity-80'})}<span>Sair</span></button>
      </div>
    </aside>
  `;
}

// ---- Top bar (per-view) ----
export function TopBar({ title, right = '' } = {}) {
  const s = getState();
  return `
    <header class="h-14 bg-white border-b border-slate-200 flex items-center px-5 gap-4">
      <div class="flex-1 flex items-center gap-3">
        ${title ? `<h1 class="text-base font-semibold">${title}</h1>` : ''}
      </div>
      <div class="flex items-center gap-2">
        ${right}
        <button class="p-2 rounded-lg hover:bg-slate-100 relative">
          ${icon('bell',{size:18,cls:'text-slate-600'})}
          <span class="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
        </button>
        <button class="p-2 rounded-lg hover:bg-slate-100">${icon('help-circle',{size:18,cls:'text-slate-600'})}</button>
        <div class="ml-1 flex items-center gap-2 pl-3 border-l border-slate-200">
          <div class="text-right">
            <div class="text-sm font-semibold leading-tight">${s.user.name}</div>
            <div class="text-xs text-emerald-600 leading-tight">● Online</div>
          </div>
          <div class="avatar w-9 h-9 text-sm" style="background:linear-gradient(135deg,#0ea5e9,#1d4ed8)">LS</div>
        </div>
      </div>
    </header>
  `;
}

// ---- Avatar ----
export function avatar(name, opts = {}) {
  const size = opts.size || 40;
  const initials = (name || '?').split(' ').slice(0,2).map(s=>s[0]).join('').toUpperCase();
  const noChannel = opts.noChannel ? 'no-channel' : '';
  const cls = opts.cls || '';
  // deterministic color from name
  const palette = ['#0ea5e9','#7c3aed','#db2777','#ea580c','#16a34a','#0891b2','#65a30d','#9333ea','#e11d48'];
  let h=0; for (const ch of name||'') h = (h*31 + ch.charCodeAt(0)) >>> 0;
  const c1 = palette[h % palette.length];
  const c2 = palette[(h>>3) % palette.length];
  return `<div class="avatar ${noChannel} ${cls}" style="width:${size}px;height:${size}px;font-size:${size*0.36}px;background:linear-gradient(135deg,${c1},${c2})">${initials}</div>`;
}

// ---- Modal ----
export function openModal(html, opts = {}) {
  const root = document.getElementById('modal-root');
  const sizeCls = opts.size === 'lg' ? 'lg' : '';
  root.innerHTML = `
    <div class="modal-backdrop" data-modal-close>
      <div class="modal ${sizeCls}" data-modal-stop>${html}</div>
    </div>`;
  refreshIcons();
  root.querySelector('[data-modal-close]').addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-modal-close')) closeModal();
  });
  // close buttons
  root.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal));
}
export function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
}

export function modalShell({ title, body, footer = '' }) {
  return `
    <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
      <div class="font-semibold">${title}</div>
      <button class="p-1.5 rounded hover:bg-slate-100" data-close>${icon('x',{size:18})}</button>
    </div>
    <div class="px-6 py-5">${body}</div>
    ${footer ? `<div class="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">${footer}</div>` : ''}
  `;
}

// ---- Toast ----
export function toast(message, type='success') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const ic = type==='success' ? 'check-circle' : type==='error' ? 'alert-circle' : 'info';
  el.innerHTML = `${icon(ic,{size:18})}<span>${message}</span>`;
  root.appendChild(el);
  refreshIcons();
  setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(),300); }, 2400);
}

// ---- Empty state ----
export function emptyState({ ic='inbox', title='Nada por aqui', desc='', action='' }) {
  return `
    <div class="flex flex-col items-center justify-center text-center py-12 px-6">
      <div class="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">${icon(ic,{size:24,cls:'text-slate-500'})}</div>
      <div class="font-semibold text-slate-800">${title}</div>
      ${desc ? `<div class="text-sm text-slate-500 mt-1 max-w-sm">${desc}</div>` : ''}
      ${action ? `<div class="mt-4">${action}</div>` : ''}
    </div>`;
}

// Reflect any DOM-level changes that need icon re-init
export { refreshIcons };
