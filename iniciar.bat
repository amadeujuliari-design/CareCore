@echo off
set "ROOT=%~dp0"
set "PYTHON_BACKEND=%ROOT%venv\Scripts\python.exe"

echo ==========================================
echo    INICIANDO O SISTEMA CARECORE+
echo ==========================================

if not exist "%PYTHON_BACKEND%" (
    echo ERRO: ambiente virtual nao encontrado em:
    echo %PYTHON_BACKEND%
    echo.
    echo Crie/instale o ambiente local antes de iniciar:
    echo python -m venv venv
    echo venv\Scripts\python.exe -m pip install -r requirements.txt
    pause
    exit /b 1
)

echo [1/2] Ligando o Backend (Python)...
start "Backend - FastAPI" cmd /k "cd /d ""%ROOT%"" && ""%PYTHON_BACKEND%"" -m uvicorn main:app --reload"

echo [2/2] Ligando o Frontend (React)...
start "Frontend - Vite" cmd /k "cd /d ""%ROOT%carecore-front"" && npm run dev"

echo Sucesso! Os dois servidores estao rodando.
pause