@echo off
setlocal
cd /d "%~dp0"
echo Gerando CareCore-Agente-NFP.exe ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build_exe.ps1"
set ERR=%ERRORLEVEL%
if %ERR% neq 0 (
  echo Falha codigo %ERR%.
) else (
  echo OK — veja carecore-front\public\downloads\CareCore-Agente-NFP.exe
)
pause
endlocal
