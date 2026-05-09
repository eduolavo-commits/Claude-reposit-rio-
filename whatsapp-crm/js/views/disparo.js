import { getState, update, findChannel, uid } from '../state.js';
import { openModal, modalShell, toast } from '../components.js';
import { icon } from '../icons.js';

export function DisparoView() {
  const s = getState();
  const totalSent = s.campaigns.reduce((a,c)=>a+(c.sent||0),0);
  const totalAud  = s.campaigns.reduce((a,c)=>a+(c.audience||0),0);

  return `
    <div class="flex-1 overflow-auto p-6 bg-slate-100">
      <div class="max-w-[1400px] mx-auto">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h1 class="text-xl font-bold">Mensagens em Massa</h1>
            <div class="text-sm text-slate-500">Envie campanhas via WhatsApp Cloud API ou Evolution API</div>
          </div>
          <button class="btn btn-violet" data-action="new-campaign">${icon('send',{size:14})} Enviar</button>
        </div>

        <div class="grid grid-cols-4 gap-3 mb-5">
          <div class="card p-4"><div class="text-xs text-slate-500 font-semibold">Campanhas</div><div class="text-2xl font-extrabold">${s.campaigns.length}</div></div>
          <div class="card p-4"><div class="text-xs text-slate-500 font-semibold">Mensagens enviadas</div><div class="text-2xl font-extrabold text-emerald-600">${totalSent.toLocaleString('pt-BR')}</div></div>
          <div class="card p-4"><div class="text-xs text-slate-500 font-semibold">Público total</div><div class="text-2xl font-extrabold text-blue-600">${totalAud.toLocaleString('pt-BR')}</div></div>
          <div class="card p-4"><div class="text-xs text-slate-500 font-semibold">Taxa média de entrega</div><div class="text-2xl font-extrabold text-violet-600">85.6%</div></div>
        </div>

        <div class="card overflow-hidden">
          <div class="p-4 border-b border-slate-100 flex items-center justify-between">
            <div class="font-semibold">Histórico de campanhas</div>
            <button class="btn btn-violet" data-action="new-campaign">${icon('plus',{size:14})} Enviar</button>
          </div>
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-slate-600">
              <tr>
                <th class="p-3 text-left font-semibold">Nome</th>
                <th class="p-3 text-center font-semibold">Canal</th>
                <th class="p-3 text-center font-semibold">Estado</th>
                <th class="p-3 text-center font-semibold">Público estimado <span title="Antes da deduplicação" class="cursor-help">ⓘ</span></th>
                <th class="p-3 text-center font-semibold">Enviado</th>
                <th class="p-3 text-center font-semibold">Entregue</th>
                <th class="p-3 text-center font-semibold">Visto</th>
                <th class="p-3 text-center font-semibold">Cliques</th>
                <th class="p-3 text-center font-semibold">Falhado</th>
                <th class="p-3 text-center font-semibold">Data</th>
                <th class="p-3"></th>
              </tr>
            </thead>
            <tbody>
              ${s.campaigns.map(c => `
                <tr class="border-t border-slate-100 row-hover">
                  <td class="p-3 font-medium">${c.name}</td>
                  <td class="p-3 text-center">
                    <span class="inline-flex w-7 h-7 rounded-full ch-wa items-center justify-center text-white" title="${findChannel(c.channel)?.name||''}">${icon('message-circle',{size:14})}</span>
                  </td>
                  <td class="p-3 text-center"><span class="pill ${c.status==='Enviado'?'pill-green':c.status==='Cancelado'?'pill-red':'pill-yellow'}">${c.status}</span></td>
                  <td class="p-3 text-center font-semibold">${c.audience?.toLocaleString('pt-BR')||'—'}</td>
                  <td class="p-3 text-center">${c.sent==null?'----':c.sent.toLocaleString('pt-BR')}</td>
                  <td class="p-3 text-center">${c.delivered??'----'}</td>
                  <td class="p-3 text-center">${c.viewed??'----'}</td>
                  <td class="p-3 text-center">${c.clicked??'----'}</td>
                  <td class="p-3 text-center">${c.failed??'----'}</td>
                  <td class="p-3 text-center text-xs text-slate-500">${c.date}</td>
                  <td class="p-3 text-center">
                    <button class="p-1.5 rounded hover:bg-slate-100" data-cp-menu="${c.id}">${icon('more-vertical',{size:14})}</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
          <div class="p-4 flex items-center justify-center gap-1.5">
            ${[1,2,3,4,5,6,'...',11].map((n,i)=>`
              <button class="${n===1?'bg-violet-600 text-white':'bg-white border border-slate-200 text-slate-600'} px-3 py-1.5 rounded text-sm font-semibold">${n}</button>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function bindDisparo() {
  document.querySelectorAll('[data-action="new-campaign"]').forEach(el => el.addEventListener('click', openCampaignModal));
  document.querySelectorAll('[data-cp-menu]').forEach(el => el.addEventListener('click', () => toast('Menu da campanha (demonstrativo)','info')));
}

function openCampaignModal() {
  const s = getState();
  const body = `
    <div class="space-y-4">
      <div><label class="label">Nome da campanha</label><input class="input" id="cp-name" placeholder="Ex: Black Friday — Leads quentes" /></div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label">Canal</label>
          <select class="select" id="cp-channel">
            ${s.channels.filter(c=>c.connected).map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="label">Tipo de envio</label>
          <select class="select" id="cp-type">
            <option value="text">Texto</option>
            <option value="template">Template (HSM)</option>
            <option value="image">Imagem + texto</option>
            <option value="flow">Fluxo de automação</option>
          </select>
        </div>
      </div>
      <div>
        <label class="label">Público</label>
        <div class="grid grid-cols-3 gap-2">
          <label class="border border-slate-200 rounded-lg p-3 flex items-center gap-2 cursor-pointer"><input type="radio" name="aud" checked /> Todos os contatos</label>
          <label class="border border-slate-200 rounded-lg p-3 flex items-center gap-2 cursor-pointer"><input type="radio" name="aud" /> Por tag</label>
          <label class="border border-slate-200 rounded-lg p-3 flex items-center gap-2 cursor-pointer"><input type="radio" name="aud" /> CSV / API</label>
        </div>
      </div>
      <div><label class="label">Mensagem</label>
        <textarea class="textarea" rows="5" id="cp-msg" placeholder="Olá {{nome}}! Temos uma oferta especial pra você...">Olá {{nome}}! 🎯 Temos uma oferta especial preparada pra você. Quer saber mais?</textarea>
        <div class="text-xs text-slate-500 mt-1">Variáveis disponíveis: <code>{{nome}}</code>, <code>{{telefone}}</code>, <code>{{email}}</code></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="label">Data/hora</label><input class="input" type="datetime-local" id="cp-date" /></div>
        <div><label class="label">Velocidade</label>
          <select class="select" id="cp-speed">
            <option>30 msg/min (recomendado)</option>
            <option>60 msg/min</option>
            <option>120 msg/min</option>
          </select>
        </div>
      </div>
      <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
        ${icon('alert-triangle',{size:16,cls:'flex-shrink-0 mt-0.5'})}
        <span>Para WhatsApp Cloud API, mensagens fora da janela de 24h precisam usar templates aprovados (HSM).</span>
      </div>
    </div>
  `;
  openModal(modalShell({
    title:'Nova campanha de disparo',
    body,
    footer:`
      <button class="btn btn-ghost" data-close>Cancelar</button>
      <button class="btn btn-violet" id="cp-save">${icon('send',{size:14})} Agendar disparo</button>
    `,
  }), { size:'lg' });

  document.getElementById('cp-save').addEventListener('click', () => {
    const data = {
      id: uid('cp'),
      name: document.getElementById('cp-name').value.trim() || 'Campanha',
      channel: document.getElementById('cp-channel').value,
      status: 'Agendado',
      audience: 1000 + Math.floor(Math.random()*5000),
      sent: 0, delivered:'0%', viewed:'0%', clicked:'0%', failed:'0%',
      date: new Date().toLocaleString('pt-BR'),
    };
    update(s => { s.campaigns.unshift(data); });
    document.getElementById('modal-root').innerHTML='';
    toast('Campanha agendada com sucesso','success');
  });
}
