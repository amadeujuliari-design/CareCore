@echo off
set "ROOT=%~dp0"
set "PYTHON_BACKEND=%ROOT%venv\Scripts\python.exe"
set "FRONTEND=%ROOT%carecore-front"

echo ==========================================
echo    TESTES LOCAIS CARECORE+
echo ==========================================

if not exist "%PYTHON_BACKEND%" (
    echo Ambiente virtual nao encontrado. Usando Python instalado no Windows...
    set "PYTHON_BACKEND=python"
)

"%PYTHON_BACKEND%" --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Python nao encontrado.
    echo Instale o Python ou crie o ambiente virtual com:
    echo python -m venv venv
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo ERRO: Node.js/npm nao encontrado.
    echo Instale o Node.js antes de testar o frontend.
    pause
    exit /b 1
)

echo [1/4] Instalando/atualizando dependencias do backend...
cd /d "%ROOT%"
"%PYTHON_BACKEND%" -m pip install -r requirements.txt
if errorlevel 1 goto erro

echo [2/4] Compilando arquivos Python...
"%PYTHON_BACKEND%" -m compileall . -q
if errorlevel 1 goto erro

echo [3/4] Rodando testes backend...
"%PYTHON_BACKEND%" -m pytest
if errorlevel 1 goto erro

echo [4/4] Build do frontend...
cd /d "%FRONTEND%"
if not exist "%FRONTEND%\node_modules" (
    echo Instalando dependencias do frontend...
    npm install
    if errorlevel 1 goto erro
)
npm run build
if errorlevel 1 goto erro

echo.
echo OK: validacao local concluida com sucesso.
pause
exit /b 0

:erro
echo.
echo ERRO: validacao local falhou. Veja as mensagens acima.
pause
exit /b 1
