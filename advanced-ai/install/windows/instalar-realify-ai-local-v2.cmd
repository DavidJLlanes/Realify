@echo off
setlocal EnableExtensions

set "REALIFY_BOOTSTRAP=%LOCALAPPDATA%\RealifyAI\bootstrap"
set "INSTALLER_FILE=%REALIFY_BOOTSTRAP%\install-realify-ai-local-v2.ps1"
set "PRIMARY_URL=https://raw.githubusercontent.com/DavidJLlanes/Realify/main/advanced-ai/install/windows/install-realify-ai-local.ps1?v=4a072ec018be56de4700a82d4b33a7360b06cb0f"
set "FALLBACK_URL=https://realify.es/advanced-ai/install/windows/install-realify-ai-local.ps1?v=4a072ec018be56de4700a82d4b33a7360b06cb0f"

if not exist "%REALIFY_BOOTSTRAP%" mkdir "%REALIFY_BOOTSTRAP%"
del /f /q "%INSTALLER_FILE%" >nul 2>&1

echo Descargando instalador actualizado de Realify AI Local...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing '%PRIMARY_URL%' -Headers @{'Cache-Control'='no-cache'} -OutFile '%INSTALLER_FILE%' -ErrorAction Stop; exit 0 } catch { exit 1 }"

if errorlevel 1 (
  echo Descarga principal fallida. Probando servidor de Realify...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing '%FALLBACK_URL%' -Headers @{'Cache-Control'='no-cache'} -OutFile '%INSTALLER_FILE%' -ErrorAction Stop; exit 0 } catch { exit 1 }"
)

if errorlevel 1 (
  echo.
  echo No se pudo descargar el instalador.
  pause
  exit /b 1
)

echo Verificando que el instalador contiene la correccion actual...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$c=Get-Content -Raw '%INSTALLER_FILE%'; if($c -match '\$\{LASTEXITCODE\}:'){ exit 0 } else { exit 2 }"
if errorlevel 1 (
  echo.
  echo ERROR: Se ha descargado una copia antigua del instalador.
  echo Borra la cache del navegador o intentalo de nuevo en unos minutos.
  pause
  exit /b 2
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%INSTALLER_FILE%"
if errorlevel 1 (
  echo.
  echo La instalacion no termino correctamente.
  pause
  exit /b 1
)

echo.
echo Realify AI Local instalado.
pause
