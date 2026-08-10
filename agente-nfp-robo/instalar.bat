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

where python >nul 2>&1
if errorlevel 1 (
  echo ERRO: Python nao encontrado no PATH.
  echo Instale Python 3.11+ em https://www.python.org/downloads/
  echo Marque "Add python.exe to PATH" na instalacao.
  goto FIM
)

python --version
echo.

set "VENV=%LOCALAPPDATA%\CareCorePlus\agente-nfp-robo\venv"
if not exist "%VENV%\Scripts\python.exe" (
  echo Criando venv em %VENV% ...
  python -m venv "%VENV%"
  if errorlevel 1 (
    echo ERRO ao criar venv.
    goto FIM
  )
)

set "PY=%VENV%\Scripts\python.exe"
echo Usando: %PY%
echo.

echo Instalando dependencias do robo...
"%PY%" -m pip install --upgrade pip
"%PY%" -m pip install -r "%~dp0requirements.txt"
if errorlevel 1 (
  echo ERRO no pip install.
  goto FIM
)

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
