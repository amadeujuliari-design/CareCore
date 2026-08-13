@echo off
setlocal
cd /d "%~dp0"
call "%~dp0python_agente.cmd"
if not exist "%PY%" (
  echo Python do agente nao encontrado. Rode o CareCore-Agente-NFP.exe ou instalar.bat.
  pause
  exit /b 1
)
echo Abrindo Chrome do robo (portal NFP)...
"%PY%" "%~dp0agente_nfp.py" abrir-chrome
if errorlevel 1 (
  echo.
  echo Falhou. Confira se o Google Chrome esta instalado.
  echo Preferivel: use abrir_painel.bat e clique em Abrir site Fazenda.
)
echo.
echo Faca login e CAPTCHA no Chrome ate a tela Bem-vindo.
echo Dica: o caminho recomendado e abrir_painel.bat (tela de controle).
pause
endlocal
