@echo off
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
    py -3 start-lan.py %*
    pause
    exit /b
)
where python >nul 2>nul
if not errorlevel 1 (
    python start-lan.py %*
    pause
    exit /b
)
echo Python 3 is required. Install Python 3, then run this file again.
pause
