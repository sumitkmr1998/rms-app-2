@echo off
title MediPOS Application Launcher

REM ============================================================================
REM == This script starts the MongoDB service, the backend, and the frontend ==
REM == for the MediPOS application.                                           ==
REM ============================================================================

REM --- Configuration ---
REM Sets the full path to your project's root directory.
set "PROJECT_PATH=%~dp0"

REM --- Script Body ---
echo ===================================================
echo  Starting MediPOS Pharmacy Management System
echo ===================================================
echo.
echo Project Path is set to: %PROJECT_PATH%
echo.

REM --- 1. Check and Start MongoDB Service ---
echo [1/3] Checking MongoDB Service...
sc query MongoDB | findstr "RUNNING" > nul
if %errorlevel% neq 0 (
    echo    - MongoDB is not running. Attempting to start it...
    net start MongoDB
    if %errorlevel% neq 0 (
        echo    - ERROR: Could not start MongoDB. Please start it manually.
        echo      (Go to Windows Services, find "MongoDB Server", and click "Start")
        pause
        exit /b 1
    ) else (
        echo    - SUCCESS: MongoDB service started.
    )
) else (
    echo    - SUCCESS: MongoDB service is already running.
)
echo.
timeout /t 2 > nul

REM --- 2. Start Backend Server ---
echo [2/3] Starting Backend Server in a new window...
set "BACKEND_PATH=%PROJECT_PATH%backend"

if not exist "%BACKEND_PATH%\venv\Scripts\activate" (
    echo    - ERROR: Backend virtual environment not found in "%BACKEND_PATH%\venv".
    echo      Please run the setup steps to create it first.
    pause
    exit /b 1
)

start "MediPOS Backend" cmd /k "cd /d "%BACKEND_PATH%" && echo Activating backend virtual environment... && call venv\Scripts\activate && echo Starting Uvicorn server on http://localhost:8001 ... && uvicorn server:app --host 0.0.0.0 --port 8001"
echo    - SUCCESS: Backend process launched.
echo.
timeout /t 5 > nul

REM --- 3. Start Frontend Server ---
echo [3/3] Starting Frontend Server in a new window...
set "FRONTEND_PATH=%PROJECT_PATH%frontend"

if not exist "%FRONTEND_PATH%\node_modules" (
    echo    - WARNING: 'node_modules' folder not found. 'npm start' might take a while.
    echo      If it fails, run 'npm install' in the "%FRONTEND_PATH%" directory first.
)

start "MediPOS Frontend" cmd /k "cd /d "%FRONTEND_PATH%" && echo Starting React development server on http://localhost:3000 ... && npm start"
echo    - SUCCESS: Frontend process launched. A browser window should open shortly.
echo.

echo ===================================================
echo  All services have been launched!
echo ===================================================
echo.
echo You can close this launcher window now.
echo To stop the application, simply close the two new windows ("MediPOS Backend" and "MediPOS Frontend").
echo.
pause