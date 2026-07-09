@echo off
setlocal
cd /d "%~dp0"
set "electron_config_cache=%cd%\work\electron-cache"

if not exist "node_modules\electron\dist\electron.exe" (
  echo Installing app dependencies...
  call npm.cmd install --cache ".\work\npm-cache"
  if errorlevel 1 goto error
)

call npm.cmd run build
if errorlevel 1 goto error

start "" /D "%cd%" "%cd%\node_modules\electron\dist\electron.exe" "%cd%\src\main.cjs"
exit /b 0

:error
echo.
echo VRM Expression Editor could not start.
echo Please keep this window open and share the message above.
pause
exit /b 1
