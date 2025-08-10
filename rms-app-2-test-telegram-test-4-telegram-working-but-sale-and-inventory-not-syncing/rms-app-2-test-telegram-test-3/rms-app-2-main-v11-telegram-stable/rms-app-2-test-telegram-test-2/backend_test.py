#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import time

class MediPOSTelegramTester:
    def __init__(self, base_url="https://ec5969d5-e0ee-4bc9-b187-8ffecfca9511.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_credentials = {
            "bot_token": "8353928049:AAHonBxolfPQoIityJg1SRi-b_RMd0ag6_k",
            "chat_id": "1067208390"
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)

            print(f"   Status Code: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ PASSED - Expected {expected_status}, got {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:500]}...")
                    return True, response_data
                except:
                    print(f"   Response: {response.text[:200]}...")
                    return True, {}
            else:
                print(f"❌ FAILED - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except requests.exceptions.Timeout:
            print(f"❌ FAILED - Request timeout (30s)")
            return False, {}
        except Exception as e:
            print(f"❌ FAILED - Error: {str(e)}")
            return False, {}

    def test_get_telegram_settings(self):
        """Test GET /api/telegram/settings"""
        return self.run_test(
            "Get Telegram Settings",
            "GET",
            "telegram/settings",
            200
        )

    def test_update_telegram_settings(self):
        """Test PUT /api/telegram/settings - This was the main issue to fix"""
        settings_data = {
            "bot_token": self.test_credentials["bot_token"],
            "chat_id": self.test_credentials["chat_id"],
            "notifications_enabled": True,
            "low_stock_alerts_enabled": True,
            "expiry_alerts_enabled": True,
            "expired_alerts_enabled": True,
            "daily_reports_enabled": True,
            "daily_report_time": "18:00",
            "low_stock_check_time": "0 */4 * * *",
            "expiry_check_time": "0 9 * * *",
            "expired_check_time": "0 10 * * *",
            "timezone": "UTC"
        }
        
        return self.run_test(
            "Update Telegram Settings (Main Fix)",
            "PUT",
            "telegram/settings",
            200,
            data=settings_data
        )

    def test_telegram_connection(self):
        """Test POST /api/telegram/test"""
        test_data = {
            "bot_token": self.test_credentials["bot_token"],
            "chat_id": self.test_credentials["chat_id"],
            "message": "🧪 Test notification from MediPOS RMS - Backend Test Suite"
        }
        
        return self.run_test(
            "Test Telegram Connection",
            "POST",
            "telegram/test",
            200,
            data=test_data
        )

    def test_low_stock_check(self):
        """Test POST /api/telegram/check-low-stock"""
        return self.run_test(
            "Manual Low Stock Check",
            "POST",
            "telegram/check-low-stock",
            200
        )

    def test_expiring_medicines_check(self):
        """Test POST /api/telegram/check-expiring"""
        return self.run_test(
            "Manual Expiring Medicines Check",
            "POST",
            "telegram/check-expiring",
            200
        )

    def test_expired_medicines_check(self):
        """Test POST /api/telegram/check-expired"""
        return self.run_test(
            "Manual Expired Medicines Check",
            "POST",
            "telegram/check-expired",
            200
        )

    def test_daily_sales_report(self):
        """Test POST /api/telegram/send-daily-report"""
        report_data = {
            "date": datetime.now().strftime('%Y-%m-%d')
        }
        
        return self.run_test(
            "Manual Daily Sales Report",
            "POST",
            "telegram/send-daily-report",
            200,
            data=report_data
        )

    def test_notification_history(self):
        """Test GET /api/telegram/notification-history"""
        return self.run_test(
            "Get Notification History",
            "GET",
            "telegram/notification-history?limit=10",
            200
        )

    def test_basic_api_health(self):
        """Test basic API health"""
        return self.run_test(
            "API Health Check",
            "GET",
            "",
            200
        )

    def test_medicines_endpoint(self):
        """Test medicines endpoint to verify sample data"""
        return self.run_test(
            "Get Medicines (Sample Data Check)",
            "GET",
            "medicines",
            200
        )

def main():
    print("🚀 Starting MediPOS RMS Telegram Notification System Tests")
    print("=" * 70)
    
    tester = MediPOSTelegramTester()
    
    # Test sequence
    tests = [
        ("API Health Check", tester.test_basic_api_health),
        ("Get Medicines (Sample Data)", tester.test_medicines_endpoint),
        ("Get Telegram Settings", tester.test_get_telegram_settings),
        ("Update Telegram Settings (MAIN FIX)", tester.test_update_telegram_settings),
        ("Test Telegram Connection", tester.test_telegram_connection),
        ("Check Low Stock Alerts", tester.test_low_stock_check),
        ("Check Expiring Medicines", tester.test_expiring_medicines_check),
        ("Check Expired Medicines", tester.test_expired_medicines_check),
        ("Send Daily Sales Report", tester.test_daily_sales_report),
        ("Get Notification History", tester.test_notification_history),
    ]
    
    print(f"📋 Running {len(tests)} tests...")
    print(f"🔧 Test Credentials: Bot Token: {tester.test_credentials['bot_token'][:20]}..., Chat ID: {tester.test_credentials['chat_id']}")
    
    for test_name, test_func in tests:
        try:
            success, response = test_func()
            if not success:
                print(f"⚠️  Test '{test_name}' failed - continuing with remaining tests")
            time.sleep(1)  # Small delay between tests
        except Exception as e:
            print(f"💥 Test '{test_name}' crashed: {str(e)}")
            tester.tests_run += 1
    
    # Print final results
    print("\n" + "=" * 70)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 70)
    print(f"✅ Tests Passed: {tester.tests_passed}")
    print(f"❌ Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"📈 Total Tests: {tester.tests_run}")
    print(f"🎯 Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%" if tester.tests_run > 0 else "0%")
    
    if tester.tests_passed == tester.tests_run:
        print("\n🎉 ALL TESTS PASSED! Telegram notification system is working correctly.")
        return 0
    elif tester.tests_passed >= tester.tests_run * 0.7:
        print(f"\n⚠️  Most tests passed ({tester.tests_passed}/{tester.tests_run}). Some issues may need attention.")
        return 1
    else:
        print(f"\n🚨 MULTIPLE FAILURES ({tester.tests_passed}/{tester.tests_run} passed). System needs significant fixes.")
        return 2

if __name__ == "__main__":
    sys.exit(main())