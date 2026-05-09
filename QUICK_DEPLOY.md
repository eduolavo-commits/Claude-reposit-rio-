# Subir a área de membros HOJE — em ~30 minutos

> Caminho mais rápido, sem precisar mexer em servidor: **Supabase Cloud (banco + login + arquivos)** + **Vercel (hospedagem)**. Tudo de graça no início.
> Você só vai clicar e colar — nada de programar.

---

## 1) Criar o banco no Supabase (≈ 8 min)

1. Vá em <https://supabase.com> → **Start your project** → faça login com GitHub.
2. Clique **New project**:
   - **Name:** `agsclick-area`
   - **Database password:** crie uma senha forte e **anote**
   - **Region:** *South America (São Paulo)*
   - Plan: **Free**
   - Clique **Create new project** e aguarde ~2 min.
3. Quando ficar pronto, no menu da esquerda, abra **SQL Editor → New query**.
4. **Cole, na ordem, e rode (Run) cada um destes 3 arquivos do repositório:**
   - `webapp/supabase/migrations/0001_init.sql`
   - `webapp/supabase/migrations/0002_recommendation_role.sql`
   - `webapp/supabase/migrations/0003_course_assets.sql`

   *(você acha esses arquivos no GitHub do projeto: abra o arquivo, clique em **Raw**, copie tudo e cole no SQL Editor.)*
5. Vá em **Project Settings → API** e anote:
   - `Project URL` → vira `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → vira `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → vira `SUPABASE_SERVICE_ROLE_KEY` *(secreta — nunca compartilhe)*

> Pronto: o "back-end" está no ar.

---

## 2) Subir o site na Vercel (≈ 8 min)

1. Acesse <https://vercel.com> → **Sign up** com GitHub.
2. Clique **Add New… → Project** e escolha o repositório `Claude-reposit-rio-`.
3. **Root Directory:** clique em **Edit** e selecione `webapp` *(crucial — o app vive nessa pasta).*
4. Em **Environment Variables**, adicione **uma a uma**:

   | Nome | Valor |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | (do passo 1.5) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (do passo 1.5) |
   | `SUPABASE_SERVICE_ROLE_KEY` | (do passo 1.5) |
   | `NEXT_PUBLIC_APP_URL` | `https://SEU-PROJETO.vercel.app` *(troque pelo URL final que a Vercel gerar)* |
   | `NEXT_PUBLIC_PANDA_LIBRARY_ID` | (ID da sua library no Panda Video — encontra em *Configurações → API*) |
   | `PANDA_LIBRARY_ID` | mesmo valor acima |
   | `PANDA_API_KEY` | (em Panda → Configurações → API) |
   | `DEFAULT_WHATSAPP_URL` | `https://wa.me/55SEUNUMERO` |

   *Os `*_WEBHOOK_SECRET` são opcionais — só preencha quando ativar Hotmart/Kiwify/Eduzz/Cademi.*
5. Clique **Deploy**. Em ~2 min, sua URL aparece (ex.: `https://agsclick-area.vercel.app`).

> O site já está no ar.

---

## 3) Criar a sua conta de admin (≈ 2 min)

1. Abra `https://SEU-PROJETO.vercel.app/cadastro` e crie sua conta com seu email.
2. Volte ao Supabase → **SQL Editor → New query** e rode (substituindo o email):

   ```sql
   update profiles set role = 'admin'
   where user_id = (select id from auth.users where email = 'voce@agsclick.com.br');
   ```

3. Recarregue a página `/admin` — você agora é admin.

---

## 4) Criar o primeiro curso e subir os modelos (≈ 8 min)

Tudo dentro de `/admin`, sem código:

1. **Categorias:** crie 1 ou 2 (ex.: *Veterinária*).
2. **Cursos → Novo curso:** dê o nome (ex.: *Auxiliar Veterinário*).
3. Na tela do curso, preencha:
   - **Thumbnail** e **Banner** → clique para upload, escolha do seu computador.
   - **Acesso:** *Gratuito* ou *Pago*. Se *Pago*, cole a URL da página de vendas / WhatsApp.
   - **Conteúdo programático** (vai impresso no verso do certificado).
   - **Cargo na carta de recomendação** (ex.: *Auxiliar de Veterinário*).
   - **Modelo do CERTIFICADO (frente — imagem)** → upload do PNG/JPG da arte.
   - **Modelo da CARTA DE RECOMENDAÇÃO (imagem)** → upload da arte (se quiser personalizar; senão o sistema usa o texto padrão).
   - **Status:** *Publicado*.
4. **Adicione módulos e aulas** → cole o **Panda video ID** de cada aula (no Panda, clique no vídeo, o ID está na URL).
5. Clique **Salvar**.

> Pronto: aluno cadastrado já vê o curso na home, assiste, marca como concluído, emite certificado/carta com nome+CPF dele, com a sua arte e a data da última emissão.

---

## 5) (Opcional) Domínio próprio

1. Em **Vercel → Settings → Domains** → *Add* → digite `area.agsclick.com.br`.
2. No painel do seu registrador (Registro.br/HostGator/etc) crie um **CNAME**:
   - Nome: `area`
   - Valor: o que a Vercel mostrar (algo como `cname.vercel-dns.com.`).
3. Volte na Vercel e clique **Refresh** — o SSL é gerado sozinho em poucos minutos.
4. Atualize `NEXT_PUBLIC_APP_URL` na Vercel para o domínio novo e clique **Redeploy**.

---

## 6) (Opcional) Webhooks de venda

Quando quiser ligar Hotmart/Kiwify/Eduzz/Cademi:
- Em `/admin/webhooks` copie a URL pronta (ex.: `https://SEU-PROJETO.vercel.app/api/webhooks/hotmart`).
- Cole essa URL no painel do gateway.
- Ainda em `/admin/webhooks`, mapeie *ID do produto da plataforma → curso interno*.

Pronto: cliente comprou, acesso é liberado automaticamente.

---

## Tirando dúvidas rápidas

- **"Como troco a arte do certificado de um curso?"** Vá em `/admin/cursos`, abra o curso, clique em **Trocar** no campo *Modelo do CERTIFICADO* e envie a nova imagem. **Salvar** — pronto.
- **"E a carta?"** Mesma coisa, no campo *Modelo da CARTA DE RECOMENDAÇÃO*. Se ficar vazio, o sistema usa o texto oficial padrão.
- **"O nome aparece em cima da minha arte?"** Sim — o sistema imprime *#NOME, #CPF, #CURSO e #DATA* por cima da imagem. Por isso, deixe espaço para esses textos na arte.
- **"Trocar a senha do admin?"** Em `/perfil` o aluno troca os dados; senha é trocada via Supabase (esqueci minha senha).
