# Digisac Backend

Servidor Node.js que conecta o frontend Digisac à **Evolution API** (WhatsApp). Faz envio de mensagens, recebe webhooks da Evolution, faz proxy do Claude e empurra eventos em tempo real para o frontend via WebSocket.

## Pré-requisitos

- Node.js 18 ou superior — <https://nodejs.org>
- Uma instância da Evolution API rodando (local ou em VPS) com:
  - URL acessível (ex: `https://evo.minhaempresa.com` ou `http://localhost:8080`)
  - API key
  - Nome da instância (ex: `vendas`)

## Setup rápido (Windows)

1. **Duplo-clique** em `start.bat`. Ele instala dependências, abre o `.env` no Notepad pra você editar, e sobe o servidor.

## Setup manual (qualquer SO)

```bash
cd whatsapp-crm/backend
npm install
cp .env.example .env       # no Windows: copy .env.example .env
# Edite .env com suas credenciais
npm start
```

Servidor sobe em <http://localhost:3001>. Teste:

```bash
curl http://localhost:3001/api/health
```

Resposta esperada:
```json
{"status":"ok","evolution":"ok","instance":"vendas"}
```

## Variáveis de ambiente

| Variável | Descrição | Exemplo |
|---|---|---|
| `PORT` | Porta do backend | `3001` |
| `EVO_URL` | URL da Evolution API | `https://evo.minhaempresa.com` |
| `EVO_KEY` | API key da Evolution | `B6D711...` |
| `EVO_INSTANCE` | Nome da instância | `vendas` |
| `ANTHROPIC_API_KEY` | API key do Claude (opcional) | `sk-ant-...` |
| `PUBLIC_URL` | URL pública do backend (pra webhook) | `https://abc.ngrok.io` |

## Configurar webhook na Evolution

Pra receber mensagens em tempo real, sua Evolution precisa enviar eventos pra este backend.

**Cenário 1 — Backend no mesmo VPS da Evolution (ideal)**

Aponte o webhook da instância pra `http://localhost:3001/webhook/evolution`.

**Cenário 2 — Evolution na VPS, backend na sua máquina (desenvolvimento)**

Use ngrok pra expor seu localhost à internet:

```bash
npx ngrok http 3001
# pega a URL https://xxxx.ngrok.io
```

Configure o webhook na Evolution apontando pra `https://xxxx.ngrok.io/webhook/evolution`.

**Configurar via API da Evolution:**
```bash
curl -X POST https://SUA-EVO/webhook/set/SUA-INSTANCIA \
  -H "apikey: SUA-KEY" \
  -H "Content-Type: application/json" \
  -d '{"webhook":{"url":"https://xxxx.ngrok.io/webhook/evolution","events":["MESSAGES_UPSERT"]}}'
```

## Endpoints

### REST

- `GET  /api/health` — status do backend e Evolution
- `GET  /api/state` — estado completo (contatos, conversas, vendas)
- `POST /api/state/reset` — apaga todos os dados
- `POST /api/messages/send` — envia mensagem
  ```json
  { "to": "5511999998888", "text": "Olá!" }
  ```
- `GET  /api/instance/connect` — pega QR code pra conectar WhatsApp
- `GET  /api/instance/status` — estado da conexão (connected/disconnected)
- `POST /api/contacts` / `GET /api/contacts` / `DELETE /api/contacts/:id`
- `POST /api/sales` / `GET /api/sales`
- `POST /api/claude/chat` — proxy seguro pro Claude (não expõe a key no frontend)
- `POST /webhook/evolution` — recebido da Evolution (não chame manualmente)

### WebSocket

- `ws://localhost:3001/ws` — recebe eventos `message:received`, `message:sent`, `contact:created`, `sale:created`, etc.

## Persistência

Os dados ficam num arquivo `data.json` ao lado do `server.js`. É simples e suficiente pra começar. Pra produção, troque por Postgres/MongoDB. O arquivo está no `.gitignore`.

## Como o frontend conecta

1. Abra o sistema no navegador (Live Server ou Python http.server).
2. Vá em **Configurações → Backend**.
3. Cole a URL do backend (`http://localhost:3001`) e clique em **Salvar e conectar**.
4. Pronto — daí pra frente as mensagens vão de verdade pelo WhatsApp.
