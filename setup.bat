@echo off
title MediPOS Application Setup Script

REM ============================================================================
REM == This script will set up the entire MediPOS application environment on  ==
REM == Windows. It creates virtual environments, installs all dependencies,   ==
REM == and creates the necessary configuration files.                         ==
REM ==                                                                        ==
REM == Please run this script from the root directory of the project.         ==
REM ============================================================================

REM --- Set the project's root directory based on this script's location ---
set "PROJECT_PATH=%~dp0"

:start
cls
echo =============================================================
echo          MediPOS Pharmacy Management System Setup
echo =============================================================
echo.
echo This script will prepare the application for its first run.
echo It will install all necessary dependencies for the frontend
echo and backend.
echo.
echo Project root directory is:
echo %PROJECT_PATH%
echo.
pause
echo.

REM --- 1. Prerequisite Checks ---
echo [1/4] Checking for prerequisites (Python and Node.js)...

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo   - ERROR: Python is not found in your system's PATH.
    echo     Please install Python 3 from python.org and ensure you
    echo     check the "Add Python to PATH" option during installation.
    goto :error
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo   - ERROR: Node.js and npm are not found in your system's PATH.
    echo     Please install Node.js from nodejs.org.
    goto :error
)
echo   - SUCCESS: Python and Node.js found.
echo.


REM --- 2. Backend Setup ---
echo [2/4] Setting up Backend...
set "BACKEND_PATH=%PROJECT_PATH%backend"
cd /d "%BACKEND_PATH%"

if not exist "%BACKEND_PATH%\requirements.txt" (
    echo   - ERROR: Cannot find requirements.txt in the backend directory.
    goto :error
)

echo   - Creating Python virtual environment in 'venv'...
python -m venv venv
if %errorlevel% neq 0 (
    echo   - ERROR: Failed to create the Python virtual environment.
    goto :error
)

echo   - Installing Python dependencies from requirements.txt...
echo     (This may take a moment)
call venv\Scripts\python.exe -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo   - ERROR: Failed to install Python dependencies. Please check your connection.
    goto :error
)

echo   - Creating backend .env file...
(
    echo MONGO_URL=mongodb://localhost:27017/
    echo DB_NAME="test_database"
) > .env

echo   - SUCCESS: Backend setup complete.
echo.


REM --- 3. Frontend Setup ---
echo [3/4] Setting up Frontend...
set "FRONTEND_PATH=%PROJECT_PATH%frontend"
cd /d "%FRONTEND_PATH%"

if not exist "%FRONTEND_PATH%\package.json" (
    echo   - ERROR: Cannot find package.json in the frontend directory.
    goto :error
)

echo   - Installing Node.js dependencies...
echo     (This can take several minutes, please be patient)
yarn install
if %errorlevel% neq 0 (
    echo   - ERROR: Failed to install Node.js dependencies.
    goto :error
)

echo   - Creating frontend .env file...
(
    echo REACT_APP_BACKEND_URL=http://localhost:8001
) > .env
echo   - SUCCESS: Frontend setup complete.
echo.


REM --- 4. Finalizing Setup ---
echo [4/4] Finalizing setup...
cd /d "%PROJECT_PATH%"
echo   - All tasks completed successfully.
echo.
goto :success


:error
echo.
echo =============================================================
echo  An error occurred during setup. Please review the messages
echo  above, address the issue, and run the script again.
echo =============================================================
echo.
pause
exit /b 1


:success
echo.
echo =============================================================
echo  SETUP COMPLETE!
echo =============================================================
echo.
echo You can now run the application using the 'start-medipos.bat'
echo script.
echo.
pause
exit /b 0