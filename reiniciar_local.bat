@echo off
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
set "FRONTEND=%ROOT%carecore-front"
set "VENV_DIR=%LOCALAPPDATA%\CareCorePlus\venv"
set "PYTHON_BACKEND=%VENV_DIR%\Scripts\python.exe"

echo ==========================================
echo    REINICIANDO CARECORE+ (LOCAL)
echo ==========================================

if not exist "%PYTHON_BACKEND%" (
  echo ERRO: ambiente Python nao encontrado em %VENV_DIR%
  echo Execute iniciar.bat uma vez para criar o venv.
  pause
  exit /b 1
)

cd /d "%ROOT%"
"%PYTHON_BACKEND%" scripts\dev_local.py stop
if errorlevel 1 goto erro

echo.
echo Subindo backend validado (scripts/dev_local.json)...
"%PYTHON_BACKEND%" scripts\dev_local.py start-backend
if errorlevel 1 goto erro

for /f "usebackq delims=" %%P in (`"%PYTHON_BACKEND%" -c "import json;print(json.load(open('scripts/dev_local.json',encoding='utf-8'))['api_port'])"`) do set "API_PORT=%%P"

echo.
echo Subindo frontend (porta 5173, API %API_PORT%)...
start "CareCore+ Frontend - Vite" /MIN cmd /k "cd /d ""%FRONTEND%"" && set CARECORE_DEV_API_PORT=%API_PORT% && npm run dev -- --host 127.0.0.1 --port 5173"

timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:5173"

echo.
echo Pronto. API: http://127.0.0.1:%API_PORT%  ^|  App: http://127.0.0.1:5173
echo Validar a qualquer momento: validar_api_local.bat
timeout /t 3 /nobreak >nul
exit /b 0

:erro
echo.
echo ERRO ao reiniciar. Se persistir, reinicie o Windows e rode este script de novo.
pause
exit /b 1
