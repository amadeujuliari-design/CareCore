@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM Empacota o agente em carecore-front/public/downloads/agente-nfp-robo.zip
REM (usado pelo botao de download na tela Envio SEFAZ)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0empacotar_download.ps1"
set ERR=%ERRORLEVEL%
if %ERR% neq 0 (
  echo Falha ao empacotar. Codigo %ERR%.
) else (
  echo OK.
)
pause
endlocal
