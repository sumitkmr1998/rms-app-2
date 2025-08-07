#!/usr/bin/env python3
"""
Comprehensive Backend API Tests for Medicine POS System
Tests all backend endpoints and business logic
"""

import requests
import json
from datetime import datetime, date
import time
import sys

# Configuration
BASE_URL = "https://3e3068ca-db01-489b-8e1f-90b944303913.preview.emergentagent.com/api"
DEFAULT_CASHIER_ID = "default-user"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        
    def log_pass(self, test_name):
        self.passed += 1
        print(f"✅ PASS: {test_name}")
        
    def log_fail(self, test_name, error):
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        print(f"❌ FAIL: {test_name} - {error}")
        
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY: {self.passed}/{total} tests passed")
        print(f"{'='*60}")
        if self.errors:
            print("FAILURES:")
            for error in self.errors:
                print(f"  - {error}")
        return self.failed == 0

def make_request(method, endpoint, data=None, params=None):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method == "GET":
            response = requests.get(url, params=params, timeout=30)
        elif method == "POST":
            response = requests.post(url, json=data, timeout=30)
        elif method == "PUT":
            response = requests.put(url, json=data, timeout=30)
        elif method == "DELETE":
            response = requests.delete(url, timeout=30)
        
        return response
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None

def test_api_health(results):
    """Test basic API connectivity"""
    print("\n🔍 Testing API Health...")
    
    response = make_request("GET", "/")
    if response and response.status_code == 200:
        results.log_pass("API Health Check")
        return True
    else:
        results.log_fail("API Health Check", f"Status: {response.status_code if response else 'No response'}")
        return False

def test_medicine_inventory_management(results):
    """Test Medicine Inventory CRUD operations"""
    print("\n🔍 Testing Medicine Inventory Management...")
    
    # Test 1: Get all medicines (should have sample data)
    response = make_request("GET", "/medicines")
    if response and response.status_code == 200:
        medicines = response.json()
        if len(medicines) > 0:
            results.log_pass("Get all medicines - has sample data")
            print(f"   Found {len(medicines)} medicines in inventory")
        else:
            results.log_fail("Get all medicines", "No sample medicines found")
            return False
    else:
        results.log_fail("Get all medicines", f"Status: {response.status_code if response else 'No response'}")
        return False
    
    # Test 2: Search medicines by name
    response = make_request("GET", "/medicines", params={"search": "Paracetamol"})
    if response and response.status_code == 200:
        search_results = response.json()
        results.log_pass("Medicine search functionality")
        print(f"   Search for 'Paracetamol' returned {len(search_results)} results")
    else:
        results.log_fail("Medicine search", f"Status: {response.status_code if response else 'No response'}")
    
    # Test 3: Get specific medicine (use first medicine from list)
    if medicines:
        medicine_id = medicines[0]["id"]
        response = make_request("GET", f"/medicines/{medicine_id}")
        if response and response.status_code == 200:
            medicine = response.json()
            results.log_pass("Get specific medicine by ID")
            print(f"   Retrieved medicine: {medicine['name']}")
        else:
            results.log_fail("Get specific medicine", f"Status: {response.status_code if response else 'No response'}")
    
    # Test 4: Create new medicine
    new_medicine = {
        "name": "Test Medicine API",
        "price": 25.50,
        "stock_quantity": 100,
        "expiry_date": "2025-12-31",
        "batch_number": "TEST001",
        "supplier": "Test Supplier",
        "barcode": "TEST123456"
    }
    
    response = make_request("POST", "/medicines", data=new_medicine)
    if response and response.status_code == 200:
        created_medicine = response.json()
        results.log_pass("Create new medicine")
        print(f"   Created medicine with ID: {created_medicine['id']}")
        
        # Test 5: Update the created medicine
        update_data = {
            "name": "Updated Test Medicine",
            "price": 30.00,
            "stock_quantity": 150,
            "expiry_date": "2025-12-31",
            "batch_number": "TEST001",
            "supplier": "Updated Supplier"
        }
        
        response = make_request("PUT", f"/medicines/{created_medicine['id']}", data=update_data)
        if response and response.status_code == 200:
            updated_medicine = response.json()
            if updated_medicine["name"] == "Updated Test Medicine":
                results.log_pass("Update medicine")
                print(f"   Updated medicine name to: {updated_medicine['name']}")
            else:
                results.log_fail("Update medicine", "Medicine name not updated correctly")
        else:
            results.log_fail("Update medicine", f"Status: {response.status_code if response else 'No response'}")
        
        # Test 6: Delete the created medicine
        response = make_request("DELETE", f"/medicines/{created_medicine['id']}")
        if response and response.status_code == 200:
            results.log_pass("Delete medicine")
            print("   Successfully deleted test medicine")
        else:
            results.log_fail("Delete medicine", f"Status: {response.status_code if response else 'No response'}")
    else:
        results.log_fail("Create new medicine", f"Status: {response.status_code if response else 'No response'}")
    
    return True

