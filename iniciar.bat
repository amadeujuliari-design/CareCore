@echo off
setlocal
set "ROOT=%~dp0"
set "FRONTEND=%ROOT%carecore-front"
set "VENV_DIR=%LOCALAPPDATA%\CareCorePlus\venv"
set "PYTHON_BACKEND=%VENV_DIR%\Scripts\python.exe"
set "IP_LOCAL=127.0.0.1"

echo ==========================================
echo    INICIANDO O SISTEMA CARECORE+
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
    echo Instale o Node.js antes de iniciar o frontend.
    pause
    exit /b 1
)

for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$ip = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1 -ExpandProperty IPAddress; if ($ip) { $ip } else { '127.0.0.1' }"`) do set "IP_LOCAL=%%I"

echo [1/4] Conferindo dependencias do backend...
cd /d "%ROOT%"
"%PYTHON_BACKEND%" -c "import fastapi, uvicorn, sqlalchemy, aiosqlite, jwt, bcrypt, cryptography" >nul 2>&1
if errorlevel 1 (
    echo Instalando dependencias do backend...
    "%PYTHON_BACKEND%" -m pip install -r requirements.txt
    if errorlevel 1 goto erro
)

echo [2/4] Conferindo dependencias do frontend...
if not exist "%FRONTEND%\node_modules" (
    echo Instalando dependencias do frontend...
    cd /d "%FRONTEND%"
    npm install
    if errorlevel 1 goto erro
)

set "API_PORT=8002"

for /f "usebackq delims=" %%V in (`"%PYTHON_BACKEND%" -c "from presenca_operacional import PRESENCA_REGRAS_BUILD; print(PRESENCA_REGRAS_BUILD)" 2^>nul`) do set "PRESENCA_REGRAS_ESPERADAS=%%V"
if not defined PRESENCA_REGRAS_ESPERADAS set "PRESENCA_REGRAS_ESPERADAS=inativos-sem-presenca-v2"

echo [3/4] Ligando o Backend (Python) na porta %API_PORT%...
powershell -NoProfile -Command "try { $h = Invoke-RestMethod 'http://127.0.0.1:%API_PORT%/api/health' -TimeoutSec 2; if ($h.presenca_regras -eq '%PRESENCA_REGRAS_ESPERADAS%') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    start "CareCore+ Backend - FastAPI" cmd /k "cd /d ""%ROOT%"" && ""%PYTHON_BACKEND%"" -m uvicorn main:app --reload --host 127.0.0.1 --port %API_PORT%"
) else (
    echo Backend ja esta rodando na porta %API_PORT% com regras atuais.
)

echo [4/4] Ligando o Frontend (React)...
powershell -NoProfile -Command "if (Test-NetConnection 127.0.0.1 -Port 5173 -InformationLevel Quiet) { exit 0 } else { exit 1 }" >nul 2>&1
if errorlevel 1 (
    start "CareCore+ Frontend - Vite" cmd /k "cd /d ""%FRONTEND%"" && npm run dev -- --host 0.0.0.0 --port 5173"
) else (
    echo Frontend ja esta rodando na porta 5173.
)

timeout /t 4 /nobreak >nul
start "" "http://127.0.0.1:5173"

echo Sucesso! Os dois servidores estao rodando.
echo Backend:  http://127.0.0.1:8002
echo Frontend: http://127.0.0.1:5173
echo.
echo Para acessar pelo celular na mesma rede Wi-Fi:
echo http://%IP_LOCAL%:5173
echo.
echo Se nao abrir no celular, libere as portas 5173 e 8002 no Firewall do Windows.
pause
exit /b 0

:erro
echo.
echo ERRO: nao foi possivel iniciar o CareCore+. Veja as mensagens acima.
pause
exit /b 1