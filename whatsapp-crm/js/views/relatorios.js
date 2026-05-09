import { getState } from '../state.js';
import { icon } from '../icons.js';

export function RelatoriosView() {
  const s = getState();
  const totalSales = s.sales.reduce((a,x)=>a+x.value,0);
  const dealsWon = s.deals.filter(d=>d.stage==='ganho').length;
  const totalConvs = s.conversations.length;

  // Fake bar chart
  const days = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  const vals = [12, 18, 24, 16, 28, 9, 4];
  const max = Math.max(...vals);

  return `
    <div class="flex-1 overflow-auto p-6 bg-slate-100">
      <div class="max-w-[1200px] mx-auto">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h1 class="text-xl font-bold">Relatórios</h1>
            <div class="text-sm text-slate-500">Performance do seu atendimento e vendas</div>
          </div>
          <div class="flex items-center gap-2">
            <select class="select max-w-[180px]"><option>Últimos 7 dias</option><option>Últimos 30 dias</option><option>Mês atual</option></select>
            <button class="btn btn-ghost">${icon('download',{size:14})} Exportar</button>
          </div>
        </div>

        <div class="grid grid-cols-4 gap-3 mb-5">
          ${[
            {label:'Conversas', value:totalConvs, color:'text-blue-600', ic:'message-square', delta:'+12% vs semana ant.'},
            {label:'Tempo médio resposta', value:'2m 14s', color:'text-violet-600', ic:'clock', delta:'-8%'},
            {label:'Vendas registradas', value:'R$ '+totalSales.toLocaleString('pt-BR'), color:'text-emerald-600', ic:'dollar-sign', delta:'+24%'},
            {label:'Deals ganhos', value:dealsWon, color:'text-amber-600', ic:'trophy', delta:'+5'},
          ].map(k => `
            <div class="card p-4">
              <div class="flex items-center justify-between mb-1">
                <div class="text-xs text-slate-500 font-semibold uppercase">${k.label}</div>
                ${icon(k.ic,{size:16,cls:k.color})}
              </div>
              <div class="text-2xl font-extrabold ${k.color}">${k.value}</div>
              <div class="text-xs text-emerald-600 mt-1">${k.delta}</div>
            </div>`).join('')}
        </div>

        <div class="grid grid-cols-3 gap-4">
          <div class="card p-5 col-span-2">
            <div class="font-semibold mb-4">Conversas por dia</div>
            <div class="flex items-end gap-3 h-48">
              ${vals.map((v,i)=>`
                <div class="flex-1 flex flex-col items-center gap-2">
                  <div class="w-full bg-emerald-500 rounded-t" style="height:${(v/max)*100}%; min-height:8px"></div>
                  <div class="text-xs text-slate-500">${days[i]}</div>
                </div>`).join('')}
            </div>
          </div>

          <div class="card p-5">
            <div class="font-semibold mb-4">Conversas por canal</div>
            ${[
              {label:'WhatsApp Cloud (Oficial)', val:62, color:'#16a34a'},
              {label:'Evolution — Vendas', val:28, color:'#7c5cff'},
              {label:'Evolution — Suporte', val:10, color:'#0ea5e9'},
            ].map(c => `
              <div class="mb-3">
                <div class="flex items-center justify-between text-xs mb-1">
                  <span>${c.label}</span><span class="font-semibold">${c.val}%</span>
                </div>
                <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div class="h-full" style="width:${c.val}%; background:${c.color}"></div>
                </div>
              </div>`).join('')}
          </div>

          <div class="card p-5 col-span-2">
            <div class="font-semibold mb-3">Performance dos Agentes IA</div>
            <table class="w-full text-sm">
              <thead class="text-slate-500 text-xs uppercase">
                <tr><th class="text-left p-2">Agente</th><th class="text-right p-2">Atendimentos</th><th class="text-right p-2">Resolvidos pela IA</th><th class="text-right p-2">Handoffs</th><th class="text-right p-2">Satisfação</th></tr>
              </thead>
              <tbody>
                ${s.agents.map(a => `
                  <tr class="border-t border-slate-100">
                    <td class="p-2"><span class="text-lg mr-1">${a.emoji}</span>${a.name}</td>
                    <td class="p-2 text-right">${50+Math.floor(Math.random()*200)}</td>
                    <td class="p-2 text-right text-emerald-600 font-semibold">${60+Math.floor(Math.random()*30)}%</td>
                    <td class="p-2 text-right">${Math.floor(Math.random()*30)}</td>
                    <td class="p-2 text-right">★ ${(4 + Math.random()).toFixed(1)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>

          <div class="card p-5">
            <div class="font-semibold mb-3">Top vendedores</div>
            ${['Lucas Silva','Ana','Bruno'].map((n,i) => `
              <div class="flex items-center gap-3 py-2 ${i<2?'border-b border-slate-100':''}">
                <div class="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">${i+1}</div>
                <div class="flex-1">
                  <div class="text-sm font-semibold">${n}</div>
                  <div class="text-xs text-slate-500">${5-i} vendas</div>
                </div>
                <div class="text-sm font-bold text-emerald-600">R$ ${(15000-i*4000).toLocaleString('pt-BR')}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function bindRelatorios() {}
