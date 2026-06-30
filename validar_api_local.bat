@echo off
setlocal
set "ROOT=%~dp0"
set "VENV_DIR=%LOCALAPPDATA%\CareCorePlus\venv"
set "PYTHON_BACKEND=%VENV_DIR%\Scripts\python.exe"

echo ==========================================
echo    VALIDAR API LOCAL CARECORE+
echo ==========================================

if not exist "%PYTHON_BACKEND%" (
  echo ERRO: execute reiniciar_local.bat primeiro.
  pause
  exit /b 1
)

cd /d "%ROOT%"
"%PYTHON_BACKEND%" scripts\dev_local.py validate
if errorlevel 1 (
  echo.
  echo Falhou. Rode reiniciar_local.bat
  pause
  exit /b 1
)

echo.
pause
exit /b 0
