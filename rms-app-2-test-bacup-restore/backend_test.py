#!/usr/bin/env python3
"""
MediPOS RMS Backend Analytics API Test Suite
Tests all backend endpoints including comprehensive analytics functionality
"""

import requests
import json
from datetime import datetime, timedelta
import uuid
import time

# Backend URL - using localhost since public URL routing has issues
BACKEND_URL = "http://localhost:8001/api"

class MediPOSBackendTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.test_results = []
        self.medicine_ids = []
        self.sale_ids = []
        self.backup_ids = []
        
    def log_test(self, test_name, success, message, response_data=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        if response_data:
            result["response_data"] = response_data
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if response_data and not success:
            print(f"   Response: {response_data}")
    
    def test_root_endpoint(self):
        """Test the root API endpoint"""
        try:
            response = requests.get(f"{self.base_url}/")
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "MediPOS" in data["message"]:
                    self.log_test("Root Endpoint", True, "Root endpoint working correctly", data)
                    return True
                else:
                    self.log_test("Root Endpoint", False, "Unexpected response format", data)
                    return False
            else:
                self.log_test("Root Endpoint", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Root Endpoint", False, f"Connection error: {str(e)}")
            return False
    
    def test_status_endpoints(self):
        """Test status check endpoints"""
        try:
            # Test POST /api/status
            status_data = {
                "client_name": "MediPOS Terminal 1"
            }
            
            response = requests.post(f"{self.base_url}/status", json=status_data)
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "client_name" in data and data["client_name"] == "MediPOS Terminal 1":
                    self.log_test("POST Status", True, "Status creation working correctly", data)
                    post_success = True
                else:
                    self.log_test("POST Status", False, "Invalid response format", data)
                    post_success = False
            else:
                self.log_test("POST Status", False, f"HTTP {response.status_code}", response.text)
                post_success = False
            
            # Test GET /api/status
            response = requests.get(f"{self.base_url}/status")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("GET Status", True, f"Retrieved {len(data)} status checks", {"count": len(data)})
                    get_success = True
                else:
                    self.log_test("GET Status", False, "Response is not a list", data)
                    get_success = False
            else:
                self.log_test("GET Status", False, f"HTTP {response.status_code}", response.text)
                get_success = False
                
            return post_success and get_success
            
        except Exception as e:
            self.log_test("Status Endpoints", False, f"Connection error: {str(e)}")
            return False
    
    def test_sales_analytics_endpoint(self):
        """Test POST /api/analytics/sales endpoint"""
        try:
            # Test with a date range (last 30 days)
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
            
            analytics_data = {
                "start_date": start_date.isoformat() + "Z",
                "end_date": end_date.isoformat() + "Z"
            }
            
            response = requests.post(f"{self.base_url}/analytics/sales", json=analytics_data)
            if response.status_code == 200:
                data = response.json()
                required_fields = ["total_sales", "total_transactions", "total_items_sold", 
                                 "top_selling_medicines", "daily_sales", "payment_method_breakdown", 
                                 "hourly_sales_pattern"]
                
                missing_fields = [field for field in required_fields if field not in data]
                if not missing_fields:
                    self.log_test("Sales Analytics", True, 
                                f"Analytics endpoint working - Total sales: ${data['total_sales']}, Transactions: {data['total_transactions']}", 
                                {"total_sales": data["total_sales"], "total_transactions": data["total_transactions"]})
                    return True
                else:
                    self.log_test("Sales Analytics", False, f"Missing fields: {missing_fields}", data)
                    return False
            else:
                self.log_test("Sales Analytics", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Sales Analytics", False, f"Connection error: {str(e)}")
            return False
    
    def test_medicine_sales_history_endpoint(self):
        """Test GET /api/analytics/medicine-sales/{medicine_id} endpoint"""
        try:
            # Use a sample medicine ID
            test_medicine_id = "med-" + str(uuid.uuid4())[:8]
            
            response = requests.get(f"{self.base_url}/analytics/medicine-sales/{test_medicine_id}")
            if response.status_code == 200:
                data = response.json()
                if "medicine_id" in data and "sales_history" in data:
                    if data["medicine_id"] == test_medicine_id and isinstance(data["sales_history"], list):
                        self.log_test("Medicine Sales History", True, 
                                    f"Medicine sales history working - {len(data['sales_history'])} records found", 
                                    {"medicine_id": test_medicine_id, "records_count": len(data["sales_history"])})
                        return True
                    else:
                        self.log_test("Medicine Sales History", False, "Invalid response structure", data)
                        return False
                else:
                    self.log_test("Medicine Sales History", False, "Missing required fields", data)
                    return False
            else:
                self.log_test("Medicine Sales History", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Medicine Sales History", False, f"Connection error: {str(e)}")
            return False
    
    def test_stock_history_endpoint(self):
        """Test GET /api/analytics/stock-history/{medicine_id} endpoint"""
        try:
            # Use a sample medicine ID
            test_medicine_id = "med-" + str(uuid.uuid4())[:8]
            
            response = requests.get(f"{self.base_url}/analytics/stock-history/{test_medicine_id}")
            if response.status_code == 200:
                data = response.json()
                if "medicine_id" in data and "stock_movements" in data:
                    if data["medicine_id"] == test_medicine_id and isinstance(data["stock_movements"], list):
                        self.log_test("Stock Movement History", True, 
                                    f"Stock history working - {len(data['stock_movements'])} movements found", 
                                    {"medicine_id": test_medicine_id, "movements_count": len(data["stock_movements"])})
                        return True
                    else:
                        self.log_test("Stock Movement History", False, "Invalid response structure", data)
                        return False
                else:
                    self.log_test("Stock Movement History", False, "Missing required fields", data)
                    return False
            else:
                self.log_test("Stock Movement History", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Stock Movement History", False, f"Connection error: {str(e)}")
            return False
    
    def test_medicines_sold_summary_endpoint(self):
        """Test GET /api/analytics/medicines-sold-summary endpoint"""
        try:
            response = requests.get(f"{self.base_url}/analytics/medicines-sold-summary")
            if response.status_code == 200:
                data = response.json()
                if "period_days" in data and "medicines_summary" in data:
                    if isinstance(data["medicines_summary"], list) and data["period_days"] == 30:
                        self.log_test("Medicines Sold Summary", True, 
                                    f"Medicines summary working - {len(data['medicines_summary'])} medicines in summary", 
                                    {"period_days": data["period_days"], "medicines_count": len(data["medicines_summary"])})
                        return True
                    else:
                        self.log_test("Medicines Sold Summary", False, "Invalid response structure", data)
                        return False
                else:
                    self.log_test("Medicines Sold Summary", False, "Missing required fields", data)
                    return False
            else:
                self.log_test("Medicines Sold Summary", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Medicines Sold Summary", False, f"Connection error: {str(e)}")
            return False
    
    def test_shop_endpoints(self):
        """Test shop management endpoints (GET and PUT /api/shop)"""
        try:
            # Test GET /api/shop (should return empty shop or existing shop)
            response = requests.get(f"{self.base_url}/shop")
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "name", "address", "phone", "email", "license_number", "gst_number"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    self.log_test("GET Shop", True, 
                                f"Shop GET endpoint working - Shop name: '{data.get('name', 'Not set')}'", 
                                {"shop_name": data.get("name"), "has_data": bool(data.get("name"))})
                    get_success = True
                else:
                    self.log_test("GET Shop", False, f"Missing fields in response: {missing_fields}", data)
                    get_success = False
            else:
                self.log_test("GET Shop", False, f"HTTP {response.status_code}", response.text)
                get_success = False
            
            # Test PUT /api/shop (update shop details)
            test_shop_data = {
                "name": "Test Medical Store",
                "address": "123 Health Street, Medical City",
                "phone": "555-0123",
                "email": "info@testmedical.com",
                "license_number": "MED123456",
                "gst_number": "GST987654321"
            }
            
            response = requests.put(f"{self.base_url}/shop", json=test_shop_data)
            if response.status_code == 200:
                data = response.json()
                # Check if the response contains the updated data
                if (data.get("name") == test_shop_data["name"] and 
                    data.get("phone") == test_shop_data["phone"] and
                    data.get("address") == test_shop_data["address"]):
                    self.log_test("PUT Shop", True, 
                                f"Shop PUT endpoint working - Updated shop: '{data.get('name')}'", 
                                {"updated_name": data.get("name"), "updated_phone": data.get("phone")})
                    put_success = True
                else:
                    self.log_test("PUT Shop", False, "Shop data not updated correctly", data)
                    put_success = False
            else:
                self.log_test("PUT Shop", False, f"HTTP {response.status_code}", response.text)
                put_success = False
            
            # Test GET again to verify persistence
            response = requests.get(f"{self.base_url}/shop")
            if response.status_code == 200:
                data = response.json()
                if data.get("name") == test_shop_data["name"]:
                    self.log_test("Shop Data Persistence", True, 
                                "Shop data persisted correctly after update", 
                                {"persisted_name": data.get("name")})
                    persistence_success = True
                else:
                    self.log_test("Shop Data Persistence", False, 
                                f"Shop data not persisted - Expected: '{test_shop_data['name']}', Got: '{data.get('name')}'", 
                                data)
                    persistence_success = False
            else:
                self.log_test("Shop Data Persistence", False, f"HTTP {response.status_code}", response.text)
                persistence_success = False
                
            return get_success and put_success and persistence_success
            
        except Exception as e:
            self.log_test("Shop Endpoints", False, f"Connection error: {str(e)}")
            return False
    
    def test_analytics_with_custom_parameters(self):
        """Test analytics endpoints with custom parameters"""
        try:
            # Test medicine sales history with custom days parameter
            test_medicine_id = "paracetamol-500mg"
            response = requests.get(f"{self.base_url}/analytics/medicine-sales/{test_medicine_id}?days=7")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Medicine Sales (7 days)", True, "Custom days parameter working", 
                            {"medicine_id": test_medicine_id, "records": len(data.get("sales_history", []))})
                param_test_1 = True
            else:
                self.log_test("Medicine Sales (7 days)", False, f"HTTP {response.status_code}", response.text)
                param_test_1 = False
            
            # Test stock history with custom days parameter
            response = requests.get(f"{self.base_url}/analytics/stock-history/{test_medicine_id}?days=14")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Stock History (14 days)", True, "Custom days parameter working", 
                            {"medicine_id": test_medicine_id, "movements": len(data.get("stock_movements", []))})
                param_test_2 = True
            else:
                self.log_test("Stock History (14 days)", False, f"HTTP {response.status_code}", response.text)
                param_test_2 = False
            
            # Test medicines summary with custom days parameter
            response = requests.get(f"{self.base_url}/analytics/medicines-sold-summary?days=60")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("period_days") == 60:
                    self.log_test("Medicines Summary (60 days)", True, "Custom days parameter working", 
                                {"period_days": data["period_days"], "medicines": len(data.get("medicines_summary", []))})
                    param_test_3 = True
                else:
                    self.log_test("Medicines Summary (60 days)", False, "Days parameter not applied correctly", data)
                    param_test_3 = False
            else:
                self.log_test("Medicines Summary (60 days)", False, f"HTTP {response.status_code}", response.text)
                param_test_3 = False
                
            return param_test_1 and param_test_2 and param_test_3
            
        except Exception as e:
            self.log_test("Custom Parameters Test", False, f"Connection error: {str(e)}")
            return False
    
    def test_tally_import_endpoints(self):
        """Test Tally import endpoints"""
        try:
            # Test 1: Upload and preview CSV file
            csv_content = """Medicine Name,Price,Stock Quantity,Supplier,Batch Number,Expiry Date,Barcode,Category
Test Medicine 1,25.50,100,Test Supplier,B001,2025-12-31,1234567890123,Pain Relief
Test Medicine 2,45.75,50,Test Pharma,B002,2026-03-15,2345678901234,Antibiotics"""
            
            files = {'file': ('test_data.csv', csv_content, 'text/csv')}
            response = requests.post(f"{self.base_url}/tally/upload-preview", files=files)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["total_records", "valid_records", "invalid_records", "duplicates_found", "medicines", "import_summary", "field_mappings"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    self.log_test("Tally Upload Preview", True, 
                                f"CSV preview working - {data['total_records']} records, {data['valid_records']} valid", 
                                {"total_records": data["total_records"], "valid_records": data["valid_records"]})
                    preview_success = True
                else:
                    self.log_test("Tally Upload Preview", False, f"Missing fields: {missing_fields}", data)
                    preview_success = False
            else:
                self.log_test("Tally Upload Preview", False, f"HTTP {response.status_code}", response.text)
                preview_success = False
            
            # Test 2: Import CSV file
            files = {'file': ('test_data.csv', csv_content, 'text/csv')}
            data = {
                'duplicate_handling': 'skip',
                'validation_strict': 'true'
            }
            response = requests.post(f"{self.base_url}/tally/import", files=files, data=data)
            
            if response.status_code == 200:
                result = response.json()
                required_fields = ["success", "total_processed", "imported", "skipped", "errors", "duplicates_handled", "error_details", "import_id"]
                missing_fields = [field for field in required_fields if field not in result]
                
                if not missing_fields:
                    self.log_test("Tally Import", True, 
                                f"CSV import working - {result['imported']} imported, {result['skipped']} skipped", 
                                {"imported": result["imported"], "skipped": result["skipped"], "success": result["success"]})
                    import_success = True
                else:
                    self.log_test("Tally Import", False, f"Missing fields: {missing_fields}", result)
                    import_success = False
            else:
                self.log_test("Tally Import", False, f"HTTP {response.status_code}", response.text)
                import_success = False
            
            # Test 3: Import history
            response = requests.get(f"{self.base_url}/tally/import-history")
            
            if response.status_code == 200:
                data = response.json()
                if "imports" in data and isinstance(data["imports"], list):
                    self.log_test("Tally Import History", True, 
                                f"Import history working - {len(data['imports'])} import records found", 
                                {"import_count": len(data["imports"])})
                    history_success = True
                else:
                    self.log_test("Tally Import History", False, "Invalid response format", data)
                    history_success = False
            else:
                self.log_test("Tally Import History", False, f"HTTP {response.status_code}", response.text)
                history_success = False
            
            return preview_success and import_success and history_success
            
        except Exception as e:
            self.log_test("Tally Import Endpoints", False, f"Connection error: {str(e)}")
            return False
    
    def test_tally_import_error_handling(self):
        """Test Tally import error handling"""
        try:
            # Test 1: Invalid file type
            invalid_content = "This is not a valid CSV or XML file"
            files = {'file': ('test.txt', invalid_content, 'text/plain')}
            response = requests.post(f"{self.base_url}/tally/upload-preview", files=files)
            
            if response.status_code == 400:
                self.log_test("Invalid File Type", True, "Correctly rejected invalid file type", {"status_code": 400})
                invalid_file_test = True
            else:
                self.log_test("Invalid File Type", False, f"Expected 400, got {response.status_code}", response.text)
                invalid_file_test = False
            
            # Test 2: Empty file
            files = {'file': ('empty.csv', '', 'text/csv')}
            response = requests.post(f"{self.base_url}/tally/upload-preview", files=files)
            
            if response.status_code == 400:
                self.log_test("Empty File", True, "Correctly rejected empty file", {"status_code": 400})
                empty_file_test = True
            else:
                self.log_test("Empty File", False, f"Expected 400, got {response.status_code}", response.text)
                empty_file_test = False
            
            # Test 3: Malformed CSV
            malformed_csv = "Medicine Name,Price\nTest Medicine,invalid_price"
            files = {'file': ('malformed.csv', malformed_csv, 'text/csv')}
            response = requests.post(f"{self.base_url}/tally/upload-preview", files=files)
            
            if response.status_code == 200:
                data = response.json()
                # Should have some invalid records or warnings
                has_issues = (data.get("invalid_records", 0) > 0 or 
                             any(med.get("status") in ["warning", "error"] for med in data.get("medicines", [])))
                if has_issues:
                    self.log_test("Malformed Data Handling", True, 
                                f"Correctly handled malformed data - detected issues in data", 
                                {"invalid_records": data["invalid_records"], "has_warnings": has_issues})
                    malformed_test = True
                else:
                    self.log_test("Malformed Data Handling", False, "Should have detected invalid records or warnings", data)
                    malformed_test = False
            else:
                self.log_test("Malformed Data Handling", False, f"HTTP {response.status_code}", response.text)
                malformed_test = False
            
            return invalid_file_test and empty_file_test and malformed_test
            
        except Exception as e:
            self.log_test("Tally Import Error Handling", False, f"Connection error: {str(e)}")
            return False
    
    def test_backup_create_endpoint(self):
        """Test POST /api/backup/create endpoint"""
        try:
            # Test creating a backup with different data selection options
            backup_options = {
                "include_medicines": True,
                "include_sales": True,
                "include_stock_movements": True,
                "include_shop_details": True,
                "include_import_logs": True,
                "include_status_checks": False,
                "backup_name": "Test Backup " + datetime.now().strftime("%Y%m%d_%H%M%S")
            }
            
            response = requests.post(f"{self.base_url}/backup/create", json=backup_options)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["success", "backup_id", "backup_name", "total_records", "file_size", "data_categories"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields and data.get("success"):
                    self.backup_ids.append(data["backup_id"])  # Store for later tests
                    self.log_test("Create Backup", True, 
                                f"Backup created successfully - ID: {data['backup_id']}, Records: {data['total_records']}", 
                                {"backup_id": data["backup_id"], "total_records": data["total_records"]})
                    return True
                else:
                    self.log_test("Create Backup", False, f"Missing fields or failed: {missing_fields}", data)
                    return False
            else:
                self.log_test("Create Backup", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Create Backup", False, f"Connection error: {str(e)}")
            return False
    
    def test_backup_list_endpoint(self):
        """Test GET /api/backup/list endpoint"""
        try:
            response = requests.get(f"{self.base_url}/backup/list")
            
            if response.status_code == 200:
                data = response.json()
                if "backups" in data and isinstance(data["backups"], list):
                    self.log_test("List Backups", True, 
                                f"Backup list retrieved - {len(data['backups'])} backups found", 
                                {"backup_count": len(data["backups"])})
                    return True
                else:
                    self.log_test("List Backups", False, "Invalid response format", data)
                    return False
            else:
                self.log_test("List Backups", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("List Backups", False, f"Connection error: {str(e)}")
            return False
    
    def test_backup_preview_endpoint(self):
        """Test GET /api/backup/preview/{backup_id} endpoint"""
        try:
            if not self.backup_ids:
                self.log_test("Preview Backup", False, "No backup ID available for testing")
                return False
            
            backup_id = self.backup_ids[0]
            response = requests.get(f"{self.base_url}/backup/preview/{backup_id}")
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["metadata", "data_summary", "categories_available"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    self.log_test("Preview Backup", True, 
                                f"Backup preview retrieved - Categories: {len(data['categories_available'])}", 
                                {"categories": data["categories_available"], "data_summary": data["data_summary"]})
                    return True
                else:
                    self.log_test("Preview Backup", False, f"Missing fields: {missing_fields}", data)
                    return False
            elif response.status_code == 404:
                self.log_test("Preview Backup", False, "Backup not found", {"backup_id": backup_id})
                return False
            else:
                self.log_test("Preview Backup", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Preview Backup", False, f"Connection error: {str(e)}")
            return False
    
    def test_backup_download_endpoint(self):
        """Test GET /api/backup/download/{backup_id} endpoint"""
        try:
            if not self.backup_ids:
                self.log_test("Download Backup", False, "No backup ID available for testing")
                return False
            
            backup_id = self.backup_ids[0]
            response = requests.get(f"{self.base_url}/backup/download/{backup_id}")
            
            if response.status_code == 200:
                # Check if response is JSON content
                content_type = response.headers.get('content-type', '')
                if 'application/json' in content_type:
                    # Try to parse as JSON to verify it's valid backup data
                    try:
                        backup_data = response.json()
                        if "metadata" in backup_data and "data" in backup_data:
                            self.log_test("Download Backup", True, 
                                        f"Backup downloaded successfully - Size: {len(response.content)} bytes", 
                                        {"content_size": len(response.content), "has_metadata": True})
                            return True
                        else:
                            self.log_test("Download Backup", False, "Invalid backup file structure", backup_data)
                            return False
                    except json.JSONDecodeError:
                        self.log_test("Download Backup", False, "Response is not valid JSON")
                        return False
                else:
                    self.log_test("Download Backup", False, f"Unexpected content type: {content_type}")
                    return False
            elif response.status_code == 404:
                self.log_test("Download Backup", False, "Backup not found", {"backup_id": backup_id})
                return False
            else:
                self.log_test("Download Backup", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Download Backup", False, f"Connection error: {str(e)}")
            return False
    
    def test_backup_restore_endpoint(self):
        """Test POST /api/backup/restore endpoint"""
        try:
            if not self.backup_ids:
                self.log_test("Restore Backup", False, "No backup ID available for testing")
                return False
            
            backup_id = self.backup_ids[0]
            restore_options = {
                "backup_id": backup_id,
                "include_medicines": True,
                "include_sales": True,
                "include_stock_movements": True,
                "include_shop_details": True,
                "include_import_logs": True,
                "include_status_checks": False,
                "clear_existing_data": False  # Don't clear existing data for safety
            }
            
            response = requests.post(f"{self.base_url}/backup/restore", json=restore_options)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["success", "restored_records", "errors", "restore_id"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    total_restored = sum(data["restored_records"].values()) if data["restored_records"] else 0
                    self.log_test("Restore Backup", True, 
                                f"Backup restored - Records: {total_restored}, Errors: {len(data['errors'])}", 
                                {"restored_records": data["restored_records"], "error_count": len(data["errors"])})
                    return True
                else:
                    self.log_test("Restore Backup", False, f"Missing fields: {missing_fields}", data)
                    return False
            elif response.status_code == 404:
                self.log_test("Restore Backup", False, "Backup not found", {"backup_id": backup_id})
                return False
            else:
                self.log_test("Restore Backup", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Restore Backup", False, f"Connection error: {str(e)}")
            return False
    
    def test_backup_upload_endpoint(self):
        """Test POST /api/backup/upload endpoint"""
        try:
            # Create a simple backup file for testing
            test_backup_data = {
                "metadata": {
                    "id": str(uuid.uuid4()),
                    "name": "Test Upload Backup",
                    "created_at": datetime.now().isoformat(),
                    "data_categories": ["medicines"],
                    "version": "1.0"
                },
                "data": {
                    "medicines": [
                        {
                            "id": str(uuid.uuid4()),
                            "name": "Test Upload Medicine",
                            "price": 10.0,
                            "stock_quantity": 100,
                            "expiry_date": "2025-12-31",
                            "batch_number": "TEST001",
                            "supplier": "Test Supplier",
                            "created_at": datetime.now().isoformat(),
                            "updated_at": datetime.now().isoformat()
                        }
                    ]
                }
            }
            
            backup_json = json.dumps(test_backup_data, indent=2)
            files = {'file': ('test_backup.json', backup_json, 'application/json')}
            
            response = requests.post(f"{self.base_url}/backup/upload", files=files)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["success", "backup_id", "message", "name", "data_categories"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields and data.get("success"):
                    self.backup_ids.append(data["backup_id"])  # Store for cleanup
                    self.log_test("Upload Backup", True, 
                                f"Backup uploaded successfully - ID: {data['backup_id']}", 
                                {"backup_id": data["backup_id"], "name": data["name"]})
                    return True
                else:
                    self.log_test("Upload Backup", False, f"Missing fields or failed: {missing_fields}", data)
                    return False
            else:
                self.log_test("Upload Backup", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Upload Backup", False, f"Connection error: {str(e)}")
            return False
    
    def test_backup_delete_endpoint(self):
        """Test DELETE /api/backup/{backup_id} endpoint"""
        try:
            if not self.backup_ids:
                self.log_test("Delete Backup", False, "No backup ID available for testing")
                return False
            
            # Use the last backup ID for deletion (keep first one for other tests)
            backup_id = self.backup_ids[-1] if len(self.backup_ids) > 1 else self.backup_ids[0]
            response = requests.delete(f"{self.base_url}/backup/{backup_id}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("Delete Backup", True, 
                                f"Backup deleted successfully - ID: {backup_id}", 
                                {"backup_id": backup_id})
                    # Remove from our list
                    if backup_id in self.backup_ids:
                        self.backup_ids.remove(backup_id)
                    return True
                else:
                    self.log_test("Delete Backup", False, "Delete operation failed", data)
                    return False
            elif response.status_code == 404:
                self.log_test("Delete Backup", False, "Backup not found", {"backup_id": backup_id})
                return False
            else:
                self.log_test("Delete Backup", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Delete Backup", False, f"Connection error: {str(e)}")
            return False
    
    def test_backup_edge_cases(self):
        """Test backup and restore edge cases"""
        try:
            # Test 1: Create backup with empty database (no data selected)
            empty_backup_options = {
                "include_medicines": False,
                "include_sales": False,
                "include_stock_movements": False,
                "include_shop_details": False,
                "include_import_logs": False,
                "include_status_checks": False,
                "backup_name": "Empty Backup Test"
            }
            
            response = requests.post(f"{self.base_url}/backup/create", json=empty_backup_options)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("total_records") == 0:
                    self.log_test("Empty Backup Creation", True, 
                                "Successfully created backup with no data", 
                                {"total_records": data["total_records"]})
                    empty_backup_test = True
                    # Clean up
                    if data.get("backup_id"):
                        requests.delete(f"{self.base_url}/backup/{data['backup_id']}")
                else:
                    self.log_test("Empty Backup Creation", False, "Unexpected response for empty backup", data)
                    empty_backup_test = False
            else:
                self.log_test("Empty Backup Creation", False, f"HTTP {response.status_code}", response.text)
                empty_backup_test = False
            
            # Test 2: Invalid backup ID for preview
            invalid_id = "invalid-backup-id-123"
            response = requests.get(f"{self.base_url}/backup/preview/{invalid_id}")
            
            if response.status_code == 404:
                self.log_test("Invalid Backup ID", True, 
                            "Correctly returned 404 for invalid backup ID", 
                            {"status_code": 404})
                invalid_id_test = True
            else:
                self.log_test("Invalid Backup ID", False, f"Expected 404, got {response.status_code}", response.text)
                invalid_id_test = False
            
            # Test 3: Upload invalid backup file
            invalid_backup = {"invalid": "structure"}
            files = {'file': ('invalid_backup.json', json.dumps(invalid_backup), 'application/json')}
            response = requests.post(f"{self.base_url}/backup/upload", files=files)
            
            if response.status_code == 400:
                self.log_test("Invalid Backup Upload", True, 
                            "Correctly rejected invalid backup file structure", 
                            {"status_code": 400})
                invalid_upload_test = True
            else:
                self.log_test("Invalid Backup Upload", False, f"Expected 400, got {response.status_code}", response.text)
                invalid_upload_test = False
            
            return empty_backup_test and invalid_id_test and invalid_upload_test
            
        except Exception as e:
            self.log_test("Backup Edge Cases", False, f"Connection error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("=" * 60)
        print("MediPOS RMS Backend Analytics API Test Suite")
        print("=" * 60)
        print(f"Testing backend at: {self.base_url}")
        print()
        
        # Run all tests
        tests = [
            ("Basic Endpoints", [
                self.test_root_endpoint,
                self.test_status_endpoints
            ]),
            ("Shop Management", [
                self.test_shop_endpoints
            ]),
            ("Analytics Endpoints", [
                self.test_sales_analytics_endpoint,
                self.test_medicine_sales_history_endpoint,
                self.test_stock_history_endpoint,
                self.test_medicines_sold_summary_endpoint
            ]),
            ("Parameter Testing", [
                self.test_analytics_with_custom_parameters
            ]),
            ("Tally Import", [
                self.test_tally_import_endpoints,
                self.test_tally_import_error_handling
            ]),
            ("Backup & Restore", [
                self.test_backup_create_endpoint,
                self.test_backup_list_endpoint,
                self.test_backup_preview_endpoint,
                self.test_backup_download_endpoint,
                self.test_backup_upload_endpoint,
                self.test_backup_restore_endpoint,
                self.test_backup_delete_endpoint,
                self.test_backup_edge_cases
            ])
        ]
        
        total_tests = 0
        passed_tests = 0
        
        for category, test_functions in tests:
            print(f"\n--- {category} ---")
            for test_func in test_functions:
                total_tests += 1
                if test_func():
                    passed_tests += 1
                time.sleep(0.5)  # Small delay between tests
        
        # Print summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Print detailed results
        print("\nDETAILED RESULTS:")
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
        
        return passed_tests == total_tests

if __name__ == "__main__":
    tester = MediPOSBackendTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed! Backend is working correctly.")
    else:
        print("\n⚠️  Some tests failed. Check the detailed results above.")