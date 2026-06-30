@echo off
setlocal
set "ROOT=%~dp0"
set "FRONTEND=%ROOT%carecore-front"
set "VENV_DIR=%LOCALAPPDATA%\CareCorePlus\venv"
set "PYTHON_BACKEND=%VENV_DIR%\Scripts\python.exe"

echo ==========================================
echo    INICIANDO O SISTEMA CARECORE+
echo ==========================================

if not exist "%PYTHON_BACKEND%" goto criar_venv
"%PYTHON_BACKEND%" --version >nul 2>&1
if errorlevel 1 goto criar_venv
goto python_ok

:criar_venv
echo Ambiente virtual local nao encontrado. Criando em %VENV_DIR%...
if not exist "%LOCALAPPDATA%\CareCorePlus" mkdir "%LOCALAPPDATA%\CareCorePlus"
python -m venv --clear "%VENV_DIR%" 2>nul || py -3 -m venv --clear "%VENV_DIR%"
if not exist "%PYTHON_BACKEND%" (
  echo ERRO: Python nao encontrado.
  pause
  exit /b 1
)

:python_ok
where npm >nul 2>&1
if errorlevel 1 (
  echo ERRO: Node.js/npm nao encontrado.
  pause
  exit /b 1
)

cd /d "%ROOT%"
"%PYTHON_BACKEND%" -c "import fastapi, uvicorn, sqlalchemy, aiosqlite" >nul 2>&1
if errorlevel 1 (
  echo Instalando dependencias do backend...
  "%PYTHON_BACKEND%" -m pip install -r requirements.txt
)

if not exist "%FRONTEND%\node_modules" (
  echo Instalando dependencias do frontend...
  cd /d "%FRONTEND%"
  npm install
)

echo.
echo Usando reiniciar_local.bat (porta unica em scripts/dev_local.json)...
call "%~dp0reiniciar_local.bat"
exit /b %ERRORLEVEL%
