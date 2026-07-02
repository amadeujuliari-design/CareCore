@echo off
setlocal
set "ROOT=%~dp0"
set "VENV_DIR=%LOCALAPPDATA%\CareCorePlus\venv"
set "PYTHON_BACKEND=%VENV_DIR%\Scripts\python.exe"

echo ==========================================
echo    PARANDO CARECORE+ (LOCAL)
echo ==========================================

cd /d "%ROOT%"
if exist "%PYTHON_BACKEND%" (
  "%PYTHON_BACKEND%" scripts\dev_local.py stop
) else (
  python scripts\dev_local.py stop 2>nul || py -3 scripts\dev_local.py stop 2>nul
)

echo.
echo CareCore+ local parado.
endlocal
