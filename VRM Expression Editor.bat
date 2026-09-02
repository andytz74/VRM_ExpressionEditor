@echo off
setlocal
cd /d "%~dp0"

call npm.cmd start
if errorlevel 1 goto error
exit /b 0

:error
echo.
echo VRM Expression Editor could not start.
echo Please keep this window open and share the message above.
pause
exit /b 1
