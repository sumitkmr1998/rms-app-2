#!/usr/bin/env python3
"""
Continuous URL monitoring service for MediPOS system
Monitors preview URLs and refreshes them when they expire
"""

import time
import signal
import sys
import os
import json
from pathlib import Path
from refresh_preview_urls import PreviewURLManager
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/scripts/logs/url_monitor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class URLMonitorDaemon:
    def __init__(self):
        self.url_manager = PreviewURLManager()
        self.running = True
        self.pid_file = Path('/app/scripts/logs/url_monitor.pid')
        
        # Register signal handlers
        signal.signal(signal.SIGTERM, self.signal_handler)
        signal.signal(signal.SIGINT, self.signal_handler)
    
    def signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        self.running = False
    
    def write_pid_file(self):
        """Write process ID to file"""
        try:
            with open(self.pid_file, 'w') as f:
                f.write(str(os.getpid()))
            logger.info(f"PID file created: {self.pid_file}")
        except Exception as e:
            logger.error(f"Could not create PID file: {e}")
    
    def remove_pid_file(self):
        """Remove PID file on shutdown"""
        try:
            if self.pid_file.exists():
                self.pid_file.unlink()
                logger.info("PID file removed")
        except Exception as e:
            logger.error(f"Could not remove PID file: {e}")
    
    def run(self):
        """Main daemon loop"""
        logger.info("URL Monitor Daemon starting...")
        self.write_pid_file()
        
        try:
            while self.running:
                try:
                    # Check and refresh URLs if needed
                    self.url_manager.check_and_refresh_urls()
                    
                    # Get check interval from config
                    interval = self.url_manager.config.get('check_interval_minutes', 30)
                    
                    # Sleep in smaller intervals to allow for responsive shutdown
                    sleep_remaining = interval * 60
                    while sleep_remaining > 0 and self.running:
                        sleep_time = min(10, sleep_remaining)  # Sleep in 10-second intervals
                        time.sleep(sleep_time)
                        sleep_remaining -= sleep_time
                    
                except Exception as e:
                    logger.error(f"Error in monitoring loop: {e}")
                    if self.running:
                        logger.info("Continuing after error... (waiting 60 seconds)")
                        time.sleep(60)
        
        except KeyboardInterrupt:
            logger.info("Daemon stopped by keyboard interrupt")
        
        finally:
            self.remove_pid_file()
            logger.info("URL Monitor Daemon stopped")

def main():
    daemon = URLMonitorDaemon()
    daemon.run()

if __name__ == "__main__":
    main()