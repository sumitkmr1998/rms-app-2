#!/bin/bash
# Installation script for MediPOS URL refresh system
# This script sets up the startup service and monitoring

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/app/scripts/logs/install.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "========================================="
log "Installing MediPOS URL Refresh System"
log "========================================="

# Make scripts executable
log "Setting script permissions..."
chmod +x "$SCRIPT_DIR"/*.sh
chmod +x "$SCRIPT_DIR"/*.py

# Install Python dependencies if needed
log "Installing Python dependencies..."
pip3 install requests urllib3 --quiet || log "WARNING: Could not install some Python packages"

# Create systemd service for startup
log "Creating systemd service..."
cat > /etc/systemd/system/medipos-startup.service << 'EOF'
[Unit]
Description=MediPOS System Startup with URL Refresh
After=network.target mongodb.service
Wants=mongodb.service

[Service]
Type=oneshot
ExecStart=/app/scripts/startup.sh
RemainAfterExit=yes
StandardOutput=journal
StandardError=journal
User=root
WorkingDirectory=/app/scripts

[Install]
WantedBy=multi-user.target
EOF

# Create systemd service for URL monitoring daemon
log "Creating URL monitor service..."
cat > /etc/systemd/system/medipos-url-monitor.service << 'EOF'
[Unit]
Description=MediPOS URL Monitor Daemon
After=network.target medipos-startup.service
Requires=medipos-startup.service

[Service]
Type=forking
ExecStart=/app/scripts/url_monitor.py
PIDFile=/app/scripts/logs/url_monitor.pid
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal
User=root
WorkingDirectory=/app/scripts

[Install]
WantedBy=multi-user.target
EOF

# Create supervisor configuration for the applications
log "Creating supervisor configuration..."
cat > /etc/supervisor/conf.d/medipos.conf << 'EOF'
[program:backend]
command=python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
directory=/app/backend
autostart=true
autorestart=true
stderr_logfile=/var/log/supervisor/backend.err.log
stdout_logfile=/var/log/supervisor/backend.out.log
environment=PATH="/usr/local/bin:/usr/bin:/bin",PYTHONPATH="/app/backend"

[program:frontend]
command=yarn start
directory=/app/frontend
autostart=true
autorestart=true
stderr_logfile=/var/log/supervisor/frontend.err.log
stdout_logfile=/var/log/supervisor/frontend.out.log
environment=PATH="/usr/local/bin:/usr/bin:/bin:/usr/local/share/.config/yarn/global/node_modules/.bin"

[group:medipos]
programs=backend,frontend
priority=999
EOF

# Reload systemd and enable services
log "Enabling systemd services..."
systemctl daemon-reload
systemctl enable medipos-startup.service
# Don't auto-enable the monitor service yet - let users decide
# systemctl enable medipos-url-monitor.service

# Update supervisor configuration
log "Updating supervisor configuration..."
supervisorctl reread || log "WARNING: Could not reload supervisor config"
supervisorctl update || log "WARNING: Could not update supervisor"

# Create helpful aliases
log "Creating helpful command aliases..."
cat > /app/scripts/aliases.sh << 'EOF'
#!/bin/bash
# Helpful aliases for MediPOS URL management

# Add these to your ~/.bashrc or ~/.bash_aliases:
alias medipos-startup='/app/scripts/startup.sh'
alias medipos-url-check='python3 /app/scripts/refresh_preview_urls.py --check-only'
alias medipos-url-refresh='python3 /app/scripts/refresh_preview_urls.py --force'
alias medipos-update-url='/app/scripts/manual_url_update.sh'
alias medipos-status='sudo supervisorctl status'
alias medipos-logs-backend='tail -f /var/log/supervisor/backend.out.log'
alias medipos-logs-frontend='tail -f /var/log/supervisor/frontend.out.log'
alias medipos-logs-startup='tail -f /app/scripts/logs/startup.log'
alias medipos-logs-url='tail -f /app/scripts/logs/url_refresh.log'

# Functions
medipos-restart() {
    echo "Restarting MediPOS services..."
    sudo supervisorctl restart backend frontend
}

medipos-start-monitor() {
    echo "Starting URL monitor daemon..."
    sudo systemctl start medipos-url-monitor
}

medipos-stop-monitor() {
    echo "Stopping URL monitor daemon..."
    sudo systemctl stop medipos-url-monitor
}
EOF

log "========================================="
log "Installation Complete!"
log "========================================="
log ""
log "To use the system:"
log "1. Manual URL update: /app/scripts/manual_url_update.sh <new_url>"
log "2. Check URL status: python3 /app/scripts/refresh_preview_urls.py --check-only"
log "3. Force URL refresh: python3 /app/scripts/refresh_preview_urls.py --force"
log "4. System startup: /app/scripts/startup.sh"
log "5. Start URL monitor: sudo systemctl start medipos-url-monitor"
log ""
log "Helpful aliases available in: /app/scripts/aliases.sh"
log "Add 'source /app/scripts/aliases.sh' to your ~/.bashrc to use them"
log ""
log "Services created:"
log "- medipos-startup.service (runs on boot)"
log "- medipos-url-monitor.service (continuous monitoring)"
log ""
log "Next steps:"
log "1. Test the startup script: /app/scripts/startup.sh"
log "2. When you get a new URL, use: /app/scripts/manual_url_update.sh <url>"
log "3. Optionally enable URL monitoring: sudo systemctl enable medipos-url-monitor"
log "========================================="

# Show current status
log "Current system status:"
sudo supervisorctl status || log "Supervisor not running"