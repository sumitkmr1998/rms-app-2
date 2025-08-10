@echo off
title MediPOS RMS - Quick Start Launcher
color 0F

echo ==========================================
echo    MediPOS RMS - Quick Start Launcher
echo ==========================================
echo.
echo This script will help you get started quickly!
echo.

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
set "APP_DIR=%SCRIPT_DIR%.."

cd /d "%SCRIPT_DIR%"

echo What would you like to do?
echo.
echo [1] 🔧 First Time Setup (Install everything)
echo [2] 🚀 Start Application (Normal mode)
echo [3] 💻 Start Development Mode (With hot-reload)
echo [4] 🛑 Stop All Services  
echo [5] 📊 Check Service Status
echo [6] ⚙️  Configure Environment
echo [7] 📖 Open Documentation
echo [0] ❌ Exit
echo.
set /p choice="Enter your choice (0-7): "

if "%choice%"=="0" exit /b 0
if "%choice%"=="1" goto first_setup
if "%choice%"=="2" goto start_app
if "%choice%"=="3" goto dev_mode
if "%choice%"=="4" goto stop_services
if "%choice%"=="5" goto check_status
if "%choice%"=="6" goto configure
if "%choice%"=="7" goto documentation

echo [ERROR] Invalid choice
pause
goto :eof

:first_setup
echo.
echo [INFO] Starting First Time Setup...
echo [INFO] This may take several minutes...
call setup.bat
echo.
echo [SUCCESS] Setup completed! 
echo [INFO] You can now start the application with option 2
pause
goto :eof

:start_app
echo.
echo [INFO] Starting MediPOS RMS Application...
call start.bat
goto :eof

:dev_mode
echo.
echo [INFO] Starting Development Mode...
call dev-start.bat
goto :eof

:stop_services
echo.
echo [INFO] Stopping all services...
call stop.bat
goto :eof

:check_status
echo.
echo [INFO] Checking service status...
call check-services.bat
goto :eof

:configure
echo.
echo [INFO] Configuring environment...
call configure-env.bat
goto :eof

:documentation
echo.
echo [INFO] Opening documentation...
start notepad "%APP_DIR%\README_WINDOWS.md"
goto :eof