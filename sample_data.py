#!/usr/bin/env python3
import asyncio
import requests
import json
from datetime import datetime, date, timedelta

BACKEND_URL = "https://3e3068ca-db01-489b-8e1f-90b944303913.preview.emergentagent.com/api"

async def add_sample_data():
    print("Adding sample data to the Medicine POS system...")
    
    # Sample medicines data
    medicines = [
        {
            "name": "Paracetamol 500mg",
            "price": 25.00,
            "stock_quantity": 150,
            "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
            "batch_number": "PAR001",
            "supplier": "Cipla Pharmaceuticals",
            "barcode": "8901234567890"
        },
        {
            "name": "Amoxicillin 250mg",
            "price": 65.00,
            "stock_quantity": 80,
            "expiry_date": (date.today() + timedelta(days=300)).isoformat(),
            "batch_number": "AMX002",
            "supplier": "Sun Pharma",
            "barcode": "8901234567891"
        },
        {
            "name": "Crocin Advance",
            "price": 45.00,
            "stock_quantity": 200,
            "expiry_date": (date.today() + timedelta(days=400)).isoformat(),
            "batch_number": "CRC003",
            "supplier": "GSK Pharma",
            "barcode": "8901234567892"
        },
        {
            "name": "Dolo 650mg",
            "price": 35.00,
            "stock_quantity": 120,
            "expiry_date": (date.today() + timedelta(days=350)).isoformat(),
            "batch_number": "DLO004",
            "supplier": "Micro Labs",
            "barcode": "8901234567893"
        },
        {
            "name": "Disprin Tablets",
            "price": 15.00,
            "stock_quantity": 90,
            "expiry_date": (date.today() + timedelta(days=280)).isoformat(),
            "batch_number": "DSP005",
            "supplier": "Reckitt Benckiser",
            "barcode": "8901234567894"
        },
        {
            "name": "Cetirizine 10mg",
            "price": 40.00,
            "stock_quantity": 75,
            "expiry_date": (date.today() + timedelta(days=320)).isoformat(),
            "batch_number": "CET006",
            "supplier": "Dr. Reddy's Labs",
            "barcode": "8901234567895"
        },
        {
            "name": "Omeprazole 20mg",
            "price": 85.00,
            "stock_quantity": 60,
            "expiry_date": (date.today() + timedelta(days=290)).isoformat(),
            "batch_number": "OMP007",
            "supplier": "Lupin Pharmaceuticals",
            "barcode": "8901234567896"
        },
        {
            "name": "Vitamin D3 Tablets",
            "price": 95.00,
            "stock_quantity": 55,
            "expiry_date": (date.today() + timedelta(days=450)).isoformat(),
            "batch_number": "VD3008",
            "supplier": "Abbott Healthcare",
            "barcode": "8901234567897"
        },
        {
            "name": "Azithromycin 500mg",
            "price": 120.00,
            "stock_quantity": 45,
            "expiry_date": (date.today() + timedelta(days=275)).isoformat(),
            "batch_number": "AZI009",
            "supplier": "Zydus Cadila",
            "barcode": "8901234567898"
        },
        {
            "name": "Digene Tablets",
            "price": 30.00,
            "stock_quantity": 8,  # Low stock to demonstrate warning
            "expiry_date": (date.today() + timedelta(days=200)).isoformat(),
            "batch_number": "DIG010",
            "supplier": "Abbott Healthcare",
            "barcode": "8901234567899"
        }
    ]
    
    # Add medicines
    for medicine in medicines:
        try:
            response = requests.post(f"{BACKEND_URL}/medicines", json=medicine)
            if response.status_code == 200:
                print(f"✅ Added medicine: {medicine['name']}")
            else:
                print(f"❌ Failed to add medicine: {medicine['name']} - {response.text}")
        except Exception as e:
            print(f"❌ Error adding medicine {medicine['name']}: {str(e)}")
    
    # Sample users data
    users = [
        {
            "username": "admin",
            "password": "admin123",
            "role": "admin",
            "permissions": {
                "can_modify_stock": True,
                "can_block_backdate": True,
                "can_manage_users": True,
                "can_view_reports": True
            }
        },
        {
            "username": "manager1",
            "password": "manager123",
            "role": "manager",
            "permissions": {
                "can_modify_stock": True,
                "can_block_backdate": False,
                "can_manage_users": False,
                "can_view_reports": True
            }
        },
        {
            "username": "cashier1",
            "password": "cashier123",
            "role": "cashier",
            "permissions": {
                "can_modify_stock": False,
                "can_block_backdate": False,
                "can_manage_users": False,
                "can_view_reports": False
            }
        }
    ]
    
    # Add users
    for user in users:
        try:
            response = requests.post(f"{BACKEND_URL}/users", json=user)
            if response.status_code == 200:
                print(f"✅ Added user: {user['username']} ({user['role']})")
            else:
                print(f"❌ Failed to add user: {user['username']} - {response.text}")
        except Exception as e:
            print(f"❌ Error adding user {user['username']}: {str(e)}")
    
    # Sample shop details
    shop_details = {
        "name": "MediCare Pharmacy",
        "address": "123 Health Street, Medical District, City - 110001",
        "phone": "+91-9876543210",
        "email": "info@medicare.com",
        "license_number": "DL-12345-2024",
        "gst_number": "27AABCU9603R1ZM"
    }
    
    # Add shop details
    try:
        response = requests.post(f"{BACKEND_URL}/shop", json=shop_details)
        if response.status_code == 200:
            print(f"✅ Added shop details: {shop_details['name']}")
        else:
            print(f"❌ Failed to add shop details - {response.text}")
    except Exception as e:
        print(f"❌ Error adding shop details: {str(e)}")
    
    print("\n🎉 Sample data setup completed!")
    print("\nYour Medicine POS System is now ready with:")
    print(f"📦 {len(medicines)} sample medicines")
    print(f"👥 {len(users)} sample users")
    print("🏪 Shop details configured")
    print("\nYou can now:")
    print("• Use the POS system to process sales")
    print("• View inventory with low stock alerts")
    print("• Check sales analytics")
    print("• Manage users and permissions")
    
    print("\nKeyboard Shortcuts:")
    print("• Alt+P: Switch to POS")
    print("• Alt+I: Switch to Inventory")
    print("• Alt+S: Switch to Sales Analytics")
    print("• Alt+U: Switch to User Management")
    print("• F1: Focus on search")
    print("• F2: Checkout (when cart has items)")

if __name__ == "__main__":
    asyncio.run(add_sample_data())