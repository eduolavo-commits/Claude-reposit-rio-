import { getState, setView, loadState } from './state.js';
import { Sidebar, TopBar } from './components.js';
import { refreshIcons } from './icons.js';

import { ChatsView, bindChats }              from './views/chats.js';
import { FilaView, bindFila }                from './views/fila.js';
import { ContatosView, bindContatos }        from './views/contatos.js';
import { CrmView, bindCrm }                  from './views/crm.js';
import { DisparoView, bindDisparo }          from './views/disparo.js';
import { AutomacoesView, bindAutomacoes }    from './views/automacoes.js';
import { AgentesView, bindAgentes }          from './views/agentes.js';
import { RelatoriosView, bindRelatorios }    from './views/relatorios.js';
import { ConfiguracoesView, bindConfiguracoes } from './views/configuracoes.js';

const VIEWS = {
  chats:         { title: 'Atendimento',         render: ChatsView,         bind: bindChats,         hideTopbar:true },
  fila:          { title: 'Fila',                render: FilaView,          bind: bindFila },
  contatos:      { title: 'Contatos',            render: ContatosView,      bind: bindContatos },
  crm:           { title: 'CRM — Vendas',        render: CrmView,           bind: bindCrm },
  disparo:       { title: 'Mensagens em Massa',  render: DisparoView,       bind: bindDisparo },
  automacoes:    { title: 'Automações',          render: AutomacoesView,    bind: bindAutomacoes },
  agentes:       { title: 'Agentes IA',          render: AgentesView,       bind: bindAgentes },
  relatorios:    { title: 'Relatórios',          render: RelatoriosView,    bind: bindRelatorios },
  configuracoes: { title: 'Configurações',       render: ConfiguracoesView, bind: bindConfiguracoes },
};

function render() {
  loadState();
  const s = getState();
  const v = VIEWS[s.view] || VIEWS.chats;
  const root = document.getElementById('app');
  root.innerHTML = `
    ${Sidebar()}
    <main class="flex-1 flex flex-col h-full overflow-hidden">
      ${v.hideTopbar ? '' : TopBar({ title: v.title })}
      ${v.render()}
    </main>
  `;

  // sidebar nav
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => setView(el.dataset.nav));
  });
  const newBtn = document.getElementById('btn-new');
  if (newBtn) newBtn.addEventListener('click', () => setView('chats'));
  const lo = document.getElementById('btn-logout');
  if (lo) lo.addEventListener('click', () => alert('Logout (demo)'));

  v.bind && v.bind();

  refreshIcons();
}

window.addEventListener('app:render', render);
document.addEventListener('DOMContentLoaded', render);
render();
