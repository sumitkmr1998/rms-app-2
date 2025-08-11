# =============================================================================
#  MediPOS Environment Setup Script
#
#  This script will automatically install Python and Node.js if they are
#  not found on the system. It requires Administrator privileges to run.
# =============================================================================

# --- Configuration ---
$pythonVersion = "3.11.5" # A specific, stable version of Python
$nodeVersion = "20.11.0"  # A specific, stable LTS version of Node.js

# --- Script Body ---

# 1. Check for Administrator Privileges
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Warning "This script needs to be run as an Administrator."
    Write-Host "Please right-click on this script and select 'Run with PowerShell as Administrator'."
    Read-Host -Prompt "Press Enter to exit"
    exit 1
}

Write-Host "Starting environment setup for MediPOS..." -ForegroundColor Green
Write-Host "This will install Python and Node.js if they are missing."
Write-Host "------------------------------------------------------------"

# Function to check for a command's existence
function Command-Exists {
    param($command)
    return (Get-Command $command -ErrorAction SilentlyContinue)
}

# 2. Check and Install Python
Write-Host "`nChecking for Python..." -ForegroundColor Cyan
if (Command-Exists python) {
    Write-Host "Python is already installed." -ForegroundColor Green
} else {
    Write-Host "Python not found. Starting installation..." -ForegroundColor Yellow
    $pythonInstallerUrl = "https://www.python.org/ftp/python/$pythonVersion/python-$pythonVersion-amd64.exe"
    $pythonInstallerPath = "$env:TEMP\python-installer.exe"

    try {
        Write-Host "Downloading Python installer..."
        Invoke-WebRequest -Uri $pythonInstallerUrl -OutFile $pythonInstallerPath
        
        Write-Host "Installing Python silently... (This may take a few minutes)"
        # Arguments for a silent install that adds Python to the system PATH
        $arguments = "/quiet InstallAllUsers=1 PrependPath=1"
        Start-Process -FilePath $pythonInstallerPath -ArgumentList $arguments -Wait -PassThru
        
        Write-Host "Python installation complete." -ForegroundColor Green
    } catch {
        Write-Error "Failed to download or install Python. Error: $_"
        Write-Error "Please install Python manually from python.org. Make sure to check 'Add Python to PATH'."
        Read-Host -Prompt "Press Enter to exit"
        exit 1
    } finally {
        if (Test-Path $pythonInstallerPath) { Remove-Item $pythonInstallerPath }
    }
}

# 3. Check and Install Node.js
Write-Host "`nChecking for Node.js..." -ForegroundColor Cyan
if (Command-Exists node) {
    Write-Host "Node.js is already installed." -ForegroundColor Green
} else {
    Write-Host "Node.js not found. Starting installation..." -ForegroundColor Yellow
    $nodeInstallerUrl = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-x64.msi"
    $nodeInstallerPath = "$env:TEMP\node-installer.msi"
    
    try {
        Write-Host "Downloading Node.js installer..."
        Invoke-WebRequest -Uri $nodeInstallerUrl -OutFile $nodeInstallerPath
        
        Write-Host "Installing Node.js silently... (This may take a few minutes)"
        # Arguments for a silent MSI install
        $arguments = "/i `"$nodeInstallerPath`" /qn /norestart"
        Start-Process msiexec.exe -ArgumentList $arguments -Wait -PassThru

        Write-Host "Node.js installation complete." -ForegroundColor Green
    } catch {
        Write-Error "Failed to download or install Node.js. Error: $_"
        Write-Error "Please install the LTS version of Node.js manually from nodejs.org."
        Read-Host -Prompt "Press Enter to exit"
        exit 1
    } finally {
        if (Test-Path $nodeInstallerPath) { Remove-Item $nodeInstallerPath }
    }
}

# 4. Final Confirmation
Write-Host "------------------------------------------------------------"
Write-Host "Setup complete! Both Python and Node.js should be installed and available." -ForegroundColor Green
Write-Host "You can now run 'start-medipos.bat' to launch the application."
Read-Host -Prompt "Press Enter to exit"