@echo off
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
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
"%PYTHON_BACKEND%" scripts\dev_local.py start
if errorlevel 1 goto erro

echo.
echo Validar a qualquer momento: validar_api_local.bat
timeout /t 3 /nobreak >nul
exit /b 0

:erro
echo.
echo ERRO ao reiniciar. Tente parar_local.bat e rode este script de novo.
pause
exit /b 1
