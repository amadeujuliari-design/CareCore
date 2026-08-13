@echo off
setlocal
cd /d "%~dp0"
call "%~dp0python_agente.cmd"
if not exist "%PY%" (
  echo Python do agente nao encontrado. Rode o CareCore-Agente-NFP.exe ou instalar.bat.
  pause
  exit /b 1
)
title CareCore+ Agente NFP - um lote
echo Envia apenas 1 lote de ate 100 cupons.
echo.
"%PY%" "%~dp0agente_nfp.py" enviar
echo.
pause
endlocal