def test_point_of_sale_system(results):
    """Test Point of Sale System functionality"""
    print("\n🔍 Testing Point of Sale System...")
    
    # First, get available medicines for sale
    response = make_request("GET", "/medicines")
    if not response or response.status_code != 200:
        results.log_fail("POS - Get medicines for sale", "Cannot retrieve medicines")
        return False
    
    medicines = response.json()
    if not medicines:
        results.log_fail("POS - Get medicines for sale", "No medicines available")
        return False
    
    # Find a medicine with sufficient stock
    medicine_for_sale = None
    for med in medicines:
        if med["stock_quantity"] >= 5:
            medicine_for_sale = med
            break
    
    if not medicine_for_sale:
        results.log_fail("POS - Find medicine with stock", "No medicine with sufficient stock found")
        return False
    
    original_stock = medicine_for_sale["stock_quantity"]
    print(f"   Using medicine: {medicine_for_sale['name']} (Stock: {original_stock})")
    
    # Test 1: Create a sale
    sale_data = {
        "items": [
            {
                "medicine_id": medicine_for_sale["id"],
                "medicine_name": medicine_for_sale["name"],
                "quantity": 2,
                "price": medicine_for_sale["price"],
                "total": medicine_for_sale["price"] * 2
            }
        ],
        "total_amount": medicine_for_sale["price"] * 2,
        "payment_method": "cash",
        "customer_name": "John Doe",
        "customer_phone": "9876543210",
        "cashier_id": DEFAULT_CASHIER_ID
    }
    
    response = make_request("POST", "/sales", data=sale_data)
    if response and response.status_code == 200:
        sale = response.json()
        results.log_pass("Create sale transaction")
        print(f"   Created sale with receipt: {sale['receipt_number']}")
        
        # Test 2: Verify stock deduction
        response = make_request("GET", f"/medicines/{medicine_for_sale['id']}")
        if response and response.status_code == 200:
            updated_medicine = response.json()
            expected_stock = original_stock - 2
            if updated_medicine["stock_quantity"] == expected_stock:
                results.log_pass("Stock deduction after sale")
                print(f"   Stock correctly reduced from {original_stock} to {updated_medicine['stock_quantity']}")
            else:
                results.log_fail("Stock deduction", f"Expected {expected_stock}, got {updated_medicine['stock_quantity']}")
        else:
            results.log_fail("Verify stock after sale", "Cannot retrieve updated medicine")
        
        # Test 3: Verify receipt number generation
        if sale.get("receipt_number") and sale["receipt_number"].startswith("RCP"):
            results.log_pass("Receipt number generation")
            print(f"   Receipt number format correct: {sale['receipt_number']}")
        else:
            results.log_fail("Receipt number generation", f"Invalid format: {sale.get('receipt_number')}")
    else:
        results.log_fail("Create sale transaction", f"Status: {response.status_code if response else 'No response'}")
        return False
    
    # Test 4: Test insufficient stock scenario
    insufficient_sale = {
        "items": [
            {
                "medicine_id": medicine_for_sale["id"],
                "medicine_name": medicine_for_sale["name"],
                "quantity": 9999,  # Intentionally high quantity
                "price": medicine_for_sale["price"],
                "total": medicine_for_sale["price"] * 9999
            }
        ],
        "total_amount": medicine_for_sale["price"] * 9999,
        "payment_method": "cash",
        "cashier_id": DEFAULT_CASHIER_ID
    }
    
    response = make_request("POST", "/sales", data=insufficient_sale)
    if response and response.status_code == 400:
        results.log_pass("Insufficient stock validation")
        print("   Correctly rejected sale with insufficient stock")
    else:
        results.log_fail("Insufficient stock validation", f"Expected 400, got {response.status_code if response else 'No response'}")
    
    return True

