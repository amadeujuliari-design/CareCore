@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title CareCore+ Agente NFP - Instalacao
color 0A

echo ================================================
echo   CareCore+ - Agente NFP SEFAZ (por maquina)
echo ================================================
echo.
echo Pasta: %CD%
echo.
echo Este instalador NAO precisa de Python no PATH.
echo.

set "RUNTIME=%LOCALAPPDATA%\CareCorePlus\agente-nfp-python"
if exist "%~dp0python-runtime\python.exe" (
  if not exist "%RUNTIME%\python.exe" (
    echo Preparando Python portatil do CareCore...
    mkdir "%RUNTIME%" >nul 2>&1
    xcopy /E /I /Y "%~dp0python-runtime" "%RUNTIME%" >nul
  )
)

call "%~dp0python_agente.cmd"
if errorlevel 1 (
  echo ERRO: Python portatil nao encontrado neste pacote.
  echo Baixe de novo o agente no CareCore online ^(EXE ou ZIP^).
  goto FIM
)

echo Usando: %PY%
"%PY%" --version
echo.

echo Instalando dependencias do robo...
"%PY%" -m pip install --upgrade pip
"%PY%" -m pip install -r "%~dp0requirements.txt"
if errorlevel 1 (
  echo ERRO no pip install.
  goto FIM
)
"%PY%" -m pip install tzdata

echo.
echo Instalando Chromium do Playwright (apoio)...
"%PY%" -m playwright install chromium
echo.

if not exist "%~dp0config.json" (
  copy /Y "%~dp0config.exemplo.json" "%~dp0config.json" >nul
  echo Criei config.json base (o login sera feito no painel).
) else (
  echo config.json ja existe — nao sobrescrevi.
)

echo.
echo ----------------------------------------
echo Instalacao concluida nesta maquina.
echo Proximo passo: login no painel (e-mail/senha CareCore)
echo para sincronizar a fila online, depois Abrir site Fazenda.
echo ----------------------------------------
echo.
echo Abrindo o painel de controle...
start "" "%~dp0abrir_painel.bat"

:FIM
echo.
pause
endlocal
