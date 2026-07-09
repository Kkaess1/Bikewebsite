@echo off
echo Setting up B-Rads Bikes auto-start...
echo (No administrator rights needed.)
echo.

REM Verify Node.js is reachable before setting anything up
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

REM Create a shortcut in the current user's Startup folder — runs at every
REM login for this account, no admin rights or scheduled task involved.
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $lnk = $ws.CreateShortcut([Environment]::GetFolderPath('Startup') + '\BradsBikes.lnk'); $lnk.TargetPath = 'wscript.exe'; $lnk.Arguments = '\"%VBS%\"'; $lnk.Description = 'B-Rads Bikes server (silent)'; $lnk.Save()"

if %ERRORLEVEL% == 0 (
  echo.
  echo Starting the server now...
  wscript.exe "%VBS%"
  echo.
  echo Done! B-Rads Bikes is starting and will also start automatically
  echo every time this user logs in to Windows.
  echo Give it a few seconds, then open:  http://localhost:3000
  echo.
  echo If the site does not load, open server.log in this folder to see why.
  echo To remove auto-start, run remove-autostart.bat
) else (
  echo.
  echo ERROR: Could not create the Startup shortcut. See the message above.
)
pause
