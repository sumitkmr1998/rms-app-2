@echo off
title MediPOS RMS - Environment Configuration
color 0B

echo ==========================================
echo   MediPOS RMS - Environment Configuration
echo ==========================================
echo.

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
set "APP_DIR=%SCRIPT_DIR%.."

cd /d "%APP_DIR%"

echo [INFO] Configuring environment files...
echo.

REM Configure Backend .env
echo [INFO] Setting up backend environment...
if not exist "backend\.env" (
    echo MONGO_URL=mongodb://localhost:27017> backend\.env
    echo DB_NAME=medipos_database>> backend\.env
    echo CORS_ORIGINS=*>> backend\.env
    echo [SUCCESS] Backend .env created
) else (
    echo [INFO] Backend .env already exists
)

REM Configure Frontend .env  
echo [INFO] Setting up frontend environment...
if not exist "frontend\.env" (
    echo REACT_APP_BACKEND_URL=http://localhost:8001> frontend\.env
    echo WDS_SOCKET_PORT=0>> frontend\.env
    echo BROWSER=none>> frontend\.env
    echo [SUCCESS] Frontend .env created
) else (
    echo [INFO] Frontend .env already exists
)

echo.
echo [SUCCESS] Environment configuration completed!
echo.
echo Backend Configuration:
echo - Database: mongodb://localhost:27017/medipos_database
echo - CORS: Enabled for all origins
echo.
echo Frontend Configuration:
echo - Backend URL: http://localhost:8001
echo - Auto browser opening: Disabled
echo.

pause