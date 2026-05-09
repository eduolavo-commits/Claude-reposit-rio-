import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data.json');

const PORT = parseInt(process.env.PORT || '3001');
const EVO_URL = (process.env.EVO_URL || 'http://localhost:8080').replace(/\/$/, '');
const EVO_KEY = process.env.EVO_KEY || 'minhachave123';
const EVO_INSTANCE = process.env.EVO_INSTANCE || 'vendas';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// ---- storage (single JSON file) ----
function load() {
  if (!fs.existsSync(DATA_FILE)) return { contacts: [], conversations: [], sales: [], deals: [] };
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); }
  catch { return { contacts: [], conversations: [], sales: [], deals: [] }; }
}
function save(d) { fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2)); }
let db = load();

const uid = (p='id') => p + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
const nowTime = () => new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });

// ---- evolution client ----
async function evoFetch(pathSeg, opts = {}) {
  const url = `${EVO_URL}${pathSeg}`;
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY, ...(opts.headers||{}) },
  });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`Evolution ${res.status}: ${typeof body==='string'?body:JSON.stringify(body)}`);
  return body;
}

// ---- express app ----
const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

app.get('/api/health', async (req, res) => {
  let evolution = 'unknown';
  try { await evoFetch('/'); evolution = 'ok'; } catch (e) { evolution = 'unreachable: ' + e.message; }
  res.json({ status: 'ok', evolution, instance: EVO_INSTANCE });
});

app.get('/api/state', (req, res) => res.json(db));

app.post('/api/state/reset', (req, res) => {
  db = { contacts: [], conversations: [], sales: [], deals: [] };
  save(db); broadcast({ type:'state:reset' });
  res.json({ ok: true });
});

