@echo off
setlocal
cd /d "%~dp0"
set "PY=%LOCALAPPDATA%\CareCorePlus\agente-nfp-robo\venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"
title CareCore+ Agente NFP - envio continuo
echo Envio continuo: lotes de 100 ate acabar a fila ou Parar.
echo.
"%PY%" "%~dp0agente_nfp.py" enviar --continuo
echo.
pause
endlocal
