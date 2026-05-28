@echo off
setlocal
set "ROOT=%~dp0"
set "BACKUP_DIR=%ROOT%backups"

echo ==========================================
echo    BACKUP LOCAL CARECORE+
echo ==========================================

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"`) do set "STAMP=%%I"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$root=$env:ROOT; $backupDir=$env:BACKUP_DIR; $stamp=$env:STAMP; $dest=Join-Path $backupDir ('carecore_backup_' + $stamp + '.zip'); $items=@(); $db=Join-Path $root 'carecore_local.db'; $uploads=Join-Path $root 'uploads'; if (Test-Path $db) { $items += $db }; if (Test-Path $uploads) { $items += $uploads }; if ($items.Count -eq 0) { Write-Error 'Nenhum banco local ou pasta uploads encontrada para backup.'; exit 1 }; Compress-Archive -Path $items -DestinationPath $dest -Force; Write-Host ('Backup criado em: ' + $dest)"

if errorlevel 1 goto erro

echo.
echo Backup concluido com sucesso.
pause
exit /b 0

:erro
echo.
echo ERRO: nao foi possivel criar o backup local.
pause
exit /b 1
