# Deploy AGS.CLICK na VPS Hostinger / Contabo

## Visão geral

```
Usuário → Cloudflare/DNS → Nginx (HTTPS) → Docker container Next.js (porta 3000) → Supabase Cloud
```

## 1. Preparar a VPS (Ubuntu 22.04)

```bash
# Acesso root via SSH
apt update && apt upgrade -y
apt install -y nginx git ufw certbot python3-certbot-nginx
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable

# Instalar Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
```

## 2. Apontar o domínio

No painel do registrador (Registro.br/HostGator/etc), crie um A record:
- `area.agsclick.com.br → IP_DA_SUA_VPS`

## 3. Clonar o projeto e configurar variáveis

```bash
mkdir -p /opt && cd /opt
git clone https://github.com/eduolavo-commits/Claude-reposit-rio-.git agsclick
cd agsclick/webapp
cp .env.example .env
nano .env       # preencha NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PANDA_*, etc.
```

## 4. Subir o Supabase

Opção A (recomendada para começar): use o Supabase Cloud (free tier) e execute o SQL de
`webapp/supabase/migrations/0001_init.sql` no SQL Editor. Pegue as keys em
*Project Settings → API* e cole no `.env`.

Opção B (auto-hospedado): rode o `supabase` self-hosted (https://supabase.com/docs/guides/self-hosting/docker)
no mesmo VPS e ajuste as URLs.

Crie um admin manualmente no SQL Editor após cadastrar-se em `/cadastro`:

```sql
update profiles set role = 'admin' where user_id = (
  select id from auth.users where email = 'voce@agsclick.com.br'
);
```

## 5. Build & start do app

```bash
cd /opt/agsclick/webapp
docker compose up -d --build
docker logs -f agsclick-webapp
```

A app fica em `http://127.0.0.1:3000`.

## 6. Configurar Nginx + SSL

```bash
cp /opt/agsclick/infra/nginx/agsclick.conf /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/agsclick.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

certbot --nginx -d area.agsclick.com.br
systemctl reload nginx
```

## 7. Webhooks de pagamento

No painel admin (`/admin/webhooks`):
1. Copie a URL do gateway que você usa, por exemplo: `https://area.agsclick.com.br/api/webhooks/hotmart`
2. Cole na configuração de "Postback / Webhook" da Hotmart/Kiwify/Eduzz/Cademi.
3. Mapeie o ID do produto externo → curso interno na seção "Mapear produtos → cursos".
4. (Opcional) Defina secrets em `.env` (`HOTMART_WEBHOOK_SECRET`, etc.).

## 8. Atualizações futuras

```bash
cd /opt/agsclick && git pull
cd webapp && docker compose up -d --build
```

> Para CI/CD com Coolify (recomendado), siga https://coolify.io/docs e aponte o repositório
> deste projeto. Coolify lida com build, SSL e webhooks automaticamente.

## 9. Backups

Supabase Cloud já faz backups diários no plano Free. Se for self-hosted:

```bash
docker exec -t supabase-db pg_dump -U postgres > /backups/db-$(date +%F).sql
```

Guarde os backups em outro lugar (Backblaze B2, S3, Google Drive).
