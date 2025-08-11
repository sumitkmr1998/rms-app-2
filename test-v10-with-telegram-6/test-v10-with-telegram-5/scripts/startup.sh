#!/bin/bash
# MediPOS System Startup Script with URL Refresh
# This script handles application startup and preview URL management

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="/app"
LOG_FILE="/app/scripts/logs/startup.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "========================================="
log "MediPOS System Startup Beginning"
log "========================================="

# Function to check if a service is running
check_service() {
    local service_name=$1
    if sudo supervisorctl status "$service_name" | grep -q "RUNNING"; then
        return 0
    else
        return 1
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local service_name=$1
    local port=$2
    local max_attempts=30
    local attempt=1
    
    log "Waiting for $service_name to be ready on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z localhost $port 2>/dev/null; then
            log "$service_name is ready!"
            return 0
        fi
        log "Attempt $attempt/$max_attempts: $service_name not ready yet..."
        sleep 2
        ((attempt++))
    done
    
    log "WARNING: $service_name did not become ready within expected time"
    return 1
}

# Step 1: Check and refresh preview URLs
log "Step 1: Checking preview URL status..."
cd "$SCRIPT_DIR"

if [ -f "refresh_preview_urls.py" ]; then
    log "Running URL refresh check..."
    python3 refresh_preview_urls.py --check-only
    
    # Check if refresh is needed and handle it
    log "Running URL refresh (if needed)..."
    python3 refresh_preview_urls.py
else
    log "WARNING: URL refresh script not found, continuing with existing URLs..."
fi

# Step 2: Install/Update Dependencies
log "Step 2: Installing dependencies..."

# Backend dependencies
log "Installing backend dependencies..."
cd "$APP_ROOT/backend"
if [ -f "requirements.txt" ]; then
    pip3 install -r requirements.txt --quiet
    log "Backend dependencies installed successfully"
else
    log "WARNING: Backend requirements.txt not found"
fi

# Frontend dependencies
log "Installing frontend dependencies..."
cd "$APP_ROOT/frontend"
if [ -f "package.json" ]; then
    # Use yarn if available, otherwise npm
    if command -v yarn &> /dev/null; then
        yarn install --silent
        log "Frontend dependencies installed with yarn"
    else
        npm install --silent
        log "Frontend dependencies installed with npm"
    fi
else
    log "WARNING: Frontend package.json not found"
fi

# Step 3: Database Setup
log "Step 3: Setting up database..."

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    log "Starting MongoDB..."
    sudo systemctl start mongod || log "WARNING: Could not start MongoDB service"
else
    log "MongoDB is already running"
fi

# Wait for MongoDB to be ready
wait_for_service "MongoDB" 27017

# Step 4: Start Services with Supervisor
log "Step 4: Starting application services..."

# Make sure supervisor is running
if ! pgrep -x "supervisord" > /dev/null; then
    log "Starting supervisord..."
    sudo supervisord -c /etc/supervisor/conf.d/supervisord.conf || true
fi

# Start backend service
log "Starting backend service..."
sudo supervisorctl start backend || log "Backend start command issued"

# Wait for backend to be ready
wait_for_service "backend" 8001

# Start frontend service
log "Starting frontend service..."
sudo supervisorctl start frontend || log "Frontend start command issued"

# Wait for frontend to be ready
wait_for_service "frontend" 3000

# Step 5: Health Checks
log "Step 5: Performing health checks..."

# Check backend health
backend_health=""
if curl -s http://localhost:8001/api/ > /dev/null 2>&1; then
    backend_health="✅ HEALTHY"
else
    backend_health="❌ UNHEALTHY"
fi

# Check frontend health
frontend_health=""
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    frontend_health="✅ HEALTHY"
else
    frontend_health="❌ UNHEALTHY"
fi

# Step 6: Display System Status
log "========================================="
log "MediPOS System Startup Complete"
log "========================================="
log "Backend Status: $backend_health"
log "Frontend Status: $frontend_health"

# Show current URLs
current_backend_url=$(grep "REACT_APP_BACKEND_URL" "$APP_ROOT/frontend/.env" 2>/dev/null | cut -d'=' -f2 || echo "Not found")
log "Backend URL: $current_backend_url"
log "Frontend URL: http://localhost:3000"

log "========================================="

# Step 7: Start URL monitoring daemon (optional)
if [ "$START_URL_DAEMON" = "true" ]; then
    log "Starting URL monitoring daemon..."
    cd "$SCRIPT_DIR"
    python3 refresh_preview_urls.py --daemon > /app/scripts/logs/url_daemon.log 2>&1 &
    echo $! > /app/scripts/logs/url_daemon.pid
    log "URL monitoring daemon started (PID: $(cat /app/scripts/logs/url_daemon.pid))"
fi

# Final status check
log "Services Status:"
sudo supervisorctl status | tee -a "$LOG_FILE"

log "Startup script completed at $(date)"

# Exit with success if both services are healthy
if [[ "$backend_health" == *"HEALTHY"* ]] && [[ "$frontend_health" == *"HEALTHY"* ]]; then
    log "✅ All systems operational!"
    exit 0
else
    log "⚠️  Some systems may need attention"
    exit 1
fi