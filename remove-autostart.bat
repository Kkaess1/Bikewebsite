@echo off
schtasks /delete /tn "BradsBikes" /f

if %ERRORLEVEL% == 0 (
  echo Auto-start removed. B-Rads Bikes will no longer start automatically.
) else (
  echo Auto-start task was not found or could not be removed.
)
pause
