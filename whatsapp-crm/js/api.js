// Backend API client. Quando o backend está configurado, mensagens são enviadas
// via REST e atualizações chegam via WebSocket. Caso contrário, modo offline (localStorage).

import { update, getState, uid } from './state.js';
import { toast } from './components.js';

const KEY_BACKEND = 'digisac_backend_url';

export function getBackendUrl() {
  return localStorage.getItem(KEY_BACKEND) || '';
}
export function setBackendUrl(url) {
  if (url) localStorage.setItem(KEY_BACKEND, url.replace(/\/$/, ''));
  else localStorage.removeItem(KEY_BACKEND);
}
export function isBackendEnabled() { return !!getBackendUrl(); }

export async function apiHealth() {
  const url = getBackendUrl();
  if (!url) throw new Error('Backend não configurado');
  const r = await fetch(`${url}/api/health`);
  if (!r.ok) throw new Error('Backend offline');
  return r.json();
}

export async function apiSendMessage(to, text) {
  const url = getBackendUrl();
  if (!url) throw new Error('Backend não configurado');
  const r = await fetch(`${url}/api/messages/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, text }),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error || 'Falha ao enviar');
  return json;
}

export async function apiInstanceConnect() {
  const url = getBackendUrl();
  const r = await fetch(`${url}/api/instance/connect`);
  return r.json();
}
export async function apiInstanceStatus() {
  const url = getBackendUrl();
  const r = await fetch(`${url}/api/instance/status`);
  return r.json();
}

let ws = null;
let wsReconnectTimer = null;
export function connectWebSocket() {
  const url = getBackendUrl();
  if (!url) return;
  try { ws?.close(); } catch {}
  const wsUrl = url.replace(/^http/, 'ws') + '/ws';
  ws = new WebSocket(wsUrl);
  ws.onopen = () => { console.log('[ws] connected'); };
  ws.onclose = () => {
    console.log('[ws] closed, reconnecting in 3s');
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = setTimeout(connectWebSocket, 3000);
  };
  ws.onerror = e => console.error('[ws] error', e);
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      handleWsEvent(msg);
    } catch (e) { console.error(e); }
  };
}

function handleWsEvent(evt) {
  if (evt.type === 'message:received') {
    update(s => {
      // ensure contact exists
      let contact = s.contacts.find(c => normPhone(c.phone) === normPhone(evt.contact.phone));
      if (!contact) { contact = evt.contact; s.contacts.push(contact); }
      let conv = s.conversations.find(c => c.contactId === contact.id);
      if (!conv) {
        conv = { id: evt.conversationId, contactId: contact.id, messages: [], unread: 0, status:'open', favorite:false, time: evt.message.time, queue:'vendas', assigned:null };
        s.conversations.unshift(conv);
      }
      conv.messages.push(evt.message);
      conv.unread = (conv.unread||0) + 1;
      conv.time = evt.message.time;
    });
    toast(`📩 Nova mensagem de ${evt.contact?.name||evt.contact?.phone||'desconhecido'}`,'success');
  } else if (evt.type === 'message:sent') {
    // confirmation, nothing to do (we already optimistically appended)
  }
}

function normPhone(s='') { return String(s).replace(/\D/g, ''); }
