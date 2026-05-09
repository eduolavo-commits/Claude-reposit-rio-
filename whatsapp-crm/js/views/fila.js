import { getState, update, findContact, findChannel, findQueue } from '../state.js';
import { avatar, toast } from '../components.js';
import { icon } from '../icons.js';

export function FilaView() {
  const s = getState();
  const queued = s.conversations.filter(c => c.status==='queued');

  return `
    <div class="flex-1 overflow-auto p-6 bg-slate-100">
      <div class="max-w-6xl mx-auto">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h1 class="text-xl font-bold">Fila de atendimento</h1>
            <div class="text-sm text-slate-500">${queued.length} conversas aguardando · distribuição automática por fila</div>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn btn-ghost">${icon('refresh-cw',{size:14})} Atualizar</button>
            <button class="btn btn-primary" data-action="claim-all">${icon('hand',{size:14})} Pegar próximo</button>
          </div>
        </div>

        <div class="grid grid-cols-4 gap-3 mb-5">
          ${s.queues.map(q => {
            const count = queued.filter(c=>c.queue===q.id).length;
            return `
              <div class="card p-4">
                <div class="flex items-center justify-between">
                  <span class="font-semibold text-sm" style="color:${q.color}">${q.name}</span>
                  <span class="pill" style="background:${q.color}20;color:${q.color}">${count}</span>
                </div>
                <div class="text-xs text-slate-500 mt-1">Tempo médio de espera: ${(2 + Math.floor(Math.random()*10))}min</div>
              </div>`;
          }).join('')}
        </div>

        <div class="card overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-slate-600">
              <tr>
                <th class="text-left p-3 font-semibold">Contato</th>
                <th class="text-left p-3 font-semibold">Canal</th>
                <th class="text-left p-3 font-semibold">Fila</th>
                <th class="text-left p-3 font-semibold">Última mensagem</th>
                <th class="text-left p-3 font-semibold">Tempo</th>
                <th class="text-right p-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${queued.map(c => {
                const ct = findContact(c.contactId);
                const ch = findChannel(ct.channel);
                const q  = findQueue(c.queue);
                const last = c.messages[c.messages.length-1]?.text || '';
                return `
                  <tr class="border-t border-slate-100 row-hover">
                    <td class="p-3">
                      <div class="flex items-center gap-2">
                        ${avatar(ct.name,{size:32})}
                        <div>
                          <div class="font-semibold">${ct.name}</div>
                          <div class="text-xs text-slate-500">${ct.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td class="p-3">${ch?.name||''}</td>
                    <td class="p-3"><span class="pill" style="background:${q?.color}20;color:${q?.color}">${q?.name}</span></td>
                    <td class="p-3 max-w-[280px] truncate text-slate-600">${last}</td>
                    <td class="p-3 text-slate-500">${c.time}</td>
                    <td class="p-3 text-right">
                      <button class="btn btn-primary text-xs" data-claim="${c.id}">Atender</button>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
          ${queued.length===0 ? '<div class="p-10 text-center text-slate-500 text-sm">Sem conversas na fila 🎉</div>':''}
        </div>
      </div>
    </div>
  `;
}

export function bindFila() {
  document.querySelectorAll('[data-claim]').forEach(el => {
    el.addEventListener('click', () => {
      update(s => {
        const c = s.conversations.find(x=>x.id===el.dataset.claim);
        if (c) { c.status='open'; c.assigned=null; }
      });
      toast('Conversa atribuída a você','success');
    });
  });
  const all = document.querySelector('[data-action="claim-all"]');
  if (all) all.addEventListener('click', () => {
    update(s => {
      const next = s.conversations.find(c=>c.status==='queued');
      if (next) { next.status='open'; }
    });
    toast('Próximo da fila atribuído','success');
  });
}
