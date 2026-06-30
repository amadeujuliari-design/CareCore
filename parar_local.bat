@echo off
setlocal
set "ROOT=%~dp0"
set "VENV_DIR=%LOCALAPPDATA%\CareCorePlus\venv"
set "PYTHON_BACKEND=%VENV_DIR%\Scripts\python.exe"

echo ==========================================
echo    PARANDO CARECORE+ (LOCAL)
echo ==========================================

if exist "%PYTHON_BACKEND%" (
  cd /d "%ROOT%"
  "%PYTHON_BACKEND%" scripts\dev_local.py stop
) else (
  echo Python local nao encontrado; tentando liberar portas via PowerShell...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach ($port in 5173,8020,8000,8002,8010,8011,8013) { Get-NetTCPConnection -LocalPort $port -State Listen -EA SilentlyContinue | Select -Expand OwningProcess -Unique | ForEach-Object { if ($_ -gt 0) { Stop-Process -Id $_ -Force -EA SilentlyContinue } } }"
)

echo.
echo CareCore+ local parado.
endlocal
