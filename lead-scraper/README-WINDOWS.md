# Mary Kay Scraper — Setup Windows

Roda no seu PC com Python 3.11+ e VS Code.

## Passo a passo

### 1. Clonar o repositório
```powershell
git clone https://github.com/eduolavo-commits/Claude-reposit-rio-.git
cd Claude-reposit-rio-\lead-scraper
```

### 2. Setup (1 vez só)
Dê duplo-clique em **`setup.bat`** ou rode no terminal:
```powershell
setup.bat
```
Isso vai:
- Criar uma virtualenv `.venv\`
- Instalar todas as dependências
- Baixar o Chromium do Playwright (~150MB)
- Criar `.env` a partir do `.env.example`

### 3. Configurar credenciais
1. Cole o arquivo **`credentials.json`** (Service Account do Google) nesta pasta
2. Abra `.env` no VS Code e ajuste se quiser (o `GOOGLE_SHEET_ID` já está apontando pra planilha correta)

### 4. Iniciar
Duplo-clique em **`start.bat`** ou:
```powershell
start.bat
```
Isso abre:
- 1 janela com o **scraper** rodando
- 1 janela com o **dashboard** rodando
- Seu Chrome em [http://localhost:8000](http://localhost:8000) automaticamente

### 5. Parar
Feche as 2 janelas que abriram (ou Ctrl+C em cada uma).

---

## Workflow no VS Code

1. `File > Open Folder` na pasta `lead-scraper`
2. Terminal integrado (`Ctrl+'`) → roda os `.bat` direto
3. Edita `.env` no editor com syntax highlight
4. `credentials.json` é arrastado pro Explorer do VS Code

---

## Estrutura

```
lead-scraper/
├── main.py            ← scraper (varre CEPs)
├── dashboard.py       ← FastAPI + dashboard web
├── scraper.py         ← Playwright (browser automation)
├── parser.py          ← BeautifulSoup (extração de dados)
├── database.py        ← SQLite local (leads.db)
├── sheets_client.py   ← Google Sheets sync
├── zip_codes.py       ← ~500 CEPs brasileiros
├── templates/
│   └── index.html     ← UI do dashboard
├── setup.bat          ← Setup único
├── start.bat          ← Iniciar tudo
├── .env               ← Sua config (não commit)
└── credentials.json   ← Service Account (não commit)
```

---

## Troubleshooting

**`'python' is not recognized`**
→ Python não está no PATH. Reinstale com a opção "Add Python to PATH" marcada.

**`ModuleNotFoundError`**
→ A virtualenv não foi ativada. O `start.bat` ativa automaticamente — use ele em vez de rodar `python` direto.

**`credentials.json not found`**
→ Cole o JSON da Service Account do Google nesta pasta.

**Dashboard não abre no navegador**
→ Verifique se a janela "Mary Kay Dashboard" está rodando. Acesse manualmente: http://localhost:8000

**Quero ver o browser durante o scraping (debug)**
→ Edite `.env` e troque `HEADLESS=True` por `HEADLESS=False`.
