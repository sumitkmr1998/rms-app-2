#!/usr/bin/env python3
"""
MediPOS RMS Backend Edge Case and Error Handling Tests
"""

import requests
import json
from datetime import datetime, timedelta

BACKEND_URL = "http://localhost:8001/api"

def test_invalid_date_formats():
    """Test sales analytics with invalid date formats"""
    print("Testing invalid date formats...")
    
    # Test with invalid date format
    invalid_data = {
        "start_date": "invalid-date",
        "end_date": "2024-12-31T23:59:59Z"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/analytics/sales", json=invalid_data)
        print(f"Invalid date format test: HTTP {response.status_code}")
        if response.status_code == 422:
            print("✅ Properly handles invalid date format with validation error")
        elif response.status_code == 200:
            data = response.json()
            print(f"✅ Gracefully handles invalid date, returns: {data}")
        else:
            print(f"⚠️  Unexpected response: {response.text}")
    except Exception as e:
        print(f"❌ Error testing invalid dates: {e}")

def test_future_date_range():
    """Test analytics with future date range"""
    print("\nTesting future date range...")
    
    future_start = datetime.now() + timedelta(days=30)
    future_end = datetime.now() + timedelta(days=60)
    
    future_data = {
        "start_date": future_start.isoformat() + "Z",
        "end_date": future_end.isoformat() + "Z"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/analytics/sales", json=future_data)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Future date range handled gracefully: {data['total_sales']} sales, {data['total_transactions']} transactions")
        else:
            print(f"⚠️  Unexpected response: HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing future dates: {e}")

def test_very_long_medicine_id():
    """Test with very long medicine ID"""
    print("\nTesting very long medicine ID...")
    
    long_id = "a" * 1000  # Very long ID
    
    try:
        response = requests.get(f"{BACKEND_URL}/analytics/medicine-sales/{long_id}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Long medicine ID handled: {len(data['sales_history'])} records")
        else:
            print(f"⚠️  Long ID response: HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing long ID: {e}")

def test_negative_days_parameter():
    """Test with negative days parameter"""
    print("\nTesting negative days parameter...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/analytics/medicines-sold-summary?days=-10")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Negative days handled: period_days = {data.get('period_days', 'N/A')}")
        else:
            print(f"⚠️  Negative days response: HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing negative days: {e}")

def test_zero_days_parameter():
    """Test with zero days parameter"""
    print("\nTesting zero days parameter...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/analytics/stock-history/test-med?days=0")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Zero days handled: {len(data['stock_movements'])} movements")
        else:
            print(f"⚠️  Zero days response: HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing zero days: {e}")

def test_special_characters_in_medicine_id():
    """Test with special characters in medicine ID"""
    print("\nTesting special characters in medicine ID...")
    
    special_ids = [
        "med-with-spaces and symbols!@#",
        "med/with/slashes",
        "med%20encoded",
        "med-with-unicode-ñáéíóú"
    ]
    
    for med_id in special_ids:
        try:
            response = requests.get(f"{BACKEND_URL}/analytics/medicine-sales/{med_id}")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Special ID '{med_id[:20]}...' handled: {len(data['sales_history'])} records")
            else:
                print(f"⚠️  Special ID '{med_id[:20]}...' response: HTTP {response.status_code}")
        except Exception as e:
            print(f"❌ Error with special ID '{med_id[:20]}...': {e}")

def test_large_days_parameter():
    """Test with very large days parameter"""
    print("\nTesting very large days parameter...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/analytics/medicines-sold-summary?days=999999")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Large days parameter handled: period_days = {data.get('period_days', 'N/A')}")
        else:
            print(f"⚠️  Large days response: HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing large days: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("MediPOS RMS Backend Edge Case Tests")
    print("=" * 60)
    
    test_invalid_date_formats()
    test_future_date_range()
    test_very_long_medicine_id()
    test_negative_days_parameter()
    test_zero_days_parameter()
    test_special_characters_in_medicine_id()
    test_large_days_parameter()
    
    print("\n" + "=" * 60)
    print("Edge case testing completed!")
    print("=" * 60)