def test_sales_analytics(results):
    """Test Sales Analytics functionality"""
    print("\n🔍 Testing Sales Analytics...")
    
    # Test 1: Get overall analytics
    response = make_request("GET", "/sales/analytics")
    if response and response.status_code == 200:
        analytics = response.json()
        required_fields = ["total_sales", "total_transactions", "avg_transaction"]
        
        if all(field in analytics for field in required_fields):
            results.log_pass("Sales analytics structure")
            print(f"   Total Sales: ₹{analytics['total_sales']}")
            print(f"   Total Transactions: {analytics['total_transactions']}")
            print(f"   Average Transaction: ₹{analytics['avg_transaction']}")
            
            # Verify data types and values
            if (isinstance(analytics["total_sales"], (int, float)) and 
                isinstance(analytics["total_transactions"], int) and
                isinstance(analytics["avg_transaction"], (int, float))):
                results.log_pass("Sales analytics data types")
            else:
                results.log_fail("Sales analytics data types", "Invalid data types in response")
        else:
            results.log_fail("Sales analytics structure", f"Missing fields: {set(required_fields) - set(analytics.keys())}")
    else:
        results.log_fail("Get sales analytics", f"Status: {response.status_code if response else 'No response'}")
    
    # Test 2: Get sales list
    response = make_request("GET", "/sales")
    if response and response.status_code == 200:
        sales = response.json()
        results.log_pass("Get sales list")
        print(f"   Retrieved {len(sales)} sales records")
        
        # Test 3: Verify sales data structure
        if sales:
            sale = sales[0]
            required_fields = ["id", "items", "total_amount", "payment_method", "sale_date", "receipt_number"]
            if all(field in sale for field in required_fields):
                results.log_pass("Sales record structure")
            else:
                results.log_fail("Sales record structure", f"Missing fields in sales record")
    else:
        results.log_fail("Get sales list", f"Status: {response.status_code if response else 'No response'}")
    
    # Test 4: Test date filtering (if we have sales)
    today = date.today().isoformat()
    response = make_request("GET", "/sales", params={"start_date": today, "end_date": today})
    if response and response.status_code == 200:
        filtered_sales = response.json()
        results.log_pass("Sales date filtering")
        print(f"   Today's sales: {len(filtered_sales)} records")
    else:
        results.log_fail("Sales date filtering", f"Status: {response.status_code if response else 'No response'}")
    
    return True

def test_user_management_with_permissions(results):
    """Test User Management and Permissions"""
    print("\n🔍 Testing User Management with Permissions...")
    
    # Test 1: Get all users (should have sample data)
    response = make_request("GET", "/users")
    if response and response.status_code == 200:
        users = response.json()
        if len(users) >= 3:  # Should have admin, manager1, cashier1
            results.log_pass("Get users - has sample data")
            print(f"   Found {len(users)} users")
            
            # Verify user roles
            roles_found = [user["role"] for user in users]
            expected_roles = ["admin", "manager", "cashier"]
            if any(role in roles_found for role in expected_roles):
                results.log_pass("User roles verification")
                print(f"   User roles found: {set(roles_found)}")
            else:
                results.log_fail("User roles verification", f"Expected roles not found: {roles_found}")
        else:
            results.log_fail("Get users", f"Expected at least 3 users, found {len(users)}")
    else:
        results.log_fail("Get users", f"Status: {response.status_code if response else 'No response'}")
        return False
    
    # Test 2: Create new user
    new_user = {
        "username": "test_cashier",
        "password": "test123",
        "role": "cashier",
        "permissions": {
            "can_modify_stock": False,
            "can_create_users": False,
            "can_view_analytics": True
        }
    }
    
    response = make_request("POST", "/users", data=new_user)
    if response and response.status_code == 200:
        created_user = response.json()
        results.log_pass("Create new user")
        print(f"   Created user: {created_user['username']} with role: {created_user['role']}")
        
        # Test 3: Verify user permissions structure
        if "permissions" in created_user and isinstance(created_user["permissions"], dict):
            results.log_pass("User permissions structure")
            print(f"   User permissions: {created_user['permissions']}")
        else:
            results.log_fail("User permissions structure", "Permissions not properly stored")
        
        # Test 4: Verify password is hashed (not stored in plain text)
        if "password_hash" in created_user and "password" not in created_user:
            results.log_pass("Password security")
            print("   Password properly hashed and not stored in plain text")
        else:
            results.log_fail("Password security", "Password not properly secured")
    else:
        results.log_fail("Create new user", f"Status: {response.status_code if response else 'No response'}")
    
    return True

