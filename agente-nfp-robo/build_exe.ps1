# Gera CareCore-Agente-NFP.exe (nao assinado) + ZIP de apoio
# Saida: carecore-front/public/downloads/

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$src = $PSScriptRoot
$outDir = Join-Path $root 'carecore-front\public\downloads'
$buildDir = Join-Path $src '_build_exe'
$payloadZip = Join-Path $buildDir 'agente_payload.zip'
$distExeName = 'CareCore-Agente-NFP.exe'

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
if (Test-Path -LiteralPath $buildDir) { Remove-Item -LiteralPath $buildDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

# 1) Payload (arquivos do agente, sem secrets/caches)
$staging = Join-Path $buildDir 'payload'
New-Item -ItemType Directory -Force -Path $staging | Out-Null
$arquivos = @(
  'agente_nfp.py','painel.py','carecore_api.py','chrome_local.py',
  'requirements.txt','config.exemplo.json','LEIA-ME.txt',
  'abrir_painel.bat','abrir_chrome.bat','instalar.bat',
  'iniciar_envio_continuo.bat','iniciar_envio_lote.bat','parar_envio.bat','status.bat'
)
foreach ($a in $arquivos) {
  $p = Join-Path $src $a
  if (Test-Path -LiteralPath $p) { Copy-Item -LiteralPath $p -Destination (Join-Path $staging $a) -Force }
}
$roboSrc = Join-Path $src 'robo'
$roboDst = Join-Path $staging 'robo'
New-Item -ItemType Directory -Force -Path $roboDst | Out-Null
Copy-Item -LiteralPath (Join-Path $roboSrc '*.py') -Destination $roboDst -Force
Copy-Item -LiteralPath (Join-Path $roboSrc 'requirements.txt') -Destination $roboDst -Force
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $payloadZip -Force

# 2) ZIP publico (opcional / fallback)
& (Join-Path $src 'empacotar_download.ps1')

# 3) PyInstaller
$py = Join-Path $env:LOCALAPPDATA 'CareCorePlus\venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $py)) { $py = (Get-Command python).Source }

Write-Host "Usando Python: $py"
& $py -m pip install -q pyinstaller
$instalador = Join-Path $src 'instalador_exe.py'
$work = Join-Path $buildDir 'pyi'
New-Item -ItemType Directory -Force -Path $work | Out-Null

# --add-data no Windows: origem;destino
$addData = "$payloadZip;."
& $py -m PyInstaller `
  --noconfirm `
  --clean `
  --onefile `
  --name 'CareCore-Agente-NFP' `
  --distpath (Join-Path $buildDir 'dist') `
  --workpath (Join-Path $buildDir 'work') `
  --specpath $work `
  --add-data $addData `
  $instalador

$built = Join-Path $buildDir "dist\$distExeName"
if (-not (Test-Path -LiteralPath $built)) {
  throw "EXE nao gerado: $built"
}
Copy-Item -LiteralPath $built -Destination (Join-Path $outDir $distExeName) -Force

$exeInfo = Get-Item (Join-Path $outDir $distExeName)
$metaExe = Join-Path $outDir 'CareCore-Agente-NFP.json'
$versaoFront = '1.4.52'
$versaoPath = Join-Path $root 'carecore-front\src\config\versao.js'
if (Test-Path -LiteralPath $versaoPath) {
  $m = Select-String -LiteralPath $versaoPath -Pattern "CARECORE_VERSAO = '([^']+)'"
  if ($m) { $versaoFront = $m.Matches[0].Groups[1].Value }
}
$info = [ordered]@{
  arquivo       = $distExeName
  versao_app    = $versaoFront
  gerado_em     = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  fuso          = 'America/Sao_Paulo'
  tamanho_bytes = $exeInfo.Length
  assinado      = $false
  instrucoes    = @(
    'Baixe CareCore-Agente-NFP.exe. Se o Windows avisar, OK e use Desbloquear (Propriedades) ou Executar mesmo assim.',
    'Execute o .exe (precisa Python 3.11+ no PATH e Google Chrome).',
    'Ao terminar a instalacao, o painel abre sozinho. Faca login CareCore para sincronizar a fila online.',
    'No painel: Abrir site Fazenda -> CAPTCHA -> Enviar fila.',
    'Nas proximas vezes use o atalho na Area de Trabalho ou rode o .exe de novo.'
  )
}
($info | ConvertTo-Json -Depth 4) | Set-Content -LiteralPath $metaExe -Encoding UTF8

Write-Host "EXE: $($exeInfo.FullName)"
Write-Host ("Tamanho: {0:N1} MB" -f ($exeInfo.Length / 1MB))
