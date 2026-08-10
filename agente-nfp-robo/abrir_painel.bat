@echo off
setlocal
cd /d "%~dp0"
title CareCore+ Agente NFP - Painel
set "PY=%LOCALAPPDATA%\CareCorePlus\agente-nfp-robo\venv\Scripts\python.exe"
if not exist "%PY%" (
  echo Venv nao encontrado. Rodando instalacao rapida de dependencias...
  where python >nul 2>&1
  if errorlevel 1 (
    echo ERRO: Python nao encontrado. Rode instalar.bat primeiro.
    pause
    exit /b 1
  )
  set "PY=python"
  "%PY%" -m pip install -r "%~dp0requirements.txt"
)

REM Garante tzdata no Windows (fuso America/Sao_Paulo)
"%PY%" -c "from zoneinfo import ZoneInfo; ZoneInfo('America/Sao_Paulo')" 2>nul
if errorlevel 1 (
  echo Instalando tzdata...
  "%PY%" -m pip install tzdata
)

echo Abrindo painel local em http://127.0.0.1:8765/
echo Deixe esta janela aberta enquanto usa o painel.
echo.
"%PY%" "%~dp0painel.py"
echo.
pause
endlocal
