#!/usr/bin/env python3
"""
Emergent Agent Platform Preview URL Refresh Script
Handles automatic refresh of external preview URLs for MediPOS system
"""

import os
import re
import json
import time
import requests
import subprocess
import logging
from datetime import datetime, timedelta
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/scripts/logs/url_refresh.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class PreviewURLManager:
    def __init__(self):
        self.app_root = Path('/app')
        self.frontend_env_path = self.app_root / 'frontend' / '.env'
        self.backend_env_path = self.app_root / 'backend' / '.env'
        self.config_path = self.app_root / 'scripts' / 'config' / 'url_config.json'
        
        # Create necessary directories
        os.makedirs(self.config_path.parent, exist_ok=True)
        os.makedirs('/app/scripts/logs', exist_ok=True)
        
        # Load configuration
        self.config = self.load_config()
    
    def load_config(self):
        """Load URL refresh configuration"""
        default_config = {
            "check_interval_minutes": 30,
            "url_pattern": r"https://[a-f0-9\-]+\.preview\.emergentagent\.com",
            "last_refresh": None,
            "refresh_threshold_hours": 12,
            "backend_internal_port": 8001,
            "frontend_internal_port": 3000,
            "fallback_urls": {
                "backend": "http://localhost:8001",
                "frontend": "http://localhost:3000"
            }
        }
        
        if self.config_path.exists():
            try:
                with open(self.config_path, 'r') as f:
                    config = json.load(f)
                    # Merge with defaults
                    for key, value in default_config.items():
                        if key not in config:
                            config[key] = value
                    return config
            except Exception as e:
                logger.error(f"Error loading config: {e}")
        
        return default_config
    
    def save_config(self):
        """Save current configuration"""
        try:
            with open(self.config_path, 'w') as f:
                json.dump(self.config, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error saving config: {e}")
    
    def is_url_expired(self, url):
        """Check if a preview URL is expired or invalid"""
        try:
            response = requests.get(f"{url}/api/", timeout=10)
            return response.status_code != 200
        except Exception as e:
            logger.warning(f"URL check failed for {url}: {e}")
            return True
    
    def get_current_backend_url(self):
        """Extract current backend URL from frontend .env"""
        try:
            if self.frontend_env_path.exists():
                content = self.frontend_env_path.read_text()
                match = re.search(r'REACT_APP_BACKEND_URL=(.+)', content)
                if match:
                    return match.group(1).strip()
        except Exception as e:
            logger.error(f"Error reading frontend .env: {e}")
        return None
    
    def generate_new_preview_url(self):
        """
        Generate new preview URL from Emergent Agent Platform
        
        Note: This is a placeholder implementation since no API keys are available.
        In practice, this would need to:
        1. Call the Emergent Agent Platform API
        2. Request a new preview URL
        3. Return the generated URL
        
        For now, this will generate a mock URL structure and log instructions
        for manual intervention.
        """
        logger.warning("API keys not available - manual intervention required")
        
        # Generate a placeholder URL with current timestamp for identification
        timestamp = int(time.time())
        mock_uuid = f"temp-{timestamp}-needs-real-url"
        
        # This would be replaced with actual API call
        new_url = f"https://medreg-system.preview.emergentagent.com"
        
        logger.info("=" * 60)
        logger.info("MANUAL ACTION REQUIRED:")
        logger.info("=" * 60)
        logger.info("1. Go to your Emergent Agent Platform dashboard")
        logger.info("2. Generate a new preview URL for this application")
        logger.info("3. Replace the URL in the configuration file:")
        logger.info(f"   File: {self.config_path}")
        logger.info(f"   Update 'manual_override_url' with the new URL")
        logger.info("4. Run this script again with --apply-manual-url flag")
        logger.info("=" * 60)
        
        return None  # Return None to indicate manual intervention needed
    
    def update_frontend_env(self, new_backend_url):
        """Update frontend .env file with new backend URL"""
        try:
            if self.frontend_env_path.exists():
                content = self.frontend_env_path.read_text()
                
                # Update REACT_APP_BACKEND_URL
                pattern = r'(REACT_APP_BACKEND_URL=)(.+)'
                replacement = f'\\1{new_backend_url}'
                updated_content = re.sub(pattern, replacement, content)
                
                # If pattern not found, add it
                if not re.search(pattern, content):
                    updated_content += f'\nREACT_APP_BACKEND_URL={new_backend_url}\n'
                
                self.frontend_env_path.write_text(updated_content)
                logger.info(f"Updated frontend .env with URL: {new_backend_url}")
                return True
            else:
                # Create new .env file
                env_content = f"""REACT_APP_BACKEND_URL={new_backend_url}
WDS_SOCKET_PORT=443
"""
                self.frontend_env_path.write_text(env_content)
                logger.info(f"Created frontend .env with URL: {new_backend_url}")
                return True
                
        except Exception as e:
            logger.error(f"Error updating frontend .env: {e}")
            return False
    
    def restart_services(self):
        """Restart frontend and backend services"""
        try:
            logger.info("Restarting services...")
            
            # Restart backend
            result = subprocess.run(['sudo', 'supervisorctl', 'restart', 'backend'], 
                                 capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                logger.info("Backend restarted successfully")
            else:
                logger.error(f"Backend restart failed: {result.stderr}")
            
            # Wait a moment
            time.sleep(2)
            
            # Restart frontend
            result = subprocess.run(['sudo', 'supervisorctl', 'restart', 'frontend'], 
                                 capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                logger.info("Frontend restarted successfully")
            else:
                logger.error(f"Frontend restart failed: {result.stderr}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error restarting services: {e}")
            return False
    
    def check_and_refresh_urls(self, force_refresh=False):
        """Main method to check and refresh URLs if needed"""
        logger.info("Starting URL refresh check...")
        
        current_url = self.get_current_backend_url()
        if not current_url:
            logger.error("Could not find current backend URL")
            return False
        
        logger.info(f"Current backend URL: {current_url}")
        
        # Check if manual override is available
        manual_url = self.config.get('manual_override_url')
        if manual_url and manual_url != current_url:
            logger.info(f"Applying manual override URL: {manual_url}")
            if self.update_frontend_env(manual_url):
                self.restart_services()
                self.config['last_refresh'] = datetime.now().isoformat()
                self.config['manual_override_url'] = None  # Clear after use
                self.save_config()
                return True
        
        # Check if current URL is expired or if force refresh is requested
        needs_refresh = force_refresh or self.is_url_expired(current_url)
        
        if not needs_refresh:
            # Check time-based refresh
            last_refresh = self.config.get('last_refresh')
            if last_refresh:
                last_refresh_time = datetime.fromisoformat(last_refresh)
                threshold = timedelta(hours=self.config.get('refresh_threshold_hours', 12))
                needs_refresh = datetime.now() - last_refresh_time > threshold
        
        if needs_refresh:
            logger.info("URL refresh needed")
            
            # Try to generate new URL (this will require manual intervention)
            new_url = self.generate_new_preview_url()
            
            if new_url:
                # This branch would execute if API integration was available
                if self.update_frontend_env(new_url):
                    self.restart_services()
                    self.config['last_refresh'] = datetime.now().isoformat()
                    self.save_config()
                    logger.info("URL refresh completed successfully")
                    return True
            else:
                logger.info("Manual intervention required - check logs for instructions")
                return False
        else:
            logger.info("URL is still valid, no refresh needed")
            return True
        
        return False
    
    def apply_manual_url(self, manual_url):
        """Apply a manually provided URL"""
        logger.info(f"Applying manual URL: {manual_url}")
        
        if self.update_frontend_env(manual_url):
            self.restart_services()
            self.config['last_refresh'] = datetime.now().isoformat()
            self.save_config()
            logger.info("Manual URL applied successfully")
            return True
        
        return False

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Refresh Emergent Agent Platform preview URLs')
    parser.add_argument('--force', action='store_true', help='Force refresh even if URL seems valid')
    parser.add_argument('--check-only', action='store_true', help='Only check URL status, do not refresh')
    parser.add_argument('--apply-manual-url', type=str, help='Apply a manually obtained URL')
    parser.add_argument('--daemon', action='store_true', help='Run in daemon mode (continuous monitoring)')
    
    args = parser.parse_args()
    
    url_manager = PreviewURLManager()
    
    if args.apply_manual_url:
        url_manager.apply_manual_url(args.apply_manual_url)
    elif args.check_only:
        current_url = url_manager.get_current_backend_url()
        if current_url:
            is_expired = url_manager.is_url_expired(current_url)
            logger.info(f"URL Status: {'EXPIRED' if is_expired else 'VALID'}")
        else:
            logger.error("No URL found to check")
    elif args.daemon:
        logger.info("Starting daemon mode...")
        while True:
            try:
                url_manager.check_and_refresh_urls()
                interval = url_manager.config.get('check_interval_minutes', 30)
                logger.info(f"Sleeping for {interval} minutes...")
                time.sleep(interval * 60)
            except KeyboardInterrupt:
                logger.info("Daemon stopped by user")
                break
            except Exception as e:
                logger.error(f"Error in daemon mode: {e}")
                time.sleep(60)  # Wait 1 minute before retrying
    else:
        url_manager.check_and_refresh_urls(force_refresh=args.force)

if __name__ == "__main__":
    main()