def test_shop_details_management(results):
    """Test Shop Details Management"""
    print("\n🔍 Testing Shop Details Management...")
    
    # Test 1: Get existing shop details
    response = make_request("GET", "/shop")
    if response and response.status_code == 200:
        shop = response.json()
        if shop:
            results.log_pass("Get shop details - has sample data")
            print(f"   Shop name: {shop['name']}")
            print(f"   License: {shop['license_number']}")
        else:
            print("   No existing shop details found")
    else:
        results.log_fail("Get shop details", f"Status: {response.status_code if response else 'No response'}")
    
    # Test 2: Create/Update shop details
    shop_data = {
        "name": "Test Pharmacy API",
        "address": "123 Test Street, Test City",
        "phone": "9876543210",
        "email": "test@pharmacy.com",
        "license_number": "LIC123456",
        "gst_number": "GST123456789"
    }
    
    response = make_request("POST", "/shop", data=shop_data)
    if response and response.status_code == 200:
        created_shop = response.json()
        results.log_pass("Create/Update shop details")
        print(f"   Shop details updated: {created_shop['name']}")
        
        # Test 3: Verify shop details structure
        required_fields = ["name", "address", "phone", "license_number"]
        if all(field in created_shop for field in required_fields):
            results.log_pass("Shop details structure")
        else:
            results.log_fail("Shop details structure", f"Missing required fields")
        
        # Test 4: Verify shop details retrieval after update
        response = make_request("GET", "/shop")
        if response and response.status_code == 200:
            retrieved_shop = response.json()
            if retrieved_shop and retrieved_shop["name"] == "Test Pharmacy API":
                results.log_pass("Shop details persistence")
                print("   Shop details correctly persisted and retrieved")
            else:
                results.log_fail("Shop details persistence", "Updated shop details not retrieved correctly")
        else:
            results.log_fail("Retrieve updated shop details", f"Status: {response.status_code if response else 'No response'}")
    else:
        results.log_fail("Create/Update shop details", f"Status: {response.status_code if response else 'No response'}")
    
    return True

def test_low_stock_scenario(results):
    """Test low stock scenarios specifically"""
    print("\n🔍 Testing Low Stock Scenarios...")
    
    # Get medicines to find one with low stock
    response = make_request("GET", "/medicines")
    if not response or response.status_code != 200:
        results.log_fail("Low stock test - Get medicines", "Cannot retrieve medicines")
        return False
    
    medicines = response.json()
    low_stock_medicine = None
    
    # Look for Digene Tablets or any medicine with stock < 10
    for med in medicines:
        if med["stock_quantity"] < 10:
            low_stock_medicine = med
            break
    
    if low_stock_medicine:
        results.log_pass("Low stock medicine identification")
        print(f"   Found low stock medicine: {low_stock_medicine['name']} (Stock: {low_stock_medicine['stock_quantity']})")
        
        # Test selling remaining stock
        if low_stock_medicine["stock_quantity"] > 0:
            sale_data = {
                "items": [
                    {
                        "medicine_id": low_stock_medicine["id"],
                        "medicine_name": low_stock_medicine["name"],
                        "quantity": low_stock_medicine["stock_quantity"],  # Sell all remaining stock
                        "price": low_stock_medicine["price"],
                        "total": low_stock_medicine["price"] * low_stock_medicine["stock_quantity"]
                    }
                ],
                "total_amount": low_stock_medicine["price"] * low_stock_medicine["stock_quantity"],
                "payment_method": "cash",
                "cashier_id": DEFAULT_CASHIER_ID
            }
            
            response = make_request("POST", "/sales", data=sale_data)
            if response and response.status_code == 200:
                results.log_pass("Sell remaining low stock")
                print(f"   Successfully sold all remaining stock")
                
                # Verify stock is now 0
                response = make_request("GET", f"/medicines/{low_stock_medicine['id']}")
                if response and response.status_code == 200:
                    updated_med = response.json()
                    if updated_med["stock_quantity"] == 0:
                        results.log_pass("Zero stock verification")
                        print("   Stock correctly reduced to 0")
                    else:
                        results.log_fail("Zero stock verification", f"Expected 0, got {updated_med['stock_quantity']}")
            else:
                results.log_fail("Sell remaining low stock", f"Status: {response.status_code if response else 'No response'}")
    else:
        print("   No low stock medicines found (all medicines have stock >= 10)")
        results.log_pass("Low stock scenario - no low stock found")
    
    return True

def main():
    """Run all backend tests"""
    print("🚀 Starting Medicine POS System Backend API Tests")
    print(f"Base URL: {BASE_URL}")
    print(f"Default Cashier ID: {DEFAULT_CASHIER_ID}")
    
    results = TestResults()
    
    # Test API connectivity first
    if not test_api_health(results):
        print("❌ API is not accessible. Stopping tests.")
        return False
    
    # Run all test suites
    test_medicine_inventory_management(results)
    test_point_of_sale_system(results)
    test_sales_analytics(results)
    test_user_management_with_permissions(results)
    test_shop_details_management(results)
    test_low_stock_scenario(results)
    
    # Print final summary
    success = results.summary()
    
    if success:
        print("\n🎉 All backend tests passed successfully!")
    else:
        print(f"\n⚠️  {results.failed} test(s) failed. See details above.")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)