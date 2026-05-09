import { getState, update, findChannel, uid } from '../state.js';
import { avatar, openModal, modalShell, toast } from '../components.js';
import { icon } from '../icons.js';

let search = '';
let tagFilter = '';

export function ContatosView() {
  const s = getState();
  const allTags = Array.from(new Set(s.contacts.flatMap(c=>c.tags)));
  let list = s.contacts.slice();
  if (search) {
    const f = search.toLowerCase();
    list = list.filter(c => c.name.toLowerCase().includes(f) || c.phone.includes(f) || (c.email||'').toLowerCase().includes(f));
  }
  if (tagFilter) list = list.filter(c => c.tags.includes(tagFilter));

  return `
    <div class="flex-1 overflow-auto p-6 bg-slate-100">
      <div class="max-w-6xl mx-auto">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h1 class="text-xl font-bold">Contatos</h1>
            <div class="text-sm text-slate-500">${s.contacts.length} contatos cadastrados</div>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn btn-ghost" data-action="import">${icon('upload',{size:14})} Importar CSV</button>
            <button class="btn btn-primary" data-action="new-contact">${icon('plus',{size:14})} Novo contato</button>
          </div>
        </div>

        <div class="card p-3 mb-3 flex items-center gap-3">
          <div class="relative flex-1">
            ${icon('search',{size:16,cls:'absolute left-3 top-1/2 -translate-y-1/2 text-slate-400'})}
            <input id="ct-search" class="input pl-9" placeholder="Buscar por nome, telefone, email..." value="${search}" />
          </div>
          <select id="ct-tag" class="select max-w-[200px]">
            <option value="">Todas as tags</option>
            ${allTags.map(t=>`<option ${t===tagFilter?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>

        <div class="card overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-slate-600">
              <tr>
                <th class="text-left p-3 font-semibold">Nome</th>
                <th class="text-left p-3 font-semibold">Telefone</th>
                <th class="text-left p-3 font-semibold">Email</th>
                <th class="text-left p-3 font-semibold">Canal</th>
                <th class="text-left p-3 font-semibold">Tags</th>
                <th class="text-right p-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(c => `
                <tr class="border-t border-slate-100 row-hover">
                  <td class="p-3">
                    <div class="flex items-center gap-2">
                      ${avatar(c.name,{size:32,noChannel:true})}
                      <div class="font-semibold">${c.name}</div>
                    </div>
                  </td>
                  <td class="p-3 text-slate-600">${c.phone}</td>
                  <td class="p-3 text-slate-600">${c.email||'—'}</td>
                  <td class="p-3 text-slate-600">${findChannel(c.channel)?.name||'—'}</td>
                  <td class="p-3">${c.tags.map(t=>`<span class="pill pill-gray mr-1">${t}</span>`).join('')}</td>
                  <td class="p-3 text-right">
                    <button class="p-1.5 rounded hover:bg-slate-100" data-edit="${c.id}">${icon('pencil',{size:14,cls:'text-slate-500'})}</button>
                    <button class="p-1.5 rounded hover:bg-slate-100" data-del="${c.id}">${icon('trash-2',{size:14,cls:'text-rose-500'})}</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function bindContatos() {
  const sb = document.getElementById('ct-search');
  if (sb) sb.addEventListener('input', () => { search = sb.value; window.dispatchEvent(new CustomEvent('app:render')); setTimeout(()=>{const e=document.getElementById('ct-search');if(e){e.focus();e.setSelectionRange(search.length,search.length);}},0); });
  const tg = document.getElementById('ct-tag');
  if (tg) tg.addEventListener('change', () => { tagFilter = tg.value; window.dispatchEvent(new CustomEvent('app:render')); });

  const newBtn = document.querySelector('[data-action="new-contact"]');
  if (newBtn) newBtn.addEventListener('click', () => contactModal());

  document.querySelectorAll('[data-edit]').forEach(el => el.addEventListener('click', () => {
    const c = getState().contacts.find(x=>x.id===el.dataset.edit);
    contactModal(c);
  }));
  document.querySelectorAll('[data-del]').forEach(el => el.addEventListener('click', () => {
    if (!confirm('Excluir contato?')) return;
    update(s => { s.contacts = s.contacts.filter(c=>c.id!==el.dataset.del); });
    toast('Contato excluído','success');
  }));

  const imp = document.querySelector('[data-action="import"]');
  if (imp) imp.addEventListener('click', () => toast('Funcionalidade demonstrativa: integração CSV configurável.','info'));
}

function contactModal(contact = null) {
  const s = getState();
  const c = contact || { id:'', name:'', phone:'', email:'', tags:[], channel:s.channels[0]?.id, notes:'' };
  const body = `
    <div class="grid grid-cols-2 gap-4">
      <div class="col-span-2"><label class="label">Nome</label><input class="input" id="f-name" value="${c.name}" /></div>
      <div><label class="label">Telefone</label><input class="input" id="f-phone" value="${c.phone}" placeholder="+55 11 99999-9999" /></div>
      <div><label class="label">Email</label><input class="input" id="f-email" value="${c.email||''}" /></div>
      <div><label class="label">Canal</label>
        <select class="select" id="f-channel">
          ${s.channels.map(ch=>`<option value="${ch.id}" ${ch.id===c.channel?'selected':''}>${ch.name}</option>`).join('')}
        </select>
      </div>
      <div><label class="label">Tags (separadas por vírgula)</label><input class="input" id="f-tags" value="${(c.tags||[]).join(', ')}" /></div>
      <div class="col-span-2"><label class="label">Anotações</label><textarea class="textarea" id="f-notes" rows="3">${c.notes||''}</textarea></div>
    </div>`;
  openModal(modalShell({
    title: contact ? 'Editar contato' : 'Novo contato',
    body,
    footer: `
      <button class="btn btn-ghost" data-close>Cancelar</button>
      <button class="btn btn-primary" id="ct-save">Salvar</button>
    `
  }));
  document.getElementById('ct-save').addEventListener('click', () => {
    const data = {
      name: document.getElementById('f-name').value.trim(),
      phone: document.getElementById('f-phone').value.trim(),
      email: document.getElementById('f-email').value.trim(),
      channel: document.getElementById('f-channel').value,
      tags: document.getElementById('f-tags').value.split(',').map(s=>s.trim()).filter(Boolean),
      notes: document.getElementById('f-notes').value,
    };
    if (!data.name || !data.phone) { toast('Nome e telefone são obrigatórios','error'); return; }
    update(s => {
      if (contact) {
        Object.assign(s.contacts.find(x=>x.id===contact.id), data);
      } else {
        s.contacts.unshift({ id:uid('c'), ...data });
      }
    });
    document.getElementById('modal-root').innerHTML='';
    toast('Contato salvo','success');
  });
}
