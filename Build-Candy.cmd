@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-windows.ps1"
if errorlevel 1 (
 echo.
 echo Candy could not be built. Read the error above.
 pause
 exit /b 1
)
pause
