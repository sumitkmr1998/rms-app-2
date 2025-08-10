@echo off
title MediPOS RMS - Stop Services
color 0C

echo ==========================================
echo    MediPOS RMS - Stop All Services
echo ==========================================
echo.

echo [INFO] Stopping all MediPOS RMS services...

REM Kill Node.js processes (React frontend)
taskkill /f /im node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] Frontend server stopped
) else (
    echo [INFO] No frontend processes found
)

REM Kill Python processes (FastAPI backend)
taskkill /f /im python.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] Backend server stopped
) else (
    echo [INFO] No backend processes found
)

REM Kill MongoDB processes
taskkill /f /im mongod.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] MongoDB stopped
) else (
    echo [INFO] No MongoDB processes found
)

REM Close related command windows
taskkill /f /fi "WindowTitle eq MediPOS Backend*" >nul 2>&1
taskkill /f /fi "WindowTitle eq MediPOS Frontend*" >nul 2>&1
taskkill /f /fi "WindowTitle eq MongoDB*" >nul 2>&1

echo.
echo [SUCCESS] All services stopped!
echo.
pause