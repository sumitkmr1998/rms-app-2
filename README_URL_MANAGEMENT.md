# MediPOS URL Management System

This system handles automatic refresh of external preview URLs for the MediPOS pharmacy management system on the Emergent Agent Platform.

## Overview

The system consists of several components:
- **URL refresh scripts** - Monitor and update preview URLs
- **Startup scripts** - Handle system initialization with URL checks
- **Monitoring daemon** - Continuous URL health monitoring
- **Manual update tools** - For when you get new URLs from the platform

## Quick Start

### 1. Initial Setup
```bash
# Install the system
sudo /app/scripts/install_startup_service.sh

# Test the startup process
/app/scripts/startup.sh
```

### 2. When You Get a New Preview URL
```bash
# Update with new URL from Emergent Agent Platform
/app/scripts/manual_url_update.sh https://your-new-id.preview.emergentagent.com
```

### 3. Check URL Status
```bash
# Check if current URL is working
python3 /app/scripts/refresh_preview_urls.py --check-only

# Force a refresh check
python3 /app/scripts/refresh_preview_urls.py --force
```

## Components

### Core Scripts

#### `/app/scripts/refresh_preview_urls.py`
Main URL management script with capabilities:
- Check URL health and expiration
- Update frontend .env configuration
- Restart services after URL changes
- Log all activities

Usage:
```bash
python3 refresh_preview_urls.py [options]

Options:
  --force              Force refresh even if URL seems valid
  --check-only         Only check URL status, don't refresh
  --apply-manual-url   Apply a manually obtained URL
  --daemon            Run in continuous monitoring mode
```

#### `/app/scripts/startup.sh`
Complete system startup script that:
- Checks and refreshes URLs if needed
- Installs/updates dependencies
- Starts database services
- Launches backend and frontend
- Performs health checks
- Displays system status

#### `/app/scripts/manual_url_update.sh`
Interactive script for applying new URLs:
- Validates URL format
- Tests URL accessibility
- Updates configuration
- Restarts services
- Verifies system health

#### `/app/scripts/url_monitor.py`
Background daemon for continuous monitoring:
- Periodic URL health checks
- Automatic refresh when URLs expire
- Graceful shutdown handling
- PID file management

### Configuration

#### `/app/scripts/config/url_config.json`
Main configuration file (auto-generated):
```json
{
  "check_interval_minutes": 30,
  "refresh_threshold_hours": 12,
  "backend_internal_port": 8001,
  "frontend_internal_port": 3000,
  "manual_override_url": null
}
```

## System Services

### Systemd Services
- `medipos-startup.service` - Runs startup script on boot
- `medipos-url-monitor.service` - Continuous URL monitoring

### Supervisor Programs
- `backend` - FastAPI backend server
- `frontend` - React development server

## Usage Scenarios

### Scenario 1: Fresh System Start
```bash
# Start everything
/app/scripts/startup.sh
```

### Scenario 2: URL Expired
```bash
# Check if URL is expired
python3 /app/scripts/refresh_preview_urls.py --check-only

# If expired, get new URL from Emergent Agent Platform and apply:
/app/scripts/manual_url_update.sh https://new-id.preview.emergentagent.com
```

### Scenario 3: Continuous Monitoring
```bash
# Start monitoring daemon
sudo systemctl start medipos-url-monitor

# Check daemon status
sudo systemctl status medipos-url-monitor

# View daemon logs
journalctl -u medipos-url-monitor -f
```

### Scenario 4: Development Mode
```bash
# Check URL without changes
python3 /app/scripts/refresh_preview_urls.py --check-only

# Manual service restart
sudo supervisorctl restart backend frontend
```

## Logs and Troubleshooting

### Log Files
- `/app/scripts/logs/startup.log` - System startup logs
- `/app/scripts/logs/url_refresh.log` - URL management logs
- `/app/scripts/logs/url_monitor.log` - Monitoring daemon logs
- `/var/log/supervisor/backend.*.log` - Backend service logs
- `/var/log/supervisor/frontend.*.log` - Frontend service logs

### Common Issues

#### URL Not Accessible
```bash
# Check current URL status
python3 /app/scripts/refresh_preview_urls.py --check-only

# Apply new URL if needed
/app/scripts/manual_url_update.sh <new_url>
```

#### Services Not Starting
```bash
# Check supervisor status
sudo supervisorctl status

# Restart specific service
sudo supervisorctl restart backend
sudo supervisorctl restart frontend

# View service logs
tail -f /var/log/supervisor/backend.err.log
```

#### Configuration Issues
```bash
# Check current configuration
cat /app/frontend/.env
cat /app/scripts/config/url_config.json

# Reset configuration
rm /app/scripts/config/url_config.json
python3 /app/scripts/refresh_preview_urls.py --check-only
```

## Manual Process (When API is Unavailable)

Since API keys are not available for automatic URL generation:

1. **Monitor URL expiration**:
   ```bash
   python3 /app/scripts/refresh_preview_urls.py --check-only
   ```

2. **When URL expires**:
   - Go to Emergent Agent Platform dashboard
   - Navigate to your MediPOS project
   - Generate/refresh the preview URL
   - Copy the new URL

3. **Apply new URL**:
   ```bash
   /app/scripts/manual_url_update.sh https://new-url.preview.emergentagent.com
   ```

4. **Verify system**:
   ```bash
   /app/scripts/startup.sh
   ```

## Helpful Aliases

Add to your `~/.bashrc`:
```bash
source /app/scripts/aliases.sh
```

This provides shortcuts like:
- `medipos-startup` - Run startup script
- `medipos-url-check` - Check URL status
- `medipos-update-url` - Update URL interactively
- `medipos-status` - Show service status
- `medipos-restart` - Restart all services

## Integration with Existing Workflow

The system integrates seamlessly with your existing MediPOS application:
- No changes to application code required
- Preserves all existing functionality
- Works with supervisor service management
- Compatible with existing database setup

## Monitoring and Alerts

Enable continuous monitoring:
```bash
# Enable URL monitoring service
sudo systemctl enable medipos-url-monitor
sudo systemctl start medipos-url-monitor

# Check monitoring logs
tail -f /app/scripts/logs/url_monitor.log
```

The system will:
- Check URLs every 30 minutes (configurable)
- Log all status changes
- Attempt automatic refresh when possible
- Alert when manual intervention is needed

## Security Considerations

- Scripts run with appropriate permissions
- URLs are validated before application
- Logs contain no sensitive information
- Configuration files are protected
- Services restart gracefully

## Future Enhancements

When API access becomes available:
- Automatic URL generation
- Seamless refresh without manual intervention
- Enhanced monitoring with notifications
- Backup URL strategies