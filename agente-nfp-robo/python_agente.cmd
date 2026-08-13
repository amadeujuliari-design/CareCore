@echo off
REM Define PY para o Python do agente (portatil). Usar: call "%~dp0python_agente.cmd"
set "PY=%LOCALAPPDATA%\CareCorePlus\agente-nfp-python\python.exe"
if exist "%PY%" goto :eof
set "PY=%~dp0python-runtime\python.exe"
if exist "%PY%" goto :eof
set "PY=%LOCALAPPDATA%\CareCorePlus\agente-nfp-robo-venv\Scripts\python.exe"
if exist "%PY%" goto :eof
set "PY=%LOCALAPPDATA%\CareCorePlus\agente-nfp-robo\venv\Scripts\python.exe"
if exist "%PY%" goto :eof
set "PY="
exit /b 1
