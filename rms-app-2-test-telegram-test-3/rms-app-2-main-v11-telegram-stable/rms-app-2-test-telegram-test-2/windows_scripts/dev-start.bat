@echo off
title MediPOS RMS - Development Mode
color 0D

echo ==========================================
echo    MediPOS RMS - Development Mode
echo ==========================================
echo.

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
set "APP_DIR=%SCRIPT_DIR%.."

echo [INFO] Starting in Development Mode...
echo [INFO] This will start all services with hot-reload enabled
echo.

REM Change to app directory
cd /d "%APP_DIR%"

REM Check if virtual environment exists
if not exist "venv" (
    echo [ERROR] Virtual environment not found!
    echo [INFO] Please run setup.bat first
    pause
    exit /b 1
)

REM Start MongoDB in background
echo [INFO] Starting MongoDB...
if not exist "data\db" mkdir "data\db"
start /min "MongoDB" cmd /c "mongod --dbpath \"%APP_DIR%\data\db\" --port 27017 --quiet"

REM Wait for MongoDB to start
timeout /t 3 /nobreak >nul

REM Start Backend with hot-reload
echo [INFO] Starting Backend Server (Hot-reload enabled)...
start "MediPOS Backend [DEV]" cmd /k "cd /d \"%APP_DIR%\" && call venv\Scripts\activate.bat && cd backend && echo [DEV MODE] Backend Server Starting... && python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload --log-level info"

REM Wait for backend to start
timeout /t 5 /nobreak >nul

REM Start Frontend with hot-reload
echo [INFO] Starting Frontend Server (Hot-reload enabled)...
start "MediPOS Frontend [DEV]" cmd /k "cd /d \"%APP_DIR%\frontend\" && echo [DEV MODE] Frontend Server Starting... && set BROWSER=none && yarn start"

echo.
echo [SUCCESS] Development environment started!
echo.
echo Services (Development Mode):
echo - Backend:  http://localhost:8001 (Hot-reload ON)
echo - Frontend: http://localhost:3000 (Hot-reload ON)
echo - MongoDB:  mongodb://localhost:27017
echo.
echo [INFO] Changes to code will automatically reload the servers
echo [INFO] Opening application in browser...

timeout /t 8 /nobreak >nul
start http://localhost:3000

echo.
echo [INFO] Development mode is running!
echo [INFO] Watch the individual terminal windows for logs
echo [INFO] Use Ctrl+C in each terminal to stop individual services
echo.
pause