@echo off
setlocal
cd /d "%~dp0"
call "%~dp0python_agente.cmd"
if not exist "%PY%" (
  echo Python do agente nao encontrado. Rode o CareCore-Agente-NFP.exe ou instalar.bat.
  pause
  exit /b 1
)
"%PY%" "%~dp0agente_nfp.py" parar
echo.
echo Parada pedida. O lote atual termina e a sessao encerra.
pause
endlocal
