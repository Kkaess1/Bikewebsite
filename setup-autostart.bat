@echo off
echo Setting up B-Rads Bikes auto-start via Task Scheduler...

set VBS=%~dp0start-silent.vbs

schtasks /create /tn "BradsBikes" /tr "wscript.exe \"%VBS%\"" /sc ONLOGON /rl HIGHEST /f

if %ERRORLEVEL% == 0 (
  echo.
  echo Done! B-Rads Bikes will now start automatically every time you log in to Windows.
  echo You can still open it manually with start.bat anytime.
  echo.
  echo To remove auto-start, run remove-autostart.bat
) else (
  echo.
  echo ERROR: Failed to create scheduled task. Try right-clicking setup-autostart.bat
  echo and selecting "Run as administrator".
)
pause
