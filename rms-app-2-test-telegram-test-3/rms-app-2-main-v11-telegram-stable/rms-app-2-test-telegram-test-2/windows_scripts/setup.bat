@echo off
title MediPOS RMS - Setup and Installation
color 0A

echo ==========================================
echo    MediPOS RMS - Windows Setup Script
echo ==========================================
echo.

echo [INFO] Checking system requirements...

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH
    echo [INFO] Please download and install Python 3.8+ from https://python.org
    echo [INFO] Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo [INFO] Please download and install Node.js from https://nodejs.org
    pause
    exit /b 1
)

REM Check if MongoDB is installed
mongod --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] MongoDB is not installed or not in PATH
    echo [INFO] Please download and install MongoDB Community Edition from:
    echo [INFO] https://www.mongodb.com/try/download/community
    echo [INFO] Or install MongoDB using chocolatey: choco install mongodb
    echo.
    set /p continue="Continue without MongoDB check? (y/N): "
    if /i "%continue%" neq "y" (
        pause
        exit /b 1
    )
)

REM Check if Yarn is installed, if not install it
yarn --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Yarn not found, installing via npm...
    npm install -g yarn
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install Yarn
        pause
        exit /b 1
    )
)

echo [SUCCESS] All system requirements are met!
echo.

echo [INFO] Setting up Python virtual environment...
cd /d "%~dp0.."

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    python -m venv venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment
        pause
        exit /b 1
    )
)

REM Activate virtual environment and install backend dependencies
echo [INFO] Installing Python dependencies...
call venv\Scripts\activate.bat
cd backend
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Python dependencies
    pause
    exit /b 1
)
cd ..

REM Install frontend dependencies
echo [INFO] Installing Node.js dependencies...
cd frontend
call yarn install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Node.js dependencies
    pause
    exit /b 1
)
cd ..

echo.
echo [SUCCESS] Setup completed successfully!
echo [INFO] You can now run the application using start.bat
echo.
pause