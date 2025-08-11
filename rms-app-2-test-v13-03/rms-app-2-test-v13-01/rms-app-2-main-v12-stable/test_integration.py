#!/usr/bin/env python3
"""
Integration Test Script for MediPOS Telegram Notification Sync
Tests the integration between sales data and Telegram notifications
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8001/api"

def test_api_connection():
    """Test if the API is accessible"""
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"✅ API Connection: {response.json()['message']}")
        return True
    except Exception as e:
        print(f"❌ API Connection Failed: {e}")
        return False

def create_test_medicine():
    """Create a test medicine"""
    medicine_data = {
        "id": "test-med-sync-001",
        "name": "Paracetamol Test",
        "price": 15.50,
        "stock_quantity": 50,
        "expiry_date": "2025-12-31",
        "batch_number": "BATCH2025",
        "supplier": "PharmaCorp",
        "barcode": "12345678901",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    try:
        response = requests.post(f"{BASE_URL}/medicines", json=medicine_data)
        if response.status_code == 200:
            print(f"✅ Medicine Created: {medicine_data['name']} (Stock: {medicine_data['stock_quantity']})")
            return True
        else:
            print(f"❌ Medicine Creation Failed: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Medicine Creation Error: {e}")
        return False

def create_test_sale():
    """Create a test sale"""
    sale_data = {
        "id": "test-sale-sync-001",
        "receipt_number": f"RCP{int(datetime.utcnow().timestamp())}",
        "items": [
            {
                "medicine_id": "test-med-sync-001",
                "medicine_name": "Paracetamol Test",
                "quantity": 5,
                "price": 15.50,
                "total": 77.50
            }
        ],
        "total_amount": 77.50,
        "payment_method": "cash",
        "customer_name": "Integration Test Customer",
        "cashier_id": "test-cashier",
        "is_return": False,
        "created_at": datetime.utcnow().isoformat()
    }
    
    try:
        response = requests.post(f"{BASE_URL}/sales", json=sale_data)
        if response.status_code == 200:
            print(f"✅ Sale Created: {sale_data['receipt_number']} (Total: ₹{sale_data['total_amount']})")
            return True
        else:
            print(f"❌ Sale Creation Failed: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Sale Creation Error: {e}")
        return False

def check_medicine_stock():
    """Check if medicine stock was updated after sale"""
    try:
        response = requests.get(f"{BASE_URL}/medicines")
        if response.status_code == 200:
            medicines = response.json().get("medicines", [])
            test_medicine = next((m for m in medicines if m["id"] == "test-med-sync-001"), None)
            if test_medicine:
                expected_stock = 45  # 50 - 5 from sale
                actual_stock = test_medicine["stock_quantity"]
                if actual_stock == expected_stock:
                    print(f"✅ Stock Updated Correctly: {actual_stock} units (reduced by 5)")
                    return True
                else:
                    print(f"❌ Stock Update Failed: Expected {expected_stock}, got {actual_stock}")
                    return False
            else:
                print("❌ Test medicine not found")
                return False
        else:
            print(f"❌ Failed to fetch medicines: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Stock Check Error: {e}")
        return False

def check_sales_data():
    """Check if sales data is available for notifications"""
    try:
        response = requests.get(f"{BASE_URL}/sales")
        if response.status_code == 200:
            sales = response.json().get("sales", [])
            test_sale = next((s for s in sales if s["id"] == "test-sale-sync-001"), None)
            if test_sale:
                print(f"✅ Sales Data Available: {test_sale['receipt_number']} (₹{test_sale['total_amount']})")
                return True
            else:
                print("❌ Test sale not found in database")
                return False
        else:
            print(f"❌ Failed to fetch sales: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Sales Data Check Error: {e}")
        return False

def test_telegram_settings():
    """Test Telegram settings configuration"""
    settings_data = {
        "bot_token": "test_bot_token_for_integration",
        "chat_id": "test_chat_id_12345",
        "enabled": False,  # Keep disabled for testing
        "daily_sales_report_enabled": True,
        "low_stock_alerts_enabled": True,
        "low_stock_threshold": 10
    }
    
    try:
        response = requests.put(f"{BASE_URL}/telegram/settings", json=settings_data)
        if response.status_code == 200:
            print("✅ Telegram Settings Configured")
            return True
        else:
            print(f"❌ Telegram Settings Failed: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Telegram Settings Error: {e}")
        return False

def test_notification_trigger():
    """Test manual notification trigger"""
    try:
        response = requests.post(f"{BASE_URL}/telegram/send-manual/daily_sales")
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                print("✅ Telegram Daily Sales Notification Triggered Successfully")
                print("  (Note: Actual notification disabled for testing)")
                return True
            else:
                print(f"❌ Notification Trigger Failed: {result.get('error', 'Unknown error')}")
                return False
        else:
            print(f"❌ Notification Request Failed: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Notification Trigger Error: {e}")
        return False

def run_integration_tests():
    """Run all integration tests"""
    print("🧪 MediPOS Integration Test - Sales & Telegram Notification Sync")
    print("=" * 70)
    
    tests = [
        ("API Connection", test_api_connection),
        ("Medicine Creation", create_test_medicine),
        ("Sale Creation", create_test_sale),
        ("Stock Update Verification", check_medicine_stock),
        ("Sales Data Availability", check_sales_data),
        ("Telegram Settings", test_telegram_settings),
        ("Notification Trigger", test_notification_trigger)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n🔍 Running: {test_name}")
        if test_func():
            passed += 1
        else:
            print(f"   ⚠️  Test '{test_name}' failed")
    
    print("\n" + "=" * 70)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Sales-Telegram sync integration is working correctly.")
        print("\n✨ Key Improvements Made:")
        print("  • Sales now sync with backend database (hybrid mode)")
        print("  • Medicine stock updates automatically with sales")
        print("  • Telegram notifications can access real sales data")
        print("  • Offline capability maintained with localStorage fallback")
    else:
        print("❌ Some tests failed. Please check the implementation.")
    
    return passed == total

if __name__ == "__main__":
    success = run_integration_tests()
    exit(0 if success else 1)