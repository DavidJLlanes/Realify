@echo off
setlocal EnableExtensions
set "ROOT=%LOCALAPPDATA%\RealifyAI"
set "PY=%ROOT%\venv\Scripts\python.exe"
set "SERVER=%ROOT%\app\advanced-ai\local-service\server.py"

echo ========================================
echo Realify AI Local - Diagnostico
echo ========================================
echo.
echo Carpeta: %ROOT%
echo.

if not exist "%PY%" (
  echo [ERROR] No existe el Python del entorno local:
  echo %PY%
  goto :logs
)

echo [1] Python:
"%PY%" --version
echo.

echo [2] PyTorch y CUDA:
"%PY%" -c "import torch; print('torch=', torch.__version__); print('cuda_available=', torch.cuda.is_available()); print('cuda_version=', torch.version.cuda); print('gpu=', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'NO GPU')"
echo.

echo [3] Importando servidor Realify...
"%PY%" -c "import sys; sys.path.insert(0, r'%ROOT%\app\advanced-ai\local-service'); import server; print('IMPORT OK', server.SERVICE_VERSION)"
if errorlevel 1 (
  echo [ERROR] El servidor no puede importarse.
) else (
  echo [OK] Importacion correcta.
)
echo.

echo [4] Puerto 17834:
powershell.exe -NoProfile -Command "$c=Get-NetTCPConnection -LocalPort 17834 -State Listen -ErrorAction SilentlyContinue; if($c){$c ^| Format-Table -AutoSize}else{Write-Host 'NO LISTEN'}"
echo.

echo [5] Peticion a /status:
powershell.exe -NoProfile -Command "try { $r=Invoke-RestMethod 'http://127.0.0.1:17834/status' -Headers @{'X-Realify-Client'='web'} -TimeoutSec 5; $r ^| ConvertTo-Json -Depth 5 } catch { Write-Host 'ERROR:' $_.Exception.Message }"
echo.

:logs
echo [6] Ultimas lineas de service-err.log:
if exist "%ROOT%\service-err.log" (
  powershell.exe -NoProfile -Command "Get-Content -Tail 80 '%ROOT%\service-err.log'"
) else (
  echo No existe service-err.log
)
echo.
echo [7] Ultimas lineas de install.log:
if exist "%ROOT%\install.log" (
  powershell.exe -NoProfile -Command "Get-Content -Tail 80 '%ROOT%\install.log'"
) else (
  echo No existe install.log
)
echo.
pause
