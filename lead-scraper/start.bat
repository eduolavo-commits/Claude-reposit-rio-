@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo ============================================================
echo   Mary Kay Scraper - Iniciando servicos
echo ============================================================
echo.

if not exist .venv (
    echo ERRO: virtualenv nao encontrado. Rode setup.bat primeiro.
    pause
    exit /b 1
)

if not exist credentials.json (
    echo ERRO: credentials.json nao encontrado nesta pasta.
    echo Cole o arquivo da Service Account do Google aqui.
    pause
    exit /b 1
)

if not exist .env (
    echo ERRO: .env nao encontrado. Rode setup.bat ou crie manualmente.
    pause
    exit /b 1
)

echo Abrindo janela do SCRAPER...
start "Mary Kay Scraper" cmd /k "cd /d %~dp0 && .venv\Scripts\activate.bat && python main.py"

timeout /t 2 /nobreak >nul

echo Abrindo janela do DASHBOARD...
start "Mary Kay Dashboard" cmd /k "cd /d %~dp0 && .venv\Scripts\activate.bat && python dashboard.py"

echo Aguardando dashboard subir (5s)...
timeout /t 5 /nobreak >nul

echo Abrindo navegador em http://localhost:8000
start "" "http://localhost:8000"

echo.
echo ============================================================
echo   Tudo rodando!
echo.
echo   - Janela "Mary Kay Scraper":   varre CEPs e coleta leads
echo   - Janela "Mary Kay Dashboard": serve a interface web
echo   - Navegador:                   http://localhost:8000
echo.
echo   Para parar: feche as 2 janelas que abriram (ou Ctrl+C nelas).
echo ============================================================
echo.
pause
