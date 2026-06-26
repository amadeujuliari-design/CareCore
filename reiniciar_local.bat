@echo off
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
set "FRONTEND=%ROOT%carecore-front"
set "VENV_DIR=%LOCALAPPDATA%\CareCorePlus\venv"
set "PYTHON_BACKEND=%VENV_DIR%\Scripts\python.exe"

echo ==========================================
echo    REINICIANDO CARECORE+ (LOCAL)
echo ==========================================

echo [1/4] Encerrando processos uvicorn/node antigos...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-CimInstance Win32_Process -Filter \"Name = 'python.exe'\" | Where-Object { $_.CommandLine -like '*uvicorn main:app*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" ^
  >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Where-Object { $_.CommandLine -like '*vite*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" ^
  >nul 2>&1

set /a TENTATIVAS=0
:aguardar_portas
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8002" ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
set /a TENTATIVAS+=1
if !TENTATIVAS! GEQ 6 goto portas_ok
netstat -ano | findstr ":8002" | findstr LISTENING >nul && (timeout /t 1 /nobreak >nul & goto aguardar_portas)
netstat -ano | findstr ":8000" | findstr LISTENING >nul && (timeout /t 1 /nobreak >nul & goto aguardar_portas)
netstat -ano | findstr ":5173" | findstr LISTENING >nul && (timeout /t 1 /nobreak >nul & goto aguardar_portas)
:portas_ok

set "API_PORT=8002"

for /f "usebackq delims=" %%V in (`"%PYTHON_BACKEND%" -c "from presenca_operacional import PRESENCA_REGRAS_BUILD; print(PRESENCA_REGRAS_BUILD)" 2^>nul`) do set "PRESENCA_REGRAS_ESPERADAS=%%V"
if not defined PRESENCA_REGRAS_ESPERADAS set "PRESENCA_REGRAS_ESPERADAS=inativos-sem-presenca-v2"

echo [2/4] Subindo backend (127.0.0.1:%API_PORT%)...
start "CareCore+ Backend - FastAPI" cmd /k "cd /d ""%ROOT%"" && ""%PYTHON_BACKEND%"" -m uvicorn main:app --reload --host 127.0.0.1 --port %API_PORT%"

echo [3/4] Subindo frontend (5173)...
start "CareCore+ Frontend - Vite" cmd /k "cd /d ""%FRONTEND%"" && npm run dev -- --host 127.0.0.1 --port 5173"

echo [4/4] Aguardando API com regras novas de presenca...
set /a ESPERA=0
:checar_health
timeout /t 2 /nobreak >nul
set /a ESPERA+=1
powershell -NoProfile -Command "try { $h = Invoke-RestMethod 'http://127.0.0.1:8002/api/health' -TimeoutSec 3; if ($h.presenca_regras -eq '%PRESENCA_REGRAS_ESPERADAS%') { exit 0 } else { Write-Host 'API sem regra nova:' ($h | ConvertTo-Json -Compress); exit 2 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 if !ESPERA! LSS 15 goto checar_health
if errorlevel 2 (
  echo AVISO: API respondeu mas sem presenca_regras=%PRESENCA_REGRAS_ESPERADAS%
  echo Feche manualmente janelas antigas do Backend e execute este script de novo.
)

start "" "http://127.0.0.1:5173"
echo.
echo Pronto. Backend: http://127.0.0.1:8002  ^|  Frontend: http://127.0.0.1:5173
echo Health deve mostrar presenca_regras=%PRESENCA_REGRAS_ESPERADAS%
timeout /t 4 /nobreak >nul
