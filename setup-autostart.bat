@echo off
echo Setting up B-Rads Bikes auto-start...
echo (Run this as the account you normally log in with — no admin needed.)
echo.

REM Verify Node.js is reachable before registering anything
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  if not exist "C:\Program Files\nodejs\node.exe" (
    echo ERROR: Node.js was not found on this computer.
    echo Install it from https://nodejs.org and run this again.
    pause
    exit /b 1
  )
)

set VBS=%~dp0start-silent.vbs

REM No elevation: the server does not need admin rights, and elevated tasks
REM can end up registered under the wrong account.
schtasks /create /tn "BradsBikes" /tr "wscript.exe \"%VBS%\"" /sc ONLOGON /f

if %ERRORLEVEL% == 0 (
  echo.
  echo Starting the server now...
  schtasks /run /tn "BradsBikes"
  echo.
  echo Done! B-Rads Bikes is starting and will also start automatically
  echo every time you log in to Windows.
  echo Give it a few seconds, then open:  http://localhost:3000
  echo.
  echo If the site does not load, open server.log in this folder to see why.
  echo To remove auto-start, run remove-autostart.bat
) else (
  echo.
  echo ERROR: Failed to create the scheduled task. See the message above.
)
pause
