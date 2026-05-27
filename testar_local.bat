@echo off
set "ROOT=%~dp0"
set "PYTHON_BACKEND=%ROOT%venv\Scripts\python.exe"

echo ==========================================
echo    TESTES LOCAIS CARECORE+
echo ==========================================

if not exist "%PYTHON_BACKEND%" (
    echo ERRO: ambiente virtual nao encontrado em:
    echo %PYTHON_BACKEND%
    echo.
    echo Instale o ambiente antes de testar:
    echo python -m venv venv
    echo venv\Scripts\python.exe -m pip install -r requirements.txt
    pause
    exit /b 1
)

echo [1/4] Instalando/atualizando dependencias do backend...
cd /d "%ROOT%"
"%PYTHON_BACKEND%" -m pip install -r requirements.txt
if errorlevel 1 goto erro

echo [2/4] Compilando arquivos Python...
"%PYTHON_BACKEND%" -m compileall . -q
if errorlevel 1 goto erro

echo [3/4] Rodando testes backend...
"%PYTHON_BACKEND%" -m pytest
if errorlevel 1 goto erro

echo [4/4] Build do frontend...
cd /d "%ROOT%carecore-front"
npm run build
if errorlevel 1 goto erro

echo.
echo OK: validacao local concluida com sucesso.
pause
exit /b 0

:erro
echo.
echo ERRO: validacao local falhou. Veja as mensagens acima.
pause
exit /b 1
