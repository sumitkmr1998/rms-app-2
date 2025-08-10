@echo off
title MediPOS RMS - Application Launcher
color 0B

echo ==========================================
echo    MediPOS RMS - Application Launcher
echo ==========================================
echo.

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
set "APP_DIR=%SCRIPT_DIR%.."

REM Change to app directory
cd /d "%APP_DIR%"

echo [INFO] Starting MediPOS RMS Application...
echo [INFO] App Directory: %APP_DIR%
echo.

REM Check if MongoDB is running
echo [INFO] Checking MongoDB connection...
timeout /t 2 /nobreak >nul

REM Start all services using separate command windows
echo [INFO] Starting Backend Server...
start "MediPOS Backend" cmd /k "cd /d \"%APP_DIR%\" && call venv\Scripts\activate.bat && cd backend && python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload"

REM Wait a moment for backend to start
timeout /t 5 /nobreak >nul

echo [INFO] Starting Frontend Server...
start "MediPOS Frontend" cmd /k "cd /d \"%APP_DIR%\frontend\" && yarn start"

REM Wait a moment for frontend to start
timeout /t 3 /nobreak >nul

echo [INFO] Starting MongoDB (if not already running)...
start "MongoDB" cmd /k "mongod --dbpath \"%APP_DIR%\data\db\" --port 27017"

echo.
echo [SUCCESS] All services are starting...
echo.
echo Services:
echo - Backend:  http://localhost:8001
echo - Frontend: http://localhost:3000  
echo - MongoDB:  mongodb://localhost:27017
echo.
echo [INFO] Opening application in browser...
timeout /t 10 /nobreak >nul
start http://localhost:3000

echo.
echo [INFO] Application is now running!
echo [INFO] To stop the application, close all the opened command windows
echo [INFO] or run stop.bat
echo.
pause