// QR code / connection status
app.get('/api/instance/connect', async (req, res) => {
  try {
    const r = await evoFetch(`/instance/connect/${EVO_INSTANCE}`);
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/instance/status', async (req, res) => {
  try {
    const r = await evoFetch(`/instance/connectionState/${EVO_INSTANCE}`);
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Send message
app.post('/api/messages/send', async (req, res) => {
  const { to, text } = req.body || {};
  if (!to || !text) return res.status(400).json({ error: 'to and text are required' });
  const phone = String(to).replace(/\D/g, '');
  try {
    const r = await evoFetch(`/message/sendText/${EVO_INSTANCE}`, {
      method: 'POST',
      body: JSON.stringify({ number: phone, text })
    });
    // Persist locally
    let contact = db.contacts.find(c => normPhone(c.phone) === phone);
    if (!contact) {
      contact = { id: uid('c'), name: phone, phone, channel: 'wa-evo', tags: [] };
      db.contacts.push(contact);
    }
    let conv = db.conversations.find(c => c.contactId === contact.id);
    if (!conv) {
      conv = { id: uid('t'), contactId: contact.id, messages: [], unread: 0, status: 'open', favorite: false, time: nowTime() };
      db.conversations.push(conv);
    }
    const msg = { id: uid('m'), from: 'me', text, time: nowTime(), read: false };
    conv.messages.push(msg);
    conv.time = nowTime();
    save(db);
    broadcast({ type: 'message:sent', conversationId: conv.id, message: msg, contact });
    res.json({ ok: true, evolution: r, message: msg, conversation: conv });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Webhook receiver (Evolution → here)
app.post('/webhook/evolution', (req, res) => {
  try {
    const evt = req.body || {};
    const event = evt.event || '';
    if (event === 'messages.upsert' || event === 'messages.update') {
      const m = evt.data;
      if (!m || !m.key) return res.sendStatus(200);
      if (m.key.fromMe) return res.sendStatus(200); // ignore self echoes
      const phone = String(m.key.remoteJid || '').split('@')[0];
      const text =
        m.message?.conversation ||
        m.message?.extendedTextMessage?.text ||
        (m.message?.imageMessage ? '[imagem]' :
         m.message?.audioMessage ? '[áudio]' :
         m.message?.videoMessage ? '[vídeo]' :
         m.message?.documentMessage ? '[documento]' :
         '[mensagem]');
      let contact = db.contacts.find(c => normPhone(c.phone) === phone);
      if (!contact) {
        contact = { id: uid('c'), name: m.pushName || phone, phone: '+'+phone, channel: 'wa-evo', tags: [] };
        db.contacts.push(contact);
      }
      let conv = db.conversations.find(c => c.contactId === contact.id);
      if (!conv) {
        conv = { id: uid('t'), contactId: contact.id, messages: [], unread: 0, status: 'open', favorite: false, time: nowTime() };
        db.conversations.push(conv);
      }
      const msg = { id: uid('m'), from: 'them', text, time: nowTime() };
      conv.messages.push(msg);
      conv.unread = (conv.unread || 0) + 1;
      conv.time = nowTime();
      save(db);
      broadcast({ type: 'message:received', conversationId: conv.id, message: msg, contact });
      console.log(`📩 ${contact.name}: ${text}`);
    }
    res.sendStatus(200);
  } catch (e) {
    console.error('webhook error:', e);
    res.sendStatus(200);
  }
});

// CRM endpoints
app.get('/api/contacts', (req, res) => res.json(db.contacts));
app.post('/api/contacts', (req, res) => {
  const c = { id: uid('c'), tags: [], channel: 'wa-evo', ...req.body };
  db.contacts.push(c); save(db); broadcast({ type:'contact:created', contact:c });
  res.json(c);
});
app.delete('/api/contacts/:id', (req, res) => {
  db.contacts = db.contacts.filter(c => c.id !== req.params.id);
  save(db); broadcast({ type:'contact:deleted', id:req.params.id });
  res.json({ ok: true });
});

app.get('/api/sales', (req, res) => res.json(db.sales));
app.post('/api/sales', (req, res) => {
  const s = { id: uid('s'), date: new Date().toISOString().slice(0,10), ...req.body };
  db.sales.unshift(s); save(db); broadcast({ type:'sale:created', sale:s });
  res.json(s);
});

// Claude proxy (so the API key never leaves the server)
app.post('/api/claude/chat', async (req, res) => {
  if (!ANTHROPIC_API_KEY) return res.status(400).json({ error: 'ANTHROPIC_API_KEY not configured' });
  const { model = 'claude-opus-4-7', system = '', messages = [], max_tokens = 1024, temperature = 0.5 } = req.body || {};
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model, system, messages, max_tokens, temperature })
    });
    const json = await r.json();
    res.json(json);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function normPhone(s='') { return String(s).replace(/\D/g, ''); }

// ---- HTTP + WS ----
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();
wss.on('connection', ws => {
  clients.add(ws);
  ws.send(JSON.stringify({ type:'hello', ts: Date.now() }));
  ws.on('close', () => clients.delete(ws));
});
function broadcast(msg) {
  const payload = JSON.stringify(msg);
  for (const c of clients) if (c.readyState === 1) c.send(payload);
}

server.listen(PORT, () => {
  console.log('');
  console.log('  🚀 Digisac Backend rodando');
  console.log('  ───────────────────────────────────');
  console.log(`  • API:        http://localhost:${PORT}/api/health`);
  console.log(`  • WebSocket:  ws://localhost:${PORT}/ws`);
  console.log(`  • Evolution:  ${EVO_URL} (instance: ${EVO_INSTANCE})`);
  console.log(`  • Webhook:    POST ${process.env.PUBLIC_URL||'http://localhost:'+PORT}/webhook/evolution`);
  console.log(`  • Claude:     ${ANTHROPIC_API_KEY ? 'configurado ✓' : 'NÃO configurado'}`);
  console.log('');
  console.log('  Configure o webhook na Evolution apontando para a URL acima.');
  console.log('  Para tornar o webhook acessível use ngrok: npx ngrok http ' + PORT);
  console.log('');
});
