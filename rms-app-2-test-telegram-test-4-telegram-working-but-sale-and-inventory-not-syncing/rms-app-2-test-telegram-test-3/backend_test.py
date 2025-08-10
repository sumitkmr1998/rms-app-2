#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import uuid

class MediPOSAPITester:
    def __init__(self, base_url="https://91a5c7e3-1a1a-40a0-ae76-ad6a769e7d68.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_data = {}

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
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_medicines_crud(self):
        """Test complete CRUD operations for medicines"""
        print("\n📋 Testing Medicines CRUD Operations...")
        
        # Test GET medicines (empty initially)
        success, data = self.run_test("Get Medicines (Empty)", "GET", "medicines", 200)
        if not success:
            return False
            
        # Test CREATE medicine
        test_medicine = {
            "name": "Test Paracetamol",
            "price": 25.50,
            "stock_quantity": 100,
            "expiry_date": "2025-12-31",
            "batch_number": "TEST001",
            "supplier": "Test Pharma Ltd",
            "barcode": "1234567890123"
        }
        
        success, created_medicine = self.run_test("Create Medicine", "POST", "medicines", 201, test_medicine)
        if not success:
            return False
        
        medicine_id = created_medicine.get('id')
        if not medicine_id:
            print("❌ No medicine ID returned from create")
            return False
        
        self.test_data['medicine_id'] = medicine_id
        print(f"   Created medicine ID: {medicine_id}")
        
        # Test GET specific medicine
        success, medicine_data = self.run_test("Get Specific Medicine", "GET", f"medicines/{medicine_id}", 200)
        if not success:
            return False
            
        # Test UPDATE medicine
        update_data = {
            "name": "Updated Paracetamol",
            "price": 30.00,
            "stock_quantity": 150
        }
        
        success, updated_medicine = self.run_test("Update Medicine", "PUT", f"medicines/{medicine_id}", 200, update_data)
        if not success:
            return False
            
        # Test GET medicines (should have our medicine)
        success, medicines_list = self.run_test("Get Medicines (With Data)", "GET", "medicines", 200)
        if not success:
            return False
            
        medicines = medicines_list.get('medicines', [])
        if len(medicines) == 0:
            print("❌ No medicines found after creation")
            return False
            
        print(f"   Found {len(medicines)} medicines")
        
        return True

    def test_sales_crud(self):
        """Test complete CRUD operations for sales"""
        print("\n💰 Testing Sales CRUD Operations...")
        
        medicine_id = self.test_data.get('medicine_id')
        if not medicine_id:
            print("❌ No medicine ID available for sales test")
            return False
        
        # Test GET sales (empty initially)
        success, data = self.run_test("Get Sales (Empty)", "GET", "sales", 200)
        if not success:
            return False
            
        # Test CREATE sale
        test_sale = {
            "receipt_number": f"TEST-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
            "items": [
                {
                    "medicine_id": medicine_id,
                    "medicine_name": "Test Paracetamol",
                    "quantity": 2,
                    "price": 30.00,
                    "total": 60.00
                }
            ],
            "total_amount": 60.00,
            "payment_method": "cash",
            "customer_name": "John Doe",
            "customer_phone": "9876543210",
            "cashier_id": str(uuid.uuid4())
        }
        
        success, created_sale = self.run_test("Create Sale", "POST", "sales", 201, test_sale)
        if not success:
            return False
        
        sale_id = created_sale.get('id')
        if not sale_id:
            print("❌ No sale ID returned from create")
            return False
        
        self.test_data['sale_id'] = sale_id
        print(f"   Created sale ID: {sale_id}")
        
        # Test GET specific sale
        success, sale_data = self.run_test("Get Specific Sale", "GET", f"sales/{sale_id}", 200)
        if not success:
            return False
            
        # Test UPDATE sale (limited fields)
        update_data = {
            "customer_name": "Jane Doe",
            "payment_method": "card"
        }
        
        success, updated_sale = self.run_test("Update Sale", "PUT", f"sales/{sale_id}", 200, update_data)
        if not success:
            return False
            
        # Test GET sales (should have our sale)
        success, sales_list = self.run_test("Get Sales (With Data)", "GET", "sales", 200)
        if not success:
            return False
            
        sales = sales_list.get('sales', [])
        if len(sales) == 0:
            print("❌ No sales found after creation")
            return False
            
        print(f"   Found {len(sales)} sales")
        
        return True

    def test_search_functionality(self):
        """Test search functionality for medicines"""
        print("\n🔍 Testing Search Functionality...")
        
        # Test medicine search
        success, data = self.run_test("Search Medicines", "GET", "medicines?search=Paracetamol", 200)
        if not success:
            return False
            
        medicines = data.get('medicines', [])
        if len(medicines) == 0:
            print("❌ No medicines found in search")
            return False
            
        print(f"   Found {len(medicines)} medicines matching search")
        return True

    def test_error_handling(self):
        """Test error handling for invalid requests"""
        print("\n⚠️ Testing Error Handling...")
        
        # Test GET non-existent medicine
        fake_id = str(uuid.uuid4())
        success, data = self.run_test("Get Non-existent Medicine", "GET", f"medicines/{fake_id}", 404)
        if not success:
            return False
            
        # Test GET non-existent sale
        success, data = self.run_test("Get Non-existent Sale", "GET", f"sales/{fake_id}", 404)
        if not success:
            return False
            
        # Test CREATE medicine with invalid data
        invalid_medicine = {
            "name": "",  # Empty name should fail
            "price": -10  # Negative price should fail
        }
        
        # This might return 400 or 422 depending on validation
        success, data = self.run_test("Create Invalid Medicine", "POST", "medicines", 400, invalid_medicine)
        if not success:
            # Try 422 if 400 didn't work
            success, data = self.run_test("Create Invalid Medicine (422)", "POST", "medicines", 422, invalid_medicine)
        
        return True

    def cleanup_test_data(self):
        """Clean up test data"""
        print("\n🧹 Cleaning up test data...")
        
        # Delete test sale
        sale_id = self.test_data.get('sale_id')
        if sale_id:
            success, data = self.run_test("Delete Test Sale", "DELETE", f"sales/{sale_id}", 200)
        
        # Delete test medicine
        medicine_id = self.test_data.get('medicine_id')
        if medicine_id:
            success, data = self.run_test("Delete Test Medicine", "DELETE", f"medicines/{medicine_id}", 200)

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting MediPOS RMS API Tests")
        print(f"🌐 Testing against: {self.base_url}")
        print("=" * 60)
        
        try:
            # Basic connectivity
            if not self.test_root_endpoint()[0]:
                print("❌ Root endpoint failed, stopping tests")
                return False
            
            # CRUD operations
            if not self.test_medicines_crud():
                print("❌ Medicine CRUD tests failed")
                return False
                
            if not self.test_sales_crud():
                print("❌ Sales CRUD tests failed")
                return False
            
            # Search functionality
            if not self.test_search_functionality():
                print("❌ Search functionality tests failed")
                return False
            
            # Error handling
            if not self.test_error_handling():
                print("❌ Error handling tests failed")
                return False
            
            return True
            
        except Exception as e:
            print(f"❌ Test suite failed with error: {e}")
            return False
        finally:
            # Always try to cleanup
            self.cleanup_test_data()

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 ALL TESTS PASSED!")
            return True
        else:
            print("❌ SOME TESTS FAILED!")
            return False

def main():
    """Main test function"""
    tester = MediPOSAPITester()
    
    try:
        success = tester.run_all_tests()
        final_success = tester.print_summary()
        
        return 0 if final_success else 1
        
    except KeyboardInterrupt:
        print("\n⏹️ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Test suite crashed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())