@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==============================================
echo DELTA MINING OPS - PRECARGA GLOBAL
echo ==============================================
echo.

if not exist "src\App.jsx" (
  echo ERROR: Descomprimi este ZIP en la raiz del proyecto.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js no esta disponible.
  pause
  exit /b 1
)

node aplicar_precarga_global.mjs
set ERR=%ERRORLEVEL%

echo.
if "%ERR%"=="0" (
  echo LISTO. Si viste BUILD OK, ya podes hacer el push.
) else (
  echo ERROR. No hagas push.
)
echo.
pause
exit /b %ERR%
