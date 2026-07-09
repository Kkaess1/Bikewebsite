@echo off
echo Removing B-Rads Bikes auto-start...

REM Remove the Startup-folder shortcut (current method, no admin needed)
powershell -NoProfile -Command "Remove-Item ([Environment]::GetFolderPath('Startup') + '\BradsBikes.lnk') -ErrorAction SilentlyContinue"

REM Remove the legacy scheduled task, if one exists from an older setup
schtasks /delete /tn "BradsBikes" /f >nul 2>&1

echo Auto-start removed. B-Rads Bikes will no longer start automatically.
echo (The server keeps running until you restart the computer or end
echo node.exe in Task Manager.)
pause
