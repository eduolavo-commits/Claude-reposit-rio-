# Digisac — Atendimento WhatsApp + CRM + IA

Sistema moderno de atendimento ao estilo Digisac com:

- **Atendimento WhatsApp** — caixa de entrada estilo inbox unificado, com filas, etiquetas, mensagens rápidas e atribuição.
- **Multi-API** — WhatsApp Cloud API (Oficial Meta), Evolution API, Baileys, WPPConnect, Instagram DM e Telegram.
- **CRM integrado** — pipeline kanban (Novo → Qualificado → Proposta → Negociação → Ganho/Perdido), registro de vendas direto da conversa, e lançamento automático quando um deal é movido para "Ganho".
- **Disparo em massa** — campanhas com público estimado, taxa de entrega, visualização, cliques e falhas, igual ao print de referência.
- **Automações / Fluxos** — editor visual com blocos arrastáveis (Mensagem, Esperar, Condição, Tag, Agente IA, HTTP).
- **Agentes IA com Claude** — múltiplos agentes (SDR, Inside Sales, Recuperação, Suporte, Pós-Venda, Cobrança, Agendamento), cada um com modelo, prompt, temperatura, filas, canais e regras de handoff próprios.
- **Relatórios**, **Configurações** completas (canais, filas, tags, mensagens rápidas, equipe, webhooks, exportação de dados).

## Como rodar

Não precisa de build. Basta abrir `index.html` no navegador. Para rodar via servidor local (recomendado, já que usa ES modules):

```bash
# qualquer um destes
python3 -m http.server 8080
# ou
npx serve .
```

Depois acesse <http://localhost:8080>.

Os dados são persistidos em `localStorage` (chave `digisac_state_v1`). Para resetar, vá em **Configurações → Dados → Resetar**.

## Estrutura

```
whatsapp-crm/
├── index.html            # entrada principal
├── css/app.css           # estilos custom (Tailwind via CDN para o resto)
└── js/
    ├── app.js            # bootstrap + roteamento por view
    ├── state.js          # estado global + seed + persist em localStorage
    ├── components.js     # Sidebar, TopBar, Avatar, Modal, Toast
    ├── icons.js          # helper Lucide
    └── views/
        ├── chats.js          # caixa de entrada + conversa
        ├── fila.js           # fila de atendimento
        ├── contatos.js       # CRUD de contatos
        ├── crm.js            # kanban + tabela de vendas
        ├── disparo.js        # campanhas em massa
        ├── automacoes.js     # editor de fluxos
        ├── agentes.js        # configuração de agentes Claude
        ├── relatorios.js     # dashboards
        └── configuracoes.js  # canais, filas, tags, equipe, webhooks
```

## Próximos passos (produção)

Para virar produção real seria preciso:

1. **Backend** com Node/Postgres (ou similar) para persistir contatos/conversas/vendas e expor uma API.
2. **Worker de webhooks** para receber eventos do WhatsApp Cloud API e da Evolution API e empurrar via WebSocket pro frontend.
3. **Fila de jobs** (BullMQ/Redis) para os disparos em massa respeitando rate limits.
4. **Integração real com Claude API** — em `state.apiSettings.claude.apiKey` está o ponto de plug. O backend chama `messages.create` da Anthropic SDK passando `systemPrompt` + histórico da conversa.
5. **Auth** (Auth.js, Clerk) e multi-tenant.
