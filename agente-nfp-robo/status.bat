@echo off
setlocal
cd /d "%~dp0"
set "PY=%LOCALAPPDATA%\CareCorePlus\agente-nfp-robo\venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"
"%PY%" "%~dp0agente_nfp.py" status
echo.
pause
endlocal
