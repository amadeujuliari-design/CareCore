@echo off
setlocal
set "ROOT=%~dp0"
set "VENV_DIR=%LOCALAPPDATA%\CareCorePlus\venv"
set "PYTHON_BACKEND=%VENV_DIR%\Scripts\python.exe"
set "FRONTEND=%ROOT%carecore-front"
set "SITE=%ROOT%carecore-site"

echo ==========================================
echo    TESTES LOCAIS CARECORE+
echo ==========================================

if not exist "%PYTHON_BACKEND%" goto criar_venv
"%PYTHON_BACKEND%" --version >nul 2>&1
if errorlevel 1 goto criar_venv
goto python_ok

:criar_venv
echo Ambiente virtual local nao encontrado ou invalido.
echo Criando ambiente Python desta maquina em:
echo %VENV_DIR%
if not exist "%LOCALAPPDATA%\CareCorePlus" mkdir "%LOCALAPPDATA%\CareCorePlus"
python -m venv --clear "%VENV_DIR%" >nul 2>&1
if errorlevel 1 (
    py -3 -m venv --clear "%VENV_DIR%" >nul 2>&1
)
if not exist "%PYTHON_BACKEND%" (
    echo ERRO: Python nao encontrado.
    echo Instale o Python e marque a opcao Add python.exe to PATH.
    pause
    exit /b 1
)
"%PYTHON_BACKEND%" --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: nao foi possivel usar o ambiente Python local.
    pause
    exit /b 1
)

:python_ok

where npm >nul 2>&1
if errorlevel 1 (
    echo ERRO: Node.js/npm nao encontrado.
    echo Instale o Node.js antes de testar o frontend.
    pause
    exit /b 1
)

echo [1/5] Instalando/atualizando dependencias do backend...
cd /d "%ROOT%"
"%PYTHON_BACKEND%" -m pip install -r requirements.txt
if errorlevel 1 goto erro

echo [2/5] Compilando arquivos Python...
"%PYTHON_BACKEND%" -m compileall . -q
if errorlevel 1 goto erro

echo [3/5] Rodando testes backend...
"%PYTHON_BACKEND%" -m pytest
if errorlevel 1 goto erro

echo [4/5] Build do frontend...
cd /d "%FRONTEND%"
if not exist "%FRONTEND%\node_modules" (
    echo Instalando dependencias do frontend...
    npm install
    if errorlevel 1 goto erro
)
npm run build
if errorlevel 1 goto erro

echo [5/5] Build do site institucional...
cd /d "%SITE%"
if not exist "%SITE%\node_modules" (
    echo Instalando dependencias do site...
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
