@echo off
setlocal
set "URL=https://realify.es/advanced-ai/install/windows/install-realify-ai-local.ps1"
set "TMP=%TEMP%\install-realify-ai-local.ps1"
echo Descargando instalador de Realify AI Local...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest '%URL%' -OutFile '%TMP%'"
if errorlevel 1 (echo No se pudo descargar el instalador.& pause & exit /b 1)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%TMP%"
if errorlevel 1 (echo La instalacion no termino correctamente.& pause & exit /b 1)
echo Realify AI Local instalado.
pause
