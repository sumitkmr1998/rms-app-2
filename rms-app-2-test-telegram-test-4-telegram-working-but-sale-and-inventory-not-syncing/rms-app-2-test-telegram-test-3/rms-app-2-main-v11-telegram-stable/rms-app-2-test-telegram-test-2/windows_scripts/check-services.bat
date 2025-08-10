@echo off
title MediPOS RMS - Service Status Checker
color 0E

echo ==========================================
echo    MediPOS RMS - Service Status Checker
echo ==========================================
echo.

echo [INFO] Checking service status...
echo.

REM Check MongoDB
echo [1/3] MongoDB Status:
netstat -an | find "27017" >nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] MongoDB is running on port 27017
) else (
    echo [✗] MongoDB is not running on port 27017
)

REM Check Backend API
echo.
echo [2/3] Backend API Status:
netstat -an | find "8001" >nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] Backend API is running on port 8001
    
    REM Test API endpoint
    echo [INFO] Testing API endpoint...
    powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://localhost:8001/api/telegram/settings' -Method Get -TimeoutSec 5; Write-Host '[✓] API endpoint responding correctly' -ForegroundColor Green } catch { Write-Host '[✗] API endpoint not responding' -ForegroundColor Red }"
) else (
    echo [✗] Backend API is not running on port 8001
)

REM Check Frontend
echo.
echo [3/3] Frontend Status:
netstat -an | find "3000" >nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] Frontend is running on port 3000
) else (
    echo [✗] Frontend is not running on port 3000
)

echo.
echo [INFO] Service URLs:
echo - Frontend: http://localhost:3000
echo - Backend:  http://localhost:8001
echo - API Docs: http://localhost:8001/docs
echo - MongoDB:  mongodb://localhost:27017
echo.

echo [INFO] Process Information:
echo.
echo Node.js processes (Frontend):
tasklist /fi "imagename eq node.exe" 2>nul | find "node.exe" || echo No Node.js processes found

echo.
echo Python processes (Backend):
tasklist /fi "imagename eq python.exe" 2>nul | find "python.exe" || echo No Python processes found

echo.
echo MongoDB processes:
tasklist /fi "imagename eq mongod.exe" 2>nul | find "mongod.exe" || echo No MongoDB processes found

echo.
pause