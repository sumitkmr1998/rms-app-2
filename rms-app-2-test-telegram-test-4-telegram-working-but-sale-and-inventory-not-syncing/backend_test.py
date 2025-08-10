#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class TelegramAPITester:
    def __init__(self, base_url="https://52c2f98c-7f7b-4ec2-bc3c-1bdac16e13bd.preview.emergentagent.com"):
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
        print(f"   Method: {method}")
        if data:
            print(f"   Data: {json.dumps(data, indent=2)}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            print(f"   Status Code: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ PASSED - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)}")
                    return True, response_data
                except:
                    print(f"   Response: {response.text}")
                    return True, {}
            else:
                print(f"❌ FAILED - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error Response: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ FAILED - Exception: {str(e)}")
            return False, {}

    def test_get_telegram_settings(self):
        """Test getting current Telegram settings"""
        return self.run_test(
            "Get Telegram Settings",
            "GET",
            "telegram/settings",
            200
        )

    def test_update_telegram_settings(self):
        """Test updating Telegram settings with real credentials"""
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
            "Update Telegram Settings",
            "PUT",
            "telegram/settings",
            200,
            data=settings_data
        )

    def test_telegram_connection(self):
        """Test Telegram bot connection"""
        test_data = {
            "bot_token": self.test_credentials["bot_token"],
            "chat_id": self.test_credentials["chat_id"],
            "message": "🧪 Test notification from MediPOS RMS Backend Test"
        }
        
        return self.run_test(
            "Test Telegram Connection",
            "POST",
            "telegram/test",
            200,
            data=test_data
        )

    def test_basic_endpoints(self):
        """Test basic API endpoints"""
        endpoints = [
            ("Root API", "GET", "", 200),
            ("Get Medicines", "GET", "medicines", 200),
            ("Get Sales", "GET", "sales", 200),
        ]
        
        results = []
        for name, method, endpoint, expected_status in endpoints:
            success, data = self.run_test(name, method, endpoint, expected_status)
            results.append((name, success))
        
        return results

    def test_notification_history(self):
        """Test notification history endpoint"""
        return self.run_test(
            "Get Notification History",
            "GET",
            "telegram/notification-history",
            200
        )

def main():
    print("=" * 60)
    print("🧪 MediPOS RMS - Telegram API Backend Tests")
    print("=" * 60)
    print(f"🕒 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    # Setup
    tester = TelegramAPITester()
    
    print("🔧 Test Configuration:")
    print(f"   Base URL: {tester.base_url}")
    print(f"   Bot Token: {tester.test_credentials['bot_token'][:20]}...")
    print(f"   Chat ID: {tester.test_credentials['chat_id']}")
    print()

    # Run basic API tests first
    print("📋 Testing Basic API Endpoints...")
    basic_results = tester.test_basic_endpoints()
    
    # Test Telegram-specific endpoints
    print("\n📱 Testing Telegram Notification Endpoints...")
    
    # Test 1: Get current settings
    get_success, get_data = tester.test_get_telegram_settings()
    
    # Test 2: Update settings with real credentials
    update_success, update_data = tester.test_update_telegram_settings()
    
    # Test 3: Test connection (this will send actual Telegram message)
    connection_success, connection_data = tester.test_telegram_connection()
    
    # Test 4: Get notification history
    history_success, history_data = tester.test_notification_history()

    # Print final results
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    print(f"✅ Tests Passed: {tester.tests_passed}")
    print(f"❌ Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"📊 Total Tests: {tester.tests_run}")
    print(f"🎯 Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    print("\n🔍 Detailed Results:")
    for name, success in basic_results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"   {status} - {name}")
    
    telegram_tests = [
        ("Get Telegram Settings", get_success),
        ("Update Telegram Settings", update_success),
        ("Test Telegram Connection", connection_success),
        ("Get Notification History", history_success)
    ]
    
    for name, success in telegram_tests:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"   {status} - {name}")

    print(f"\n🕒 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Return appropriate exit code
    if tester.tests_passed == tester.tests_run:
        print("\n🎉 ALL TESTS PASSED! Backend API is working correctly.")
        return 0
    else:
        print(f"\n⚠️  {tester.tests_run - tester.tests_passed} TEST(S) FAILED! Check the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())