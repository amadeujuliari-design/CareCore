# Empacota agente-nfp-robo.zip em carecore-front/public/downloads/
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if ((Split-Path -Leaf $PSScriptRoot) -ne 'agente-nfp-robo') {
  # se o script estiver em agente-nfp-robo, parent = repo root
  $root = Split-Path -Parent $PSScriptRoot
}
$src = $PSScriptRoot
$outDir = Join-Path $root 'carecore-front\public\downloads'
$staging = Join-Path $env:TEMP ('carecore-agente-nfp-robo-staging-' + [guid]::NewGuid().ToString('N'))
$zip = Join-Path $outDir 'agente-nfp-robo.zip'
$meta = Join-Path $outDir 'agente-nfp-robo.json'

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
New-Item -ItemType Directory -Force -Path $staging | Out-Null

$excludeDirs = @('_capturas', '__pycache__', '.git', '_build_exe', 'python-runtime')
Get-ChildItem -LiteralPath $src -Force | ForEach-Object {
  if ($_.Name -in @('config.json', '.token', 'empacotar_download.bat', 'empacotar_download.ps1', 'build_exe.bat', 'build_exe.ps1', 'instalador_exe.py', 'preparar_python_runtime.ps1', 'python-runtime')) { return }
  if ($_.PSIsContainer -and $_.Name -in $excludeDirs) { return }
  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $staging $_.Name) -Recurse -Force
}

Get-ChildItem -LiteralPath $staging -Recurse -Force -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -in $excludeDirs } |
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

Get-ChildItem -LiteralPath $staging -Recurse -Force -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Extension -in '.pyc', '.pyo' -or $_.Name -in @('config.json', '.token') } |
  Remove-Item -Force -ErrorAction SilentlyContinue

$pythonRuntime = $env:CARECORE_PYTHON_RUNTIME
if ($pythonRuntime -and (Test-Path -LiteralPath (Join-Path $pythonRuntime 'python.exe'))) {
  Copy-Item -LiteralPath $pythonRuntime -Destination (Join-Path $staging 'python-runtime') -Recurse -Force
}

if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zip -CompressionLevel Optimal
Remove-Item -LiteralPath $staging -Recurse -Force

$versaoFront = '1.4.49'
$versaoPath = Join-Path $root 'carecore-front\src\config\versao.js'
if (Test-Path -LiteralPath $versaoPath) {
  $m = Select-String -LiteralPath $versaoPath -Pattern "CARECORE_VERSAO = '([^']+)'"
  if ($m) { $versaoFront = $m.Matches[0].Groups[1].Value }
}

$info = [ordered]@{
  arquivo       = 'agente-nfp-robo.zip'
  versao_app    = $versaoFront
  gerado_em     = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  fuso          = 'America/Sao_Paulo'
  tamanho_bytes = (Get-Item -LiteralPath $zip).Length
  instrucoes    = @(
    'Baixe o ZIP. Se o Windows avisar que pode nao ser seguro: OK; botao direito no ZIP -> Propriedades -> Desbloquear -> Aplicar. Se pedir Executar mesmo assim, pode seguir (agente oficial CareCore).',
    'Descompacte e rode instalar.bat. Nao precisa instalar Python - o ZIP ja traz o Python do agente. E preciso ter Google Chrome.',
    'Ao terminar, o painel abre no navegador. Faca login com e-mail e senha do CareCore (ADM Global ou Manutencao) para sincronizar a fila online.',
    'No painel: Abrir site Fazenda -> login/CAPTCHA ate Bem-vindo -> Enviar fila.',
    'Deixe a janela preta do painel aberta enquanto envia; use Parar se precisar.'
  )
}
($info | ConvertTo-Json -Depth 4) | Set-Content -LiteralPath $meta -Encoding UTF8

Write-Host "Gerado: $zip"
Write-Host "Meta:   $meta"
Write-Host ("Tamanho: {0:N1} KB" -f ((Get-Item $zip).Length / 1KB))
