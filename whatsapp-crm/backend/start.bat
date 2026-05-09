@echo off
REM Atalho para Windows. Duplo-clique para iniciar o backend.
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias...
  call npm install
)
if not exist .env (
  echo Copiando .env.example -^> .env (edite com suas credenciais!)
  copy .env.example .env
  echo.
  echo ATENCAO: edite o arquivo backend\.env com a URL e API key da sua Evolution
  echo antes de continuar. Pressione qualquer tecla para abrir.
  pause
  notepad .env
)
echo.
echo Iniciando servidor...
call npm start
