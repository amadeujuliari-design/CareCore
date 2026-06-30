@echo off
setlocal
set "ROOT=%~dp0"
set "VENV_DIR=%LOCALAPPDATA%\CareCorePlus\venv"
set "PYTHON=%VENV_DIR%\Scripts\python.exe"

echo ==========================================
echo   SNAPSHOT ONLINE -^> SQLITE LOCAL
echo ==========================================
echo.
echo Este processo baixa uma copia SOMENTE LEITURA do
echo Postgres de producao e grava em SQLite local.
echo Nao altera o banco online do cliente.
echo.

if not exist "%PYTHON%" (
    echo ERRO: ambiente Python nao encontrado em %VENV_DIR%
    echo Execute iniciar.bat uma vez para criar o venv.
    pause
    exit /b 1
)

if not exist "%ROOT%.env.snapshot" (
    echo AVISO: arquivo .env.snapshot nao encontrado.
    echo Copie env.snapshot.example para .env.snapshot e preencha SNAPSHOT_DATABASE_URL.
    echo.
    pause
    exit /b 1
)

"%PYTHON%" "%ROOT%scripts\baixar_snapshot_online.py" %*
set "RC=%ERRORLEVEL%"

echo.
if %RC% NEQ 0 (
    echo Falha ao gerar snapshot.
) else (
    echo Snapshot finalizado.
)
pause
exit /b %RC%
