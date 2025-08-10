# MediPOS RMS - Windows Installation & Setup Guide

## 🚀 Quick Start (For Advanced Users)

If you have Python, Node.js, and MongoDB already installed:

```batch
# 1. Clone/Extract the project
# 2. Open Command Prompt as Administrator
cd path\to\medipos-rms
cd windows_scripts

# 3. Run setup and start
setup.bat
start.bat
```

## 📋 Prerequisites

### Required Software:
- **Python 3.8+** with pip
- **Node.js 16+** with npm
- **MongoDB Community Edition 4.4+**
- **Git** (optional, for cloning)

### Optional but Recommended:
- **Windows Terminal** (better console experience)
- **Visual Studio Code** (for development)

## 🔧 Complete Installation Guide

### Step 1: Install System Requirements

**Option A: Automatic Installation (Recommended)**
```batch
# Run as Administrator
cd windows_scripts
install-system-requirements.bat
```

**Option B: Manual Installation**

1. **Install Python 3.11:**
   - Download from [python.org](https://python.org/downloads/windows/)
   - ✅ Check "Add Python to PATH" during installation
   - ✅ Check "Install pip"

2. **Install Node.js LTS:**
   - Download from [nodejs.org](https://nodejs.org/en/download/)
   - This automatically installs npm

3. **Install MongoDB Community Edition:**
   - Download from [MongoDB Download Center](https://www.mongodb.com/try/download/community)
   - Choose Windows MSI package
   - During installation, select "Install MongoDB as a Service"

4. **Verify installations:**
   ```batch
   python --version
   node --version
   npm --version
   mongod --version
   ```

### Step 2: Configure Environment

```batch
cd windows_scripts
configure-env.bat
```

### Step 3: Setup Dependencies

```batch
setup.bat
```

This will:
- Create Python virtual environment
- Install all Python packages
- Install all Node.js packages
- Configure the application

### Step 4: Start the Application

```batch
start.bat
```

## 🎯 Available Commands

### Basic Operations
- `setup.bat` - Initial setup and dependency installation
- `start.bat` - Start all services (Production mode)
- `stop.bat` - Stop all services
- `check-services.bat` - Check service status

### Development Mode
- `dev-start.bat` - Start with hot-reload enabled
- `start-mongodb-only.bat` - Start only MongoDB

### Configuration
- `configure-env.bat` - Set up environment variables
- `install-system-requirements.bat` - Install Python, Node.js, MongoDB

## 🌐 Application URLs

After starting the application:

- **Main Application:** http://localhost:3000
- **API Documentation:** http://localhost:8001/docs
- **Backend API:** http://localhost:8001/api/
- **MongoDB:** mongodb://localhost:27017

## 📱 Telegram Notifications Setup

1. **Access the Telegram Settings:**
   - Open http://localhost:3000
   - Click on "Notifications" in the top navigation
   - Go to the "Settings" tab

2. **Configure Telegram Bot:**
   - Get Bot Token from @BotFather on Telegram
   - Get your Chat ID
   - Enter both in the settings form
   - Click "Save Settings"

3. **Test the Connection:**
   - Go to "Testing" tab
   - Click "Test Connection"
   - Check your Telegram for the test message

## 🔧 Troubleshooting

### Common Issues:

**1. "Python is not recognized"**
```batch
# Add Python to PATH manually:
set PATH=%PATH%;C:\Python311;C:\Python311\Scripts
```

**2. "Node is not recognized"**
```batch
# Add Node.js to PATH manually:
set PATH=%PATH%;C:\Program Files\nodejs
```

**3. "MongoDB connection failed"**
```batch
# Start MongoDB manually:
start-mongodb-only.bat
# Or install as Windows Service during MongoDB installation
```

**4. "Port already in use"**
```batch
# Kill existing processes:
stop.bat
# Or manually:
taskkill /f /im python.exe
taskkill /f /im node.exe
taskkill /f /im mongod.exe
```

**5. "Permission denied errors"**
- Run Command Prompt as Administrator
- Check Windows Firewall settings
- Temporarily disable antivirus for installation

### Service Status Check:
```batch
check-services.bat
```

### Reset Everything:
```batch
stop.bat
# Delete node_modules and venv folders
setup.bat
start.bat
```

## 🏗️ Development Setup

For developers who want to modify the code:

```batch
# Use development mode with hot-reload
dev-start.bat
```

This starts:
- Backend with auto-reload on code changes
- Frontend with hot-reload
- MongoDB in background

### File Structure:
```
medipos-rms/
├── backend/          # FastAPI Python backend
├── frontend/         # React.js frontend
├── windows_scripts/  # Windows batch scripts
├── data/            # MongoDB data directory (auto-created)
├── venv/            # Python virtual environment (auto-created)
└── README_WINDOWS.md
```

## 🔒 Security Notes

- **Development Mode:** The app runs on localhost only
- **Database:** No authentication enabled by default
- **API:** CORS enabled for all origins in development
- **Production:** Additional security configuration needed

## 📞 Support

If you encounter issues:

1. Check service status: `check-services.bat`
2. Review logs in the individual command windows
3. Ensure all prerequisites are installed
4. Try running Command Prompt as Administrator
5. Check Windows Firewall settings

## 🎉 Success!

When everything is working:
- ✅ All services show "RUNNING" in check-services.bat
- ✅ Frontend loads at http://localhost:3000
- ✅ API responds at http://localhost:8001/docs
- ✅ Telegram notifications can be configured and tested

Your MediPOS RMS application is now ready to use on Windows!