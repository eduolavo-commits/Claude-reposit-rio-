@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo ============================================================
echo   Mary Kay Scraper - Setup Windows
echo ============================================================
echo.

echo [1/5] Verificando Python...
where python >nul 2>nul
if errorlevel 1 (
    echo ERRO: Python nao encontrado no PATH.
    echo Instale Python 3.11+ em https://www.python.org/downloads/
    pause
    exit /b 1
)
python --version

echo.
echo [2/5] Criando virtualenv (.venv)...
if not exist .venv (
    python -m venv .venv
    if errorlevel 1 (
        echo ERRO ao criar virtualenv.
        pause
        exit /b 1
    )
) else (
    echo .venv ja existe, pulando.
)

echo.
echo [3/5] Instalando dependencias Python (pode demorar 2-3 minutos)...
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 (
    echo ERRO ao instalar dependencias.
    pause
    exit /b 1
)

echo.
echo [4/5] Baixando Chromium para Playwright (~150MB, 1a vez)...
playwright install chromium

echo.
echo [5/5] Criando .env (se nao existir)...
if not exist .env (
    copy .env.example .env >nul
    echo .env criado a partir do .env.example
) else (
    echo .env ja existe, pulando.
)

echo.
echo ============================================================
echo   SETUP CONCLUIDO!
echo ============================================================
echo.
echo PROXIMOS PASSOS:
echo.
echo   1. Coloque o arquivo credentials.json nesta pasta
echo      ^(Service Account do Google Cloud^)
echo.
echo   2. Edite .env e preencha:
echo        GOOGLE_SHEET_ID=seu_id_aqui
echo.
echo   3. Execute start.bat para iniciar scraper + dashboard
echo.
pause
