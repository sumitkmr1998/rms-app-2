@echo off
title MongoDB Server - MediPOS RMS
color 0E

echo ==========================================
echo    Starting MongoDB Server Only
echo ==========================================
echo.

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
set "APP_DIR=%SCRIPT_DIR%.."

REM Create MongoDB data directory if it doesn't exist
if not exist "%APP_DIR%\data\db" (
    echo [INFO] Creating MongoDB data directory...
    mkdir "%APP_DIR%\data\db"
)

echo [INFO] Starting MongoDB Server...
echo [INFO] Data Directory: %APP_DIR%\data\db
echo [INFO] Port: 27017
echo [INFO] Database: test_database
echo.

REM Start MongoDB
cd /d "%APP_DIR%"
mongod --dbpath "%APP_DIR%\data\db" --port 27017

echo.
echo [INFO] MongoDB server stopped
pause