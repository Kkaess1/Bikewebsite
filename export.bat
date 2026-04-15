@echo off
set DEST=C:\Users\amazn\Desktop\BradsBikes
echo Creating export folder...
if exist "%DEST%" rmdir /S /Q "%DEST%"
mkdir "%DEST%"
echo Copying files...
robocopy "C:\Users\amazn\Documents\Claude\Bike Website" "%DEST%" /E /XD node_modules /XF color-preview.html export.bat
echo.
echo Done! Folder created at: %DEST%
pause
