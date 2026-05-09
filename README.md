# AGS.CLICK — Área de Membros

> **Sem tempo? Quer no ar hoje?** Siga o [`QUICK_DEPLOY.md`](QUICK_DEPLOY.md) — passo a passo de ~30 min usando Supabase Cloud + Vercel (sem servidor próprio, sem código).

Plataforma de cursos online da AGS.CLICK Treinamentos com layout escuro estilo Netflix, área de aluno
PWA, geração de certificados em PDF, inbox privado de dúvidas e admin web.

```
.
├─ webapp/    # Next.js 15 + Supabase + Tailwind (front + back via API routes)
└─ infra/     # Nginx, deploy notes para VPS Hostinger/Contabo
```

## Funcionalidades

- **Cadastro gratuito** + acesso automático a cursos marcados como gratuitos
- **Cursos pagos** com matrícula via webhook (Hotmart/Kiwify/Eduzz/Cademi) ou liberação manual
- **Home estilo Netflix**: Hero + vitrine "Cursos Gratuitos" + vitrines por categoria, com cursos liberados primeiro e bloqueados (com cadeado) depois — clicar em bloqueado redireciona para o site de vendas ou WhatsApp
- **Player Panda Video** com marcação de aula concluída e progresso por curso
- **Comentários privados**: aluno só vê os próprios + respostas; suporte/admin têm um inbox em `/admin/suporte`
- **Certificado e Carta de Recomendação** com confirmação de nome e CPF, frente desenhada via `pdf-lib` (ou imagem template em `webapp/lib/certificate/template-front.png`) e verso com o conteúdo programático do curso. Cada reemissão atualiza a `last_issued_at`
- **Verificação pública** de certificado em `/verificar/{code}`
- **Admin** completo: categorias, cursos (toggle gratuito/pago, em destaque), módulos, aulas, alunos (busca + liberar/revogar), webhooks (mapeamento produto→curso e log de eventos)
- **PWA** instalável (manifest + service worker)

## Como rodar local

```bash
cd webapp
cp .env.example .env       # preencha as chaves do Supabase + Panda
npm install
npm run dev                # http://localhost:3000
```

Em `Supabase > SQL Editor`, execute `webapp/supabase/migrations/0001_init.sql`.

Para promover seu usuário a admin:
```sql
update profiles set role='admin'
where user_id = (select id from auth.users where email='voce@email.com');
```

## Deploy

Veja [`infra/README-deploy.md`](infra/README-deploy.md) — passo a passo para a VPS Hostinger/Contabo
com Docker, Nginx e Let's Encrypt.

## Stack

- Next.js 15 (App Router) · React 19 · TypeScript estrito
- Supabase (Postgres + Auth + Storage + RLS)
- Tailwind CSS · lucide-react · pdf-lib · zod
- Panda Video (embed)
- Service Worker manual + Web App Manifest
