@echo off
setlocal
cd /d "%~dp0"
set "PY=%LOCALAPPDATA%\CareCorePlus\agente-nfp-robo\venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"
title CareCore+ Agente NFP - um lote
echo Envia apenas 1 lote de ate 100 cupons.
echo.
"%PY%" "%~dp0agente_nfp.py" enviar
echo.
pause
endlocal
