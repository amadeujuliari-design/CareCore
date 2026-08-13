@echo off
setlocal
cd /d "%~dp0"
call "%~dp0python_agente.cmd"
if not exist "%PY%" (
  echo Python do agente nao encontrado. Rode o CareCore-Agente-NFP.exe ou instalar.bat.
  pause
  exit /b 1
)
title CareCore+ Agente NFP - envio continuo
echo Envio continuo: lotes de 100 ate acabar a fila ou Parar.
echo.
"%PY%" "%~dp0agente_nfp.py" enviar --continuo
echo.
pause
endlocal
