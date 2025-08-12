#!/bin/bash
# Demo script to show how the URL update system works

echo "=================================================="
echo "MediPOS URL Management System - Demo"
echo "=================================================="
echo ""

echo "1. Current system status:"
echo "   Backend URL: $(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d'=' -f2)"
echo "   Backend Status: $(curl -s http://localhost:8001/api/ | jq -r '.message' 2>/dev/null || echo 'Not responding')"
echo ""

echo "2. Checking URL status:"
cd /app/scripts
python3 refresh_preview_urls.py --check-only
echo ""

echo "3. Current configuration:"
if [ -f "/app/scripts/config/url_config.json" ]; then
    echo "   Configuration file exists:"
    cat /app/scripts/config/url_config.json | head -10
else
    echo "   Configuration file will be created on first run"
fi
echo ""

echo "4. Available commands:"
echo "   - Check URL status: python3 /app/scripts/refresh_preview_urls.py --check-only"
echo "   - Update URL manually: /app/scripts/manual_url_update.sh <new_url>"
echo "   - Force refresh check: python3 /app/scripts/refresh_preview_urls.py --force"
echo "   - System startup: /app/scripts/startup.sh"
echo ""

echo "5. When you get a new URL from Emergent Agent Platform:"
echo "   Example: /app/scripts/manual_url_update.sh https://medreg-system.preview.emergentagent.com"
echo ""

echo "=================================================="
echo "Demo complete - System is ready for URL management"
echo "=================================================="