@echo off
setlocal EnableDelayedExpansion

echo ==========================================
echo    PARANDO CARECORE+ (LOCAL)
echo ==========================================

echo [1/3] Fechando janelas CareCore+...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process cmd -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like 'CareCore+*' } | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }"

echo [2/3] Encerrando uvicorn e vite...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"Name = 'python.exe'\" | Where-Object { $_.CommandLine -like '*uvicorn main:app*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Where-Object { $_.CommandLine -like '*vite*' -or $_.CommandLine -like '*carecore-front*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo [3/3] Liberando portas 8000, 8002, 8010, 8011 e 5173...
powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach ($port in 8000,8002,8010,8011,5173) { Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { if ($_ -gt 0) { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } } }"

timeout /t 3 /nobreak >nul

echo.
echo Portas restantes:
netstat -ano | findstr ":8010 " | findstr LISTENING
netstat -ano | findstr ":8011 " | findstr LISTENING
netstat -ano | findstr ":5173 " | findstr LISTENING

echo.
echo CareCore+ local parado.
endlocal
