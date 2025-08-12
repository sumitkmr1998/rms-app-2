#!/bin/bash
# Manual URL Update Script for MediPOS System
# Use this script when you have obtained a new preview URL from Emergent Agent Platform

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/app/scripts/logs/manual_update.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to validate URL format
validate_url() {
    local url=$1
    if [[ $url =~ ^https://[a-f0-9\-]+\.preview\.emergentagent\.com$ ]]; then
        return 0
    else
        return 1
    fi
}

# Main function
main() {
    log "========================================="
    log "Manual URL Update Script Started"
    log "========================================="
    
    # Check if URL is provided as argument
    if [ $# -eq 0 ]; then
        echo "Usage: $0 <new_preview_url>"
        echo "Example: $0 https://medreg-system.preview.emergentagent.com"
        echo ""
        echo "To get a new preview URL:"
        echo "1. Go to your Emergent Agent Platform dashboard"
        echo "2. Navigate to your application/project"
        echo "3. Generate/refresh the preview URL"
        echo "4. Copy the new URL and run this script with it"
        exit 1
    fi
    
    NEW_URL=$1
    
    # Validate URL format
    if ! validate_url "$NEW_URL"; then
        log "ERROR: Invalid URL format"
        log "Expected format: https://medreg-system.preview.emergentagent.com"
        log "Provided URL: $NEW_URL"
        exit 1
    fi
    
    log "New URL provided: $NEW_URL"
    log "Validating URL accessibility..."
    
    # Test if the new URL is accessible (with timeout)
    if timeout 10 curl -s "$NEW_URL" > /dev/null 2>&1; then
        log "✅ URL is accessible"
    else
        log "⚠️  WARNING: URL is not immediately accessible (this might be normal for new URLs)"
        read -p "Do you want to continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "Update cancelled by user"
            exit 1
        fi
    fi
    
    # Show current configuration
    current_url=$(grep "REACT_APP_BACKEND_URL" /app/frontend/.env 2>/dev/null | cut -d'=' -f2 || echo "Not found")
    log "Current backend URL: $current_url"
    log "New backend URL: $NEW_URL"
    
    # Confirm with user
    echo
    echo "This will update the frontend configuration and restart services."
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Update cancelled by user"
        exit 1
    fi
    
    # Apply the new URL using the Python script
    log "Applying new URL..."
    cd "$SCRIPT_DIR"
    
    if python3 refresh_preview_urls.py --apply-manual-url "$NEW_URL"; then
        log "✅ URL update completed successfully"
        
        # Wait a moment for services to start
        log "Waiting for services to stabilize..."
        sleep 10
        
        # Perform health checks
        log "Performing health checks..."
        
        backend_health="❌ UNHEALTHY"
        if timeout 10 curl -s http://localhost:8001/api/ > /dev/null 2>&1; then
            backend_health="✅ HEALTHY"
        fi
        
        frontend_health="❌ UNHEALTHY"
        if timeout 10 curl -s http://localhost:3000 > /dev/null 2>&1; then
            frontend_health="✅ HEALTHY"
        fi
        
        log "========================================="
        log "Update Results:"
        log "========================================="
        log "Backend Status: $backend_health"
        log "Frontend Status: $frontend_health"
        log "New Backend URL: $NEW_URL"
        log "Frontend URL: http://localhost:3000"
        log "========================================="
        
        if [[ "$backend_health" == *"HEALTHY"* ]] && [[ "$frontend_health" == *"HEALTHY"* ]]; then
            log "✅ All systems operational with new URL!"
            exit 0
        else
            log "⚠️  Some systems may need attention"
            log "You may need to wait a bit longer for services to fully start"
            exit 1
        fi
        
    else
        log "❌ URL update failed"
        exit 1
    fi
}

# Run main function with all arguments
main "$@"