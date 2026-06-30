@echo off
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
set "FRONTEND=%ROOT%carecore-front"
set "VENV_DIR=%LOCALAPPDATA%\CareCorePlus\venv"
set "PYTHON_BACKEND=%VENV_DIR%\Scripts\python.exe"

echo ==========================================
echo    REINICIANDO CARECORE+ (LOCAL)
echo ==========================================

call "%~dp0parar_local.bat"

echo.
echo [1/3] Preparando ambiente...
set "API_PORT=8011"

for /f "usebackq delims=" %%V in (`"%PYTHON_BACKEND%" -c "from presenca_operacional import PRESENCA_REGRAS_BUILD; print(PRESENCA_REGRAS_BUILD)" 2^>nul`) do set "PRESENCA_REGRAS_ESPERADAS=%%V"
if not defined PRESENCA_REGRAS_ESPERADAS set "PRESENCA_REGRAS_ESPERADAS=inativos-sem-presenca-v2"

echo [2/3] Subindo backend (127.0.0.1:%API_PORT%)...
start "CareCore+ Backend - FastAPI" /MIN cmd /k "cd /d ""%ROOT%"" && set DATABASE_URL=sqlite+aiosqlite:///./carecore_aeb.db && ""%PYTHON_BACKEND%"" -m uvicorn main:app --reload --host 127.0.0.1 --port %API_PORT%"

echo [3/3] Subindo frontend (5173)...
start "CareCore+ Frontend - Vite" /MIN cmd /k "cd /d ""%FRONTEND%"" && set CARECORE_DEV_API_PORT=%API_PORT% && npm run dev -- --host 127.0.0.1 --port 5173"

echo [4/4] Aguardando API com regras novas...
set /a ESPERA=0
:checar_health
timeout /t 2 /nobreak >nul
set /a ESPERA+=1
powershell -NoProfile -Command "try { $h = Invoke-RestMethod ('http://127.0.0.1:%API_PORT%/api/health') -TimeoutSec 3; if ($h.presenca_regras -eq '%PRESENCA_REGRAS_ESPERADAS%' -and $h.cadastro_datas -eq 'ajuste-automatico-v1') { exit 0 } else { Write-Host 'API sem regras novas:' ($h | ConvertTo-Json -Compress); exit 2 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 if !ESPERA! LSS 15 goto checar_health
if errorlevel 2 (
  echo AVISO: API respondeu mas sem presenca_regras=%PRESENCA_REGRAS_ESPERADAS%
  echo Feche manualmente janelas antigas do Backend e execute este script de novo.
)

start "" "http://127.0.0.1:5173"
echo.
echo Pronto. Backend: http://127.0.0.1:%API_PORT%  ^|  Frontend: http://127.0.0.1:5173
echo Health deve mostrar presenca_regras=%PRESENCA_REGRAS_ESPERADAS%
timeout /t 4 /nobreak >nul
