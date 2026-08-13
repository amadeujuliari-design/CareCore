@echo off
setlocal
cd /d "%~dp0"
title CareCore+ Agente NFP - Painel
call "%~dp0python_agente.cmd"
if not exist "%PY%" (
  echo Python do agente nao encontrado. Rode o CareCore-Agente-NFP.exe ou instalar.bat.
  pause
  exit /b 1
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
