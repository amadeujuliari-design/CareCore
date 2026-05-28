@echo off
setlocal
set "ROOT=%~dp0"
set "FRONTEND=%ROOT%carecore-front"
set "PYTHON_BACKEND=%ROOT%venv\Scripts\python.exe"
set "IP_LOCAL=127.0.0.1"

echo ==========================================
echo    INICIANDO O SISTEMA CARECORE+
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

echo [3/4] Ligando o Backend (Python)...
powershell -NoProfile -Command "if (Test-NetConnection 127.0.0.1 -Port 8000 -InformationLevel Quiet) { exit 0 } else { exit 1 }" >nul 2>&1
if errorlevel 1 (
    start "CareCore+ Backend - FastAPI" cmd /k "cd /d ""%ROOT%"" && ""%PYTHON_BACKEND%"" -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
) else (
    echo Backend ja esta rodando na porta 8000.
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
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://127.0.0.1:5173
echo.
echo Para acessar pelo celular na mesma rede Wi-Fi:
echo http://%IP_LOCAL%:5173
echo.
echo Se nao abrir no celular, libere as portas 5173 e 8000 no Firewall do Windows.
pause
exit /b 0

:erro
echo.
echo ERRO: nao foi possivel iniciar o CareCore+. Veja as mensagens acima.
pause
exit /b 1