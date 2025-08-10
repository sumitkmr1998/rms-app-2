#!/usr/bin/env python3

import requests
import sys
import json
import uuid
from datetime import datetime

class POSSalesAPITester:
    def __init__(self, base_url="https://52c2f98c-7f7b-4ec2-bc3c-1bdac16e13bd.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.created_medicine_id = None
        self.created_sale_id = None

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

    def test_basic_endpoints(self):
        """Test basic API endpoints"""
        print("📋 Testing Basic API Endpoints...")
        
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

    def test_create_test_medicine(self):
        """Create a test medicine for POS testing"""
        print("\n🧪 Creating Test Medicine...")
        
        medicine_data = {
            "name": "vxdvv",  # Using the medicine name mentioned in the test request
            "price": 25.50,
            "stock_quantity": 100,
            "expiry_date": "2025-12-31",
            "batch_number": "TEST001",
            "supplier": "Test Supplier",
            "barcode": "TEST123456"
        }
        
        success, response_data = self.run_test(
            "Create Test Medicine",
            "POST",
            "medicines",
            201,
            data=medicine_data
        )
        
        if success and response_data.get('id'):
            self.created_medicine_id = response_data['id']
            print(f"   ✅ Created medicine with ID: {self.created_medicine_id}")
        
        return success, response_data

    def test_pos_sale_creation(self):
        """Test POS sale creation with receipt_number (the main issue being tested)"""
        print("\n🛒 Testing POS Sale Creation...")
        
        if not self.created_medicine_id:
            print("❌ No test medicine available for sale creation")
            return False, {}
        
        # Create a sale exactly like the frontend would (with receipt_number)
        sale_data = {
            "receipt_number": f"RCP{int(datetime.now().timestamp() * 1000)}",  # Same format as frontend
            "items": [
                {
                    "medicine_id": self.created_medicine_id,
                    "medicine_name": "vxdvv",
                    "quantity": 2,
                    "price": 25.50,
                    "total": 51.00,
                    "is_return": False
                }
            ],
            "total_amount": 51.00,
            "subtotal_amount": 51.00,
            "discount_type": "none",
            "discount_value": 0,
            "discount_amount": 0,
            "payment_method": "cash",
            "customer_name": "Test Customer",
            "customer_phone": "1234567890",
            "cashier_id": "test-cashier-123",
            "is_return": False
        }
        
        success, response_data = self.run_test(
            "Create POS Sale (with receipt_number)",
            "POST",
            "sales",
            201,
            data=sale_data
        )
        
        if success and response_data.get('id'):
            self.created_sale_id = response_data['id']
            print(f"   ✅ Created sale with ID: {self.created_sale_id}")
            print(f"   ✅ Receipt Number: {response_data.get('receipt_number')}")
        
        return success, response_data

    def test_sales_history_retrieval(self):
        """Test that the created sale appears in sales history"""
        print("\n📊 Testing Sales History Retrieval...")
        
        success, response_data = self.run_test(
            "Get Sales History",
            "GET",
            "sales",
            200
        )
        
        if success:
            sales = response_data.get('sales', [])
            print(f"   📈 Total sales found: {len(sales)}")
            
            # Check if our created sale is in the list
            if self.created_sale_id:
                found_sale = None
                for sale in sales:
                    if sale.get('id') == self.created_sale_id:
                        found_sale = sale
                        break
                
                if found_sale:
                    print(f"   ✅ Created sale found in sales history!")
                    print(f"   ✅ Sale ID: {found_sale.get('id')}")
                    print(f"   ✅ Receipt Number: {found_sale.get('receipt_number')}")
                    print(f"   ✅ Total Amount: ₹{found_sale.get('total_amount')}")
                    return True, found_sale
                else:
                    print(f"   ❌ Created sale NOT found in sales history!")
                    print(f"   ❌ Looking for sale ID: {self.created_sale_id}")
                    return False, {}
            else:
                print(f"   ⚠️  No sale ID to verify (sale creation may have failed)")
        
        return success, response_data

    def test_individual_sale_retrieval(self):
        """Test retrieving individual sale by ID"""
        print("\n🔍 Testing Individual Sale Retrieval...")
        
        if not self.created_sale_id:
            print("❌ No sale ID available for individual retrieval test")
            return False, {}
        
        success, response_data = self.run_test(
            "Get Individual Sale",
            "GET",
            f"sales/{self.created_sale_id}",
            200
        )
        
        if success:
            print(f"   ✅ Successfully retrieved sale by ID")
            print(f"   ✅ Receipt Number: {response_data.get('receipt_number')}")
            print(f"   ✅ Items Count: {len(response_data.get('items', []))}")
        
        return success, response_data

    def test_medicine_stock_update(self):
        """Test that medicine stock was updated after sale"""
        print("\n📦 Testing Medicine Stock Update After Sale...")
        
        if not self.created_medicine_id:
            print("❌ No medicine ID available for stock check")
            return False, {}
        
        success, response_data = self.run_test(
            "Get Medicine After Sale",
            "GET",
            f"medicines/{self.created_medicine_id}",
            200
        )
        
        if success:
            current_stock = response_data.get('stock_quantity', 0)
            print(f"   📦 Current stock quantity: {current_stock}")
            # Original stock was 100, we sold 2, so should be 98
            expected_stock = 98
            if current_stock == expected_stock:
                print(f"   ✅ Stock correctly updated! (Expected: {expected_stock}, Got: {current_stock})")
                return True, response_data
            else:
                print(f"   ❌ Stock NOT correctly updated! (Expected: {expected_stock}, Got: {current_stock})")
                return False, response_data
        
        return success, response_data

    def test_sale_without_receipt_number(self):
        """Test creating a sale without receipt_number (should fail or auto-generate)"""
        print("\n⚠️  Testing Sale Creation WITHOUT receipt_number...")
        
        if not self.created_medicine_id:
            print("❌ No test medicine available for sale creation")
            return False, {}
        
        # Create a sale WITHOUT receipt_number (the original bug)
        sale_data = {
            # "receipt_number": "RCP123456",  # Intentionally omitted
            "items": [
                {
                    "medicine_id": self.created_medicine_id,
                    "medicine_name": "vxdvv",
                    "quantity": 1,
                    "price": 25.50,
                    "total": 25.50,
                    "is_return": False
                }
            ],
            "total_amount": 25.50,
            "payment_method": "cash",
            "cashier_id": "test-cashier-123",
            "is_return": False
        }
        
        success, response_data = self.run_test(
            "Create Sale WITHOUT receipt_number",
            "POST",
            "sales",
            201,  # Expecting success if backend auto-generates receipt_number
            data=sale_data
        )
        
        if success:
            receipt_number = response_data.get('receipt_number')
            if receipt_number:
                print(f"   ✅ Backend auto-generated receipt_number: {receipt_number}")
            else:
                print(f"   ⚠️  Sale created but no receipt_number in response")
        
        return success, response_data

    def cleanup_test_data(self):
        """Clean up test data"""
        print("\n🧹 Cleaning up test data...")
        
        # Delete test sale
        if self.created_sale_id:
            success, _ = self.run_test(
                "Delete Test Sale",
                "DELETE",
                f"sales/{self.created_sale_id}",
                200
            )
            if success:
                print(f"   ✅ Deleted test sale: {self.created_sale_id}")
        
        # Delete test medicine
        if self.created_medicine_id:
            success, _ = self.run_test(
                "Delete Test Medicine",
                "DELETE",
                f"medicines/{self.created_medicine_id}",
                200
            )
            if success:
                print(f"   ✅ Deleted test medicine: {self.created_medicine_id}")

def main():
    print("=" * 80)
    print("🧪 MediPOS RMS - POS to Sales Synchronization Test")
    print("=" * 80)
    print(f"🕒 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    print("🎯 Testing the specific issue: POS sales complete successfully but don't appear in sales history")
    print("🔧 Root cause: Frontend wasn't including required 'receipt_number' field")
    print("✅ Fix applied: Added receipt_number: `RCP${Date.now()}` to POS checkout")
    print()

    # Setup
    tester = POSSalesAPITester()
    
    print("🔧 Test Configuration:")
    print(f"   Base URL: {tester.base_url}")
    print(f"   API Endpoint: {tester.base_url}/api/")
    print()

    # Run comprehensive tests
    try:
        # 1. Test basic endpoints
        basic_results = tester.test_basic_endpoints()
        
        # 2. Create test medicine
        medicine_success, medicine_data = tester.test_create_test_medicine()
        
        # 3. Test POS sale creation (with receipt_number - the fix)
        sale_success, sale_data = tester.test_pos_sale_creation()
        
        # 4. Test sales history retrieval (the main issue)
        history_success, history_data = tester.test_sales_history_retrieval()
        
        # 5. Test individual sale retrieval
        individual_success, individual_data = tester.test_individual_sale_retrieval()
        
        # 6. Test medicine stock update
        stock_success, stock_data = tester.test_medicine_stock_update()
        
        # 7. Test sale without receipt_number (original bug scenario)
        no_receipt_success, no_receipt_data = tester.test_sale_without_receipt_number()
        
        # 8. Cleanup
        tester.cleanup_test_data()

    except KeyboardInterrupt:
        print("\n⚠️  Test interrupted by user")
        tester.cleanup_test_data()
        return 1
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        tester.cleanup_test_data()
        return 1

    # Print final results
    print("\n" + "=" * 80)
    print("📊 POS TO SALES SYNCHRONIZATION TEST RESULTS")
    print("=" * 80)
    
    print(f"✅ Tests Passed: {tester.tests_passed}")
    print(f"❌ Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"📊 Total Tests: {tester.tests_run}")
    print(f"🎯 Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    print("\n🔍 Key Test Results:")
    key_tests = [
        ("Basic API Connectivity", all(result[1] for result in basic_results)),
        ("Test Medicine Creation", medicine_success),
        ("POS Sale Creation (with receipt_number)", sale_success),
        ("Sales History Retrieval", history_success),
        ("Individual Sale Retrieval", individual_success),
        ("Medicine Stock Update", stock_success),
        ("Sale without receipt_number", no_receipt_success)
    ]
    
    for name, success in key_tests:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"   {status} - {name}")

    print(f"\n🕒 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Determine overall result
    critical_tests_passed = sale_success and history_success
    
    if critical_tests_passed:
        print("\n🎉 CRITICAL TESTS PASSED!")
        print("✅ POS to Sales synchronization is working correctly")
        print("✅ Sales created via POS appear in sales history")
        print("✅ Receipt numbers are being included in sales")
        return 0
    else:
        print("\n⚠️  CRITICAL TESTS FAILED!")
        print("❌ POS to Sales synchronization issue still exists")
        print("❌ Sales may not be appearing in sales history")
        return 1

if __name__ == "__main__":
    sys.exit(main())