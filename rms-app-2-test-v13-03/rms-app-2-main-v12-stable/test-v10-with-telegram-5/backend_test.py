#!/usr/bin/env python3
"""
MediPOS Backend API Testing Suite
Tests all backend endpoints and functionality
"""

import requests
import sys
import json
from datetime import datetime
import uuid
import os

class MediPOSAPITester:
    def __init__(self, base_url="https://032a89b3-6988-4f45-9ef0-f2fe91e9bf8f.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details="", response_data=None):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details,
            "response_data": response_data
        })

    def run_test(self, name, method, endpoint, expected_status=200, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        try:
            print(f"\n🔍 Testing {name}...")
            print(f"   URL: {url}")
            
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                self.log_test(name, False, f"Unsupported method: {method}")
                return False, {}

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
                if success:
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
            except:
                response_data = {"raw_response": response.text[:200]}
                if success:
                    print(f"   Response: {response.text[:200]}...")

            if success:
                self.log_test(name, True, f"Status {response.status_code}", response_data)
            else:
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}", response_data)

            return success, response_data

        except requests.exceptions.RequestException as e:
            self.log_test(name, False, f"Request error: {str(e)}")
            return False, {}
        except Exception as e:
            self.log_test(name, False, f"Unexpected error: {str(e)}")
            return False, {}

    def test_basic_endpoints(self):
        """Test basic API endpoints"""
        print("\n" + "="*60)
        print("TESTING BASIC API ENDPOINTS")
        print("="*60)
        
        # Test root endpoint
        self.run_test("Root API Endpoint", "GET", "api/")
        
        # Test medicines endpoint
        self.run_test("Get Medicines", "GET", "api/medicines")
        
        # Test sales endpoint
        self.run_test("Get Sales", "GET", "api/sales")
        
        # Test shop endpoint
        self.run_test("Get Shop Settings", "GET", "api/shop")
        
        # Test telegram settings endpoint
        self.run_test("Get Telegram Settings", "GET", "api/telegram/settings")

    def test_medicine_management(self):
        """Test medicine CRUD operations"""
        print("\n" + "="*60)
        print("TESTING MEDICINE MANAGEMENT")
        print("="*60)
        
        # Test adding a medicine
        test_medicine = {
            "name": f"Test Medicine {datetime.now().strftime('%H%M%S')}",
            "price": 25.50,
            "stock_quantity": 100,
            "expiry_date": "2025-12-31",
            "batch_number": f"BATCH{datetime.now().strftime('%Y%m%d')}",
            "supplier": "Test Supplier",
            "barcode": f"TEST{datetime.now().strftime('%H%M%S')}"
        }
        
        success, response = self.run_test(
            "Add Medicine", 
            "POST", 
            "api/medicines", 
            expected_status=200,
            data=test_medicine
        )
        
        medicine_id = None
        if success and response.get('id'):
            medicine_id = response['id']
            print(f"   Created medicine with ID: {medicine_id}")
            
            # Test updating the medicine
            update_data = {
                "price": 30.00,
                "stock_quantity": 150
            }
            
            self.run_test(
                "Update Medicine",
                "PUT",
                f"api/medicines/{medicine_id}",
                expected_status=200,
                data=update_data
            )
            
            # Test deleting the medicine
            self.run_test(
                "Delete Medicine",
                "DELETE",
                f"api/medicines/{medicine_id}",
                expected_status=200
            )

    def test_sales_management(self):
        """Test sales operations"""
        print("\n" + "="*60)
        print("TESTING SALES MANAGEMENT")
        print("="*60)
        
        # First, get available medicines
        success, medicines_response = self.run_test("Get Medicines for Sale", "GET", "api/medicines")
        
        if success and medicines_response.get('medicines'):
            medicines = medicines_response['medicines']
            if medicines:
                # Create a test sale
                test_sale = {
                    "receipt_number": f"TEST{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    "items": [
                        {
                            "medicine_id": medicines[0]['id'],
                            "medicine_name": medicines[0]['name'],
                            "quantity": 2,
                            "price": medicines[0]['price'],
                            "total": medicines[0]['price'] * 2
                        }
                    ],
                    "total_amount": medicines[0]['price'] * 2,
                    "payment_method": "cash",
                    "customer_name": "Test Customer",
                    "cashier_id": str(uuid.uuid4())
                }
                
                self.run_test(
                    "Create Sale",
                    "POST",
                    "api/sales",
                    expected_status=200,
                    data=test_sale
                )
            else:
                self.log_test("Create Sale", False, "No medicines available for testing")
        else:
            self.log_test("Create Sale", False, "Could not fetch medicines for testing")

    def test_telegram_functionality(self):
        """Test Telegram notification endpoints"""
        print("\n" + "="*60)
        print("TESTING TELEGRAM FUNCTIONALITY")
        print("="*60)
        
        # Test getting telegram settings
        self.run_test("Get Telegram Settings", "GET", "api/telegram/settings")
        
        # Test updating telegram settings (with dummy data)
        test_settings = {
            "bot_token": "dummy_token_for_testing",
            "chat_id": "dummy_chat_id",
            "enabled": False,  # Keep disabled for testing
            "daily_sales_report_enabled": True,
            "low_stock_alerts_enabled": True,
            "low_stock_threshold": 10
        }
        
        self.run_test(
            "Update Telegram Settings",
            "PUT",
            "api/telegram/settings",
            expected_status=200,
            data=test_settings
        )
        
        # Test notification history
        self.run_test("Get Notification History", "GET", "api/telegram/history")

    def test_tally_import_endpoints(self):
        """Test Tally import functionality"""
        print("\n" + "="*60)
        print("TESTING TALLY IMPORT ENDPOINTS")
        print("="*60)
        
        # Test import history
        self.run_test("Get Import History", "GET", "api/tally/import-history")

    def test_backup_restore_endpoints(self):
        """Test backup and restore functionality"""
        print("\n" + "="*60)
        print("TESTING BACKUP & RESTORE ENDPOINTS")
        print("="*60)
        
        # Test backup list
        self.run_test("Get Backup List", "GET", "api/backup/list")
        
        # Test creating a backup
        backup_options = {
            "include_medicines": True,
            "include_sales": True,
            "include_shop_details": True,
            "backup_name": f"test_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        }
        
        self.run_test(
            "Create Backup",
            "POST",
            "api/backup/create",
            expected_status=200,
            data=backup_options
        )

    def test_error_handling(self):
        """Test error handling for invalid requests"""
        print("\n" + "="*60)
        print("TESTING ERROR HANDLING")
        print("="*60)
        
        # Test invalid medicine ID
        self.run_test(
            "Get Invalid Medicine",
            "GET",
            "api/medicines/invalid_id",
            expected_status=404
        )
        
        # Test invalid endpoint
        self.run_test(
            "Invalid Endpoint",
            "GET",
            "api/nonexistent",
            expected_status=404
        )

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting MediPOS Backend API Tests")
        print(f"📡 Testing against: {self.base_url}")
        print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        try:
            # Run all test suites
            self.test_basic_endpoints()
            self.test_medicine_management()
            self.test_sales_management()
            self.test_telegram_functionality()
            self.test_tally_import_endpoints()
            self.test_backup_restore_endpoints()
            self.test_error_handling()
            
        except KeyboardInterrupt:
            print("\n⚠️ Tests interrupted by user")
        except Exception as e:
            print(f"\n💥 Unexpected error during testing: {str(e)}")
        
        # Print final results
        self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        print(f"📊 Total Tests: {self.tests_run}")
        print(f"✅ Passed: {self.tests_passed}")
        print(f"❌ Failed: {self.tests_run - self.tests_passed}")
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("\n🎉 ALL TESTS PASSED! Backend is working correctly.")
            return 0
        else:
            print(f"\n⚠️ {self.tests_run - self.tests_passed} tests failed. Check the details above.")
            
            # Print failed tests
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   • {result['name']}: {result['details']}")
            
            return 1

def main():
    """Main function"""
    # Check if custom URL is provided
    base_url = "https://032a89b3-6988-4f45-9ef0-f2fe91e9bf8f.preview.emergentagent.com"
    
    if len(sys.argv) > 1:
        base_url = sys.argv[1]
    
    print(f"🔧 Using backend URL: {base_url}")
    
    # Create tester instance and run tests
    tester = MediPOSAPITester(base_url)
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())