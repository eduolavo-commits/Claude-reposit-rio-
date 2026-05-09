import { getState, update, findContact, uid } from '../state.js';
import { avatar, openModal, modalShell, toast } from '../components.js';
import { icon } from '../icons.js';

let view = 'kanban'; // kanban | sales

export function CrmView() {
  const s = getState();
  const totalGanho = s.deals.filter(d=>d.stage==='ganho').reduce((a,d)=>a+d.value,0);
  const totalAberto = s.deals.filter(d=>!['ganho','perdido'].includes(d.stage)).reduce((a,d)=>a+d.value,0);
  const ticket = s.sales.length ? Math.round(s.sales.reduce((a,s)=>a+s.value,0)/s.sales.length) : 0;
  const conv = s.deals.length ? Math.round((s.deals.filter(d=>d.stage==='ganho').length / s.deals.length)*100) : 0;

  return `
    <div class="flex-1 overflow-auto p-6 bg-slate-100">
      <div class="max-w-[1400px] mx-auto">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h1 class="text-xl font-bold">CRM — Vendas</h1>
            <div class="text-sm text-slate-500">Pipeline de oportunidades + registro de vendas</div>
          </div>
          <div class="flex items-center gap-2">
            <div class="bg-white rounded-lg p-1 flex border border-slate-200">
              <button class="px-3 py-1.5 rounded text-sm font-semibold ${view==='kanban'?'bg-emerald-500 text-white':'text-slate-600'}" data-view="kanban">Kanban</button>
              <button class="px-3 py-1.5 rounded text-sm font-semibold ${view==='sales'?'bg-emerald-500 text-white':'text-slate-600'}" data-view="sales">Vendas</button>
            </div>
            <button class="btn btn-primary" data-action="new-deal">${icon('plus',{size:14})} Nova oportunidade</button>
            <button class="btn btn-violet" data-action="new-sale">${icon('dollar-sign',{size:14})} Lançar venda</button>
          </div>
        </div>

        <div class="grid grid-cols-4 gap-3 mb-5">
          ${[
            {label:'Em aberto',     value:'R$ '+totalAberto.toLocaleString('pt-BR'), color:'text-blue-600',    ic:'briefcase'},
            {label:'Ganho (mês)',   value:'R$ '+totalGanho.toLocaleString('pt-BR'),  color:'text-emerald-600', ic:'trophy'},
            {label:'Ticket médio',  value:'R$ '+ticket.toLocaleString('pt-BR'),       color:'text-violet-600',  ic:'tag'},
            {label:'Taxa de conversão', value: conv+'%',                              color:'text-amber-600',   ic:'target'},
          ].map(k => `
            <div class="card p-4">
              <div class="flex items-center justify-between mb-1">
                <div class="text-xs text-slate-500 font-semibold uppercase">${k.label}</div>
                ${icon(k.ic,{size:16,cls:k.color})}
              </div>
              <div class="text-2xl font-extrabold ${k.color}">${k.value}</div>
            </div>`).join('')}
        </div>

        ${view==='kanban' ? kanbanBoard() : salesTable()}
      </div>
    </div>
  `;
}

function kanbanBoard() {
  const s = getState();
  return `
    <div class="flex gap-3 overflow-x-auto pb-2 scroll-thin">
      ${s.pipeline.map(stage => {
        const deals = s.deals.filter(d=>d.stage===stage.id);
        const total = deals.reduce((a,d)=>a+d.value,0);
        return `
          <div class="kanban-col" data-stage="${stage.id}">
            <div class="flex items-center justify-between mb-3">
              <div class="font-semibold text-sm">${stage.name}</div>
              <span class="pill pill-gray">${deals.length}</span>
            </div>
            <div class="text-xs text-slate-500 mb-2">R$ ${total.toLocaleString('pt-BR')}</div>
            <div class="space-y-2 flex-1 overflow-auto scroll-thin" data-dropzone="${stage.id}">
              ${deals.map(d => {
                const c = findContact(d.contactId);
                return `
                  <div class="kanban-card" draggable="true" data-deal="${d.id}">
                    <div class="font-semibold text-sm mb-1">${d.title}</div>
                    <div class="text-xs text-slate-500 mb-2">${c?.name||''}</div>
                    <div class="flex items-center justify-between">
                      <span class="text-emerald-600 font-bold text-sm">R$ ${d.value.toLocaleString('pt-BR')}</span>
                      ${avatar(d.owner,{size:24,noChannel:true})}
                    </div>
                    ${d.notes ? `<div class="text-[11px] text-slate-500 mt-2 line-clamp-2">${d.notes}</div>`:''}
                  </div>`;
              }).join('')}
            </div>
          </div>`;
      }).join('')}
    </div>
  `;
}

function salesTable() {
  const s = getState();
  return `
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-slate-600">
          <tr>
            <th class="text-left p-3 font-semibold">Data</th>
            <th class="text-left p-3 font-semibold">Cliente</th>
            <th class="text-left p-3 font-semibold">Produto</th>
            <th class="text-left p-3 font-semibold">Pagamento</th>
            <th class="text-right p-3 font-semibold">Valor</th>
            <th class="text-right p-3 font-semibold">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${s.sales.map(sale => {
            const c = findContact(sale.contactId);
            return `
              <tr class="border-t border-slate-100 row-hover">
                <td class="p-3 text-slate-600">${sale.date}</td>
                <td class="p-3"><div class="flex items-center gap-2">${avatar(c?.name||'?',{size:28,noChannel:true})} <span class="font-semibold">${c?.name||'—'}</span></div></td>
                <td class="p-3">${sale.product}</td>
                <td class="p-3">${sale.method}</td>
                <td class="p-3 text-right font-bold text-emerald-600">R$ ${sale.value.toLocaleString('pt-BR')}</td>
                <td class="p-3 text-right">
                  <button class="p-1.5 rounded hover:bg-slate-100" data-del-sale="${sale.id}">${icon('trash-2',{size:14,cls:'text-rose-500'})}</button>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
      ${s.sales.length===0 ? '<div class="p-10 text-center text-slate-500 text-sm">Nenhuma venda registrada</div>':''}
    </div>
  `;
}

export function bindCrm() {
  document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click', () => { view = el.dataset.view; window.dispatchEvent(new CustomEvent('app:render')); }));
  const newDeal = document.querySelector('[data-action="new-deal"]'); if (newDeal) newDeal.addEventListener('click', openDealModal);
  const newSale = document.querySelector('[data-action="new-sale"]'); if (newSale) newSale.addEventListener('click', () => openSaleModal());
  document.querySelectorAll('[data-del-sale]').forEach(el => el.addEventListener('click', () => {
    if (!confirm('Excluir venda?')) return;
    update(s => { s.sales = s.sales.filter(x=>x.id!==el.dataset.delSale); });
    toast('Venda excluída','success');
  }));

  // drag and drop
  let dragId = null;
  document.querySelectorAll('[data-deal]').forEach(el => {
    el.addEventListener('dragstart', () => { dragId = el.dataset.deal; el.classList.add('dragging'); });
    el.addEventListener('dragend',   () => { el.classList.remove('dragging'); });
  });
  document.querySelectorAll('[data-dropzone]').forEach(el => {
    el.addEventListener('dragover', e => { e.preventDefault(); el.parentElement?.classList.add('ring-2','ring-emerald-400'); });
    el.addEventListener('dragleave', () => el.parentElement?.classList.remove('ring-2','ring-emerald-400'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.parentElement?.classList.remove('ring-2','ring-emerald-400');
      const stageId = el.dataset.dropzone;
      if (!dragId) return;
      update(s => {
        const d = s.deals.find(x=>x.id===dragId);
        if (d) d.stage = stageId;
        if (stageId === 'ganho' && d) {
          // auto-create sale
          const exists = s.sales.find(x=>x.dealId===d.id);
          if (!exists) {
            s.sales.unshift({ id:uid('s'), dealId:d.id, contactId:d.contactId, value:d.value, date:new Date().toISOString().slice(0,10), method:'A definir', product:d.title });
          }
        }
      });
      toast('Card movido' + (stageId==='ganho' ? ' · venda lançada automaticamente' : ''),'success');
    });
  });
}

export function openSaleModal(prefillContactId = null) {
  const s = getState();
  const body = `
    <div class="grid grid-cols-2 gap-4">
      <div class="col-span-2">
        <label class="label">Cliente</label>
        <select class="select" id="sl-contact">
          ${s.contacts.map(c=>`<option value="${c.id}" ${c.id===prefillContactId?'selected':''}>${c.name} — ${c.phone}</option>`).join('')}
        </select>
      </div>
      <div><label class="label">Produto / Serviço</label><input class="input" id="sl-product" placeholder="Ex: Plano Premium" /></div>
      <div><label class="label">Valor (R$)</label><input class="input" id="sl-value" type="number" step="0.01" placeholder="0,00" /></div>
      <div><label class="label">Forma de pagamento</label>
        <select class="select" id="sl-method">
          <option>PIX</option><option>Cartão à vista</option><option>Cartão 3x</option><option>Cartão 12x</option><option>Boleto</option><option>Transferência</option>
        </select>
      </div>
      <div><label class="label">Data</label><input class="input" id="sl-date" type="date" value="${new Date().toISOString().slice(0,10)}" /></div>
    </div>`;
  openModal(modalShell({
    title:'Lançar venda',
    body,
    footer:`
      <button class="btn btn-ghost" data-close>Cancelar</button>
      <button class="btn btn-primary" id="sl-save">${icon('check',{size:14})} Registrar venda</button>
    `
  }));
  document.getElementById('sl-save').addEventListener('click', () => {
    const data = {
      contactId: document.getElementById('sl-contact').value,
      product:   document.getElementById('sl-product').value.trim() || 'Venda',
      value:     parseFloat(document.getElementById('sl-value').value || '0'),
      method:    document.getElementById('sl-method').value,
      date:      document.getElementById('sl-date').value,
    };
    if (!data.value) { toast('Informe o valor','error'); return; }
    update(s => { s.sales.unshift({ id:uid('s'), dealId:null, ...data }); });
    document.getElementById('modal-root').innerHTML='';
    toast('Venda registrada com sucesso 💰','success');
  });
}

function openDealModal() {
  const s = getState();
  const body = `
    <div class="grid grid-cols-2 gap-4">
      <div class="col-span-2"><label class="label">Título</label><input class="input" id="dl-title" placeholder="Ex: Plano Premium - João" /></div>
      <div>
        <label class="label">Cliente</label>
        <select class="select" id="dl-contact">
          ${s.contacts.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div><label class="label">Valor (R$)</label><input class="input" id="dl-value" type="number" step="0.01" /></div>
      <div><label class="label">Estágio</label>
        <select class="select" id="dl-stage">
          ${s.pipeline.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}
        </select>
      </div>
      <div><label class="label">Responsável</label><input class="input" id="dl-owner" value="${s.user.name}" /></div>
      <div class="col-span-2"><label class="label">Observações</label><textarea class="textarea" id="dl-notes" rows="3"></textarea></div>
    </div>`;
  openModal(modalShell({
    title:'Nova oportunidade',
    body,
    footer:`<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="dl-save">Criar</button>`
  }));
  document.getElementById('dl-save').addEventListener('click', () => {
    const data = {
      id: uid('d'),
      title: document.getElementById('dl-title').value.trim(),
      contactId: document.getElementById('dl-contact').value,
      value: parseFloat(document.getElementById('dl-value').value||'0'),
      stage: document.getElementById('dl-stage').value,
      owner: document.getElementById('dl-owner').value,
      createdAt: new Date().toISOString().slice(0,10),
      notes: document.getElementById('dl-notes').value,
    };
    if (!data.title) { toast('Informe um título','error'); return; }
    update(s => { s.deals.unshift(data); });
    document.getElementById('modal-root').innerHTML='';
    toast('Oportunidade criada','success');
  });
}
