# Baixa Python embeddable oficial e deixa pip pronto (cache em LocalAppData).
# Uso: . .\preparar_python_runtime.ps1; $dir = Get-CareCorePythonRuntime
$ErrorActionPreference = 'Stop'

$script:PythonRuntimeVersion = '3.12.10'
$script:PythonEmbedUrl = "https://www.python.org/ftp/python/$script:PythonRuntimeVersion/python-$script:PythonRuntimeVersion-embed-amd64.zip"
$script:GetPipUrl = 'https://bootstrap.pypa.io/get-pip.py'

function Get-CareCorePythonRuntime {
  $cache = Join-Path $env:LOCALAPPDATA "CareCorePlus\cache\python-embed-$script:PythonRuntimeVersion"
  $runtime = Join-Path $cache 'python-runtime'
  $pythonExe = Join-Path $runtime 'python.exe'
  $marker = Join-Path $runtime 'CARECORE_PYTHON.txt'

  if ((Test-Path -LiteralPath $pythonExe) -and (Test-Path -LiteralPath $marker)) {
    $ok = $false
    try {
      & $pythonExe -c "import pip, sys; assert sys.version_info[:2] >= (3, 11)" | Out-Null
      if ($LASTEXITCODE -eq 0) { $ok = $true }
    } catch {
      $ok = $false
    }
    if ($ok) {
      return $runtime
    }
  }

  New-Item -ItemType Directory -Force -Path $cache | Out-Null
  $zip = Join-Path $cache 'python-embed.zip'
  Write-Host "Baixando Python portatil $script:PythonRuntimeVersion (python.org embeddable)..."
  Invoke-WebRequest -Uri $script:PythonEmbedUrl -OutFile $zip -UseBasicParsing

  if (Test-Path -LiteralPath $runtime) {
    Remove-Item -LiteralPath $runtime -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $runtime | Out-Null
  Expand-Archive -LiteralPath $zip -DestinationPath $runtime -Force

  $pth = Get-ChildItem -LiteralPath $runtime -Filter 'python*._pth' -File | Select-Object -First 1
  if (-not $pth) {
    throw "Python embeddable sem arquivo ._pth em $runtime"
  }
  $stdlibZip = Get-ChildItem -LiteralPath $runtime -Filter 'python*.zip' -File |
    Where-Object { $_.Name -match '^python\d+\.zip$' } |
    Select-Object -First 1
  $stdlibNome = if ($stdlibZip) { $stdlibZip.Name } else { 'python312.zip' }
  $pthText = @(
    $stdlibNome
    '.'
    'Lib\site-packages'
    'import site'
  ) -join "`n"
  Set-Content -LiteralPath $pth.FullName -Value $pthText -Encoding ascii

  $getPip = Join-Path $runtime 'get-pip.py'
  Write-Host "Preparando pip no Python portatil..."
  Invoke-WebRequest -Uri $script:GetPipUrl -OutFile $getPip -UseBasicParsing
  & $pythonExe $getPip --no-warn-script-location | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao instalar pip no Python portatil (codigo $LASTEXITCODE)."
  }

  Set-Content -LiteralPath $marker -Value $script:PythonRuntimeVersion -Encoding ascii
  & $pythonExe -c "import pip, sys; assert sys.version_info[:2] >= (3, 11)" | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Python portatil nao passou na validacao pos-pip."
  }

  Write-Host "Python portatil pronto: $runtime"
  return $runtime
}
