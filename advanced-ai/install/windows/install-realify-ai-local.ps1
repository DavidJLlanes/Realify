param([switch]$NoStartup)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$Root = Join-Path $env:LOCALAPPDATA "RealifyAI"
$App = Join-Path $Root "app"
$Venv = Join-Path $Root "venv"
$Tmp = Join-Path $Root "download"
$RepoZip = Join-Path $Tmp "realify-main.zip"
$RepoDir = Join-Path $Tmp "Realify-main"
$Log = Join-Path $Root "install.log"
New-Item -ItemType Directory -Force -Path $Root,$Tmp | Out-Null
Start-Transcript -Path $Log -Append | Out-Null
function Invoke-NativeChecked {
  param(
    [Parameter(Mandatory=$true)][string]$FilePath,
    [Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments
  )
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "El comando falló con código ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
  }
}

function Find-Python311 {
  try { $p = (& py -3.11 -c "import sys; print(sys.executable)" 2>$null).Trim(); if ($LASTEXITCODE -eq 0 -and (Test-Path $p)) { return $p } } catch {}
  try { $p = (& python -c "import sys; print(sys.executable if sys.version_info[:2]==(3,11) else '')" 2>$null).Trim(); if ($p -and (Test-Path $p)) { return $p } } catch {}
  return $null
}
Write-Host "=== Realify AI Local ===" -ForegroundColor Cyan
$Python = Find-Python311
if (-not $Python) {
  Write-Host "Python 3.11 no encontrado. Intentando instalarlo con winget..." -ForegroundColor Yellow
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw "Instala Python 3.11 de 64 bits y vuelve a ejecutar este instalador." }
  winget install --id Python.Python.3.11 --exact --silent --accept-package-agreements --accept-source-agreements
  $Python = Find-Python311
  if (-not $Python) { throw "No se pudo localizar Python 3.11." }
}
Write-Host "[1/7] Descargando Realify AI Local..."
Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $Tmp | Out-Null
Invoke-WebRequest "https://github.com/DavidJLlanes/Realify/archive/refs/heads/main.zip" -OutFile $RepoZip
Expand-Archive -Path $RepoZip -DestinationPath $Tmp -Force
if (-not (Test-Path (Join-Path $RepoDir "advanced-ai"))) { throw "El paquete no contiene advanced-ai." }
Write-Host "[2/7] Instalando archivos locales..."
Remove-Item -Recurse -Force $App -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $App | Out-Null
Copy-Item -Recurse -Force (Join-Path $RepoDir "advanced-ai") (Join-Path $App "advanced-ai")
Write-Host "[3/7] Creando entorno Python..."
if (-not (Test-Path (Join-Path $Venv "Scripts\python.exe"))) { & $Python -m venv $Venv }
$Vpy = Join-Path $Venv "Scripts\python.exe"
$Vpyw = Join-Path $Venv "Scripts\pythonw.exe"
Invoke-NativeChecked $Vpy -m pip install --upgrade pip setuptools wheel
Write-Host "[4/7] Instalando PyTorch CUDA 12.8..."
Invoke-NativeChecked $Vpy -m pip install --upgrade torch==2.9.1 torchvision==0.24.1 --index-url https://download.pytorch.org/whl/cu128
Write-Host "[5/7] Instalando motores de Realify..."
$Req = Join-Path $App "advanced-ai\local-service\requirements.txt"
Invoke-NativeChecked $Vpy -m pip install -r $Req
Write-Host "[6/7] Comprobando CUDA..."
$Cuda = & $Vpy -c "import torch; print('OK' if torch.cuda.is_available() else 'NO'); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else '')"
if ($LASTEXITCODE -ne 0) { throw "PyTorch no pudo ejecutarse correctamente." }
if ($Cuda[0] -ne "OK") { throw "CUDA no está disponible. Actualiza el driver NVIDIA y vuelve a ejecutar el instalador." }
Write-Host ("GPU detectada: " + $Cuda[1]) -ForegroundColor Green

Write-Host "[7/7] Comprobando servidor Realify AI Local..."
$ServiceDir = Join-Path $App "advanced-ai\local-service"
Push-Location $ServiceDir
try {
  Invoke-NativeChecked $Vpy -c "import server; print('Realify AI Local', server.SERVICE_VERSION)"
} finally {
  Pop-Location
}

$StartPs1 = Join-Path $Root "start-realify-ai-local.ps1"
$Server = Join-Path $App "advanced-ai\local-service\server.py"
$startLines = @(
  '$ErrorActionPreference = "Stop"',
  ('$python = "' + $Vpy + '"'),
  ('$server = "' + $Server + '"'),
  ('$outlog = "' + (Join-Path $Root "service-out.log") + '"'),
  ('$errlog = "' + (Join-Path $Root "service-err.log") + '"'),
  '$existing = Get-NetTCPConnection -LocalPort 17834 -State Listen -ErrorAction SilentlyContinue',
  'if ($existing) { exit 0 }',
  'Start-Process -FilePath $python -ArgumentList @($server) -WorkingDirectory (Split-Path $server) -WindowStyle Hidden -RedirectStandardOutput $outlog -RedirectStandardError $errlog'
)
$startLines | Set-Content -Encoding UTF8 $StartPs1
if (-not $NoStartup) {
  $Startup = [Environment]::GetFolderPath("Startup")
  $StartupCmd = Join-Path $Startup "Realify AI Local.cmd"
  $cmd = '@echo off' + [Environment]::NewLine + 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $StartPs1 + '"' + [Environment]::NewLine
  $cmd | Set-Content -Encoding ASCII $StartupCmd
}
Write-Host "Cerrando servicio anterior de Realify AI Local si está activo..."
$listener = Get-NetTCPConnection -LocalPort 17834 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  try { taskkill /PID $listener.OwningProcess /F | Out-Null } catch {}
  Start-Sleep -Milliseconds 800
}
Write-Host "Arrancando Realify AI Local..."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $StartPs1

$status = $null
for ($i = 1; $i -le 20; $i++) {
  Start-Sleep -Milliseconds 750
  try {
    $status = Invoke-RestMethod "http://127.0.0.1:17834/status" -Headers @{"X-Realify-Client"="web"} -TimeoutSec 3
    if ($status) { break }
  } catch {}
}
if (-not $status) {
  Write-Host ""
  Write-Host "ERROR: Realify AI Local no ha arrancado." -ForegroundColor Red
  if (Test-Path (Join-Path $Root "service-err.log")) {
    Write-Host "--- service-err.log ---" -ForegroundColor Yellow
    Get-Content -Tail 80 (Join-Path $Root "service-err.log")
  }
  throw "El puerto 17834 no responde."
}
if (-not $status.ready) { throw ("El servicio respondió pero no está listo: " + $status.reason) }
Write-Host ("Motor listo: " + $status.gpu + " · " + $status.vramGB + " GB VRAM") -ForegroundColor Green
Write-Host "Vuelve a Realify.es y pulsa Volver a comprobar."
Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
Stop-Transcript | Out-Null
