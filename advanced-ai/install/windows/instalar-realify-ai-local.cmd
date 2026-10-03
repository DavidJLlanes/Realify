@echo off
setlocal EnableExtensions

set "REALIFY_BOOTSTRAP=%LOCALAPPDATA%\RealifyAI\bootstrap"
set "INSTALLER_FILE=%REALIFY_BOOTSTRAP%\install-realify-ai-local.ps1"
set "PRIMARY_URL=https://raw.githubusercontent.com/DavidJLlanes/Realify/main/advanced-ai/install/windows/install-realify-ai-local.ps1"
set "FALLBACK_URL=https://realify.es/advanced-ai/install/windows/install-realify-ai-local.ps1"

if not exist "%REALIFY_BOOTSTRAP%" mkdir "%REALIFY_BOOTSTRAP%"
del /f /q "%INSTALLER_FILE%" >nul 2>&1

echo Descargando instalador de Realify AI Local...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing '%PRIMARY_URL%' -OutFile '%INSTALLER_FILE%' -ErrorAction Stop; exit 0 } catch { exit 1 }"

if errorlevel 1 (
  echo Descarga principal fallida. Probando servidor de Realify...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing '%FALLBACK_URL%' -OutFile '%INSTALLER_FILE%' -ErrorAction Stop; exit 0 } catch { exit 1 }"
)

if errorlevel 1 (
  echo.
  echo No se pudo descargar el instalador.
  echo Comprueba tu conexion o antivirus e intentalo de nuevo.
  pause
  exit /b 1
)

if not exist "%INSTALLER_FILE%" (
  echo.
  echo El instalador no se ha creado correctamente.
  pause
  exit /b 1
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
