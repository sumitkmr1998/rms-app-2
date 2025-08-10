@echo off
title MediPOS RMS - System Requirements Installer
color 0A

echo ==========================================
echo  MediPOS RMS - System Requirements Installer  
echo ==========================================
echo.
echo This script will help you install the required software.
echo Please run this as Administrator for best results.
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [INFO] Running as Administrator ✓
) else (
    echo [WARNING] Not running as Administrator
    echo [INFO] Some installations may fail without admin privileges
    echo.
)

echo Choose what to install:
echo.
echo [1] Install Chocolatey Package Manager (Recommended)
echo [2] Install Python 3.11
echo [3] Install Node.js LTS  
echo [4] Install MongoDB Community Edition
echo [5] Install Everything (1,2,3,4)
echo [0] Exit
echo.
set /p choice="Enter your choice (0-5): "

if "%choice%"=="0" exit /b 0
if "%choice%"=="1" goto install_choco
if "%choice%"=="2" goto install_python
if "%choice%"=="3" goto install_nodejs
if "%choice%"=="4" goto install_mongodb
if "%choice%"=="5" goto install_all

echo [ERROR] Invalid choice
pause
exit /b 1

:install_all
call :install_choco
call :install_python
call :install_nodejs  
call :install_mongodb
goto end

:install_choco
echo.
echo [INFO] Installing Chocolatey Package Manager...
powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))"
if %errorlevel% equ 0 (
    echo [SUCCESS] Chocolatey installed successfully!
    refreshenv
) else (
    echo [ERROR] Failed to install Chocolatey
)
echo.
goto end

:install_python
echo.
echo [INFO] Installing Python 3.11...
where choco >nul 2>&1
if %errorlevel% equ 0 (
    choco install python311 -y
) else (
    echo [INFO] Downloading Python installer...
    powershell -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.5/python-3.11.5-amd64.exe' -OutFile 'python-installer.exe'"
    echo [INFO] Running Python installer...
    python-installer.exe /quiet InstallAllUsers=1 PrependPath=1
    del python-installer.exe
)
echo [SUCCESS] Python installation completed!
echo.
goto end

:install_nodejs
echo.
echo [INFO] Installing Node.js LTS...
where choco >nul 2>&1  
if %errorlevel% equ 0 (
    choco install nodejs-lts -y
) else (
    echo [INFO] Downloading Node.js installer...
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v18.17.1/node-v18.17.1-x64.msi' -OutFile 'nodejs-installer.msi'"
    echo [INFO] Running Node.js installer...
    msiexec /i nodejs-installer.msi /quiet
    del nodejs-installer.msi
)
echo [SUCCESS] Node.js installation completed!
echo.
goto end

:install_mongodb
echo.
echo [INFO] Installing MongoDB Community Edition...
where choco >nul 2>&1
if %errorlevel% equ 0 (
    choco install mongodb -y
) else (
    echo [INFO] Please download and install MongoDB manually from:
    echo [INFO] https://www.mongodb.com/try/download/community
    echo [INFO] Choose Windows x64 MSI package
    start https://www.mongodb.com/try/download/community
)
echo [SUCCESS] MongoDB installation completed!
echo.
goto end

:end
echo.
echo [INFO] Installation process completed!
echo [INFO] Please restart your command prompt or computer to use the new software
echo [INFO] After restart, run setup.bat to configure the application
echo.
pause
exit /b 0