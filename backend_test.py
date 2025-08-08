import requests
import sys
import json
from datetime import datetime, date
import uuid

class MediPOSAPITester:
    def __init__(self, base_url="https://2bfda845-a0ce-4285-9cfc-8db8b1d4df41.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_token = None
        self.manager_token = None
        self.cashier_token = None
        self.test_user_ids = []
        self.tests_run = 0
        self.tests_passed = 0
        self.session = requests.Session()

    def log_test(self, name, success, message=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED {message}")
        else:
            print(f"❌ {name}: FAILED {message}")
        return success

    def make_request(self, method, endpoint, data=None, token=None, expected_status=None):
        """Make HTTP request with proper error handling"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers)
            else:
                return False, {"error": "Invalid method"}

            if expected_status and response.status_code != expected_status:
                return False, {
                    "error": f"Expected status {expected_status}, got {response.status_code}",
                    "response": response.text
                }

            try:
                return True, response.json()
            except:
                return response.status_code < 400, {"status_code": response.status_code, "text": response.text}

        except Exception as e:
            return False, {"error": str(e)}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.make_request('GET', '', expected_status=200)
        return self.log_test(
            "Root API Endpoint", 
            success and "Medicine Sales" in str(response),
            f"Response: {response}"
        )

    def test_admin_login(self):
        """Test admin login with default credentials"""
        login_data = {
            "username": "admin",
            "password": "admin123",
            "remember_me": False
        }
        
        success, response = self.make_request('POST', 'auth/login', login_data, expected_status=200)
        
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            return self.log_test(
                "Admin Login", 
                True,
                f"Token received, user role: {response.get('user', {}).get('role')}"
            )
        else:
            return self.log_test("Admin Login", False, f"Response: {response}")

    def test_admin_login_with_remember_me(self):
        """Test admin login with remember me option"""
        login_data = {
            "username": "admin",
            "password": "admin123",
            "remember_me": True
        }
        
        success, response = self.make_request('POST', 'auth/login', login_data, expected_status=200)
        return self.log_test(
            "Admin Login with Remember Me", 
            success and 'access_token' in response,
            f"Remember me functionality: {'Working' if success else 'Failed'}"
        )

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        login_data = {
            "username": "invalid_user",
            "password": "wrong_password",
            "remember_me": False
        }
        
        success, response = self.make_request('POST', 'auth/login', login_data, expected_status=401)
        return self.log_test(
            "Invalid Login", 
            not success or response.get('status_code') == 401,
            "Correctly rejected invalid credentials"
        )

    def test_get_current_user(self):
        """Test getting current user profile"""
        if not self.admin_token:
            return self.log_test("Get Current User", False, "No admin token available")
        
        success, response = self.make_request('GET', 'auth/me', token=self.admin_token, expected_status=200)
        return self.log_test(
            "Get Current User Profile", 
            success and response.get('username') == 'admin',
            f"User data: {response.get('username', 'N/A')} ({response.get('role', 'N/A')})"
        )

    def test_create_manager_user(self):
        """Test creating a manager user"""
        if not self.admin_token:
            return self.log_test("Create Manager User", False, "No admin token available")
        
        user_data = {
            "username": f"test_manager_{int(datetime.now().timestamp())}",
            "email": "manager@test.com",
            "full_name": "Test Manager",
            "phone": "1234567890",
            "password": "manager123",
            "role": "manager",
            "permissions": {
                "can_modify_stock": True,
                "can_view_reports": True,
                "can_manage_customers": True
            }
        }
        
        success, response = self.make_request('POST', 'users', user_data, token=self.admin_token, expected_status=200)
        
        if success and 'id' in response:
            self.test_user_ids.append(response['id'])
            return self.log_test(
                "Create Manager User", 
                True,
                f"Created user: {response.get('username')} with role: {response.get('role')}"
            )
        else:
            return self.log_test("Create Manager User", False, f"Response: {response}")

    def test_create_cashier_user(self):
        """Test creating a cashier user"""
        if not self.admin_token:
            return self.log_test("Create Cashier User", False, "No admin token available")
        
        user_data = {
            "username": f"test_cashier_{int(datetime.now().timestamp())}",
            "email": "cashier@test.com",
            "full_name": "Test Cashier",
            "phone": "0987654321",
            "password": "cashier123",
            "role": "cashier",
            "permissions": {
                "can_process_sales": True
            }
        }
        
        success, response = self.make_request('POST', 'users', user_data, token=self.admin_token, expected_status=200)
        
        if success and 'id' in response:
            self.test_user_ids.append(response['id'])
            return self.log_test(
                "Create Cashier User", 
                True,
                f"Created user: {response.get('username')} with role: {response.get('role')}"
            )
        else:
            return self.log_test("Create Cashier User", False, f"Response: {response}")

    def test_get_users_list(self):
        """Test getting list of users (admin only)"""
        if not self.admin_token:
            return self.log_test("Get Users List", False, "No admin token available")
        
        success, response = self.make_request('GET', 'users', token=self.admin_token, expected_status=200)
        
        if success and isinstance(response, list):
            user_count = len(response)
            return self.log_test(
                "Get Users List", 
                True,
                f"Retrieved {user_count} users"
            )
        else:
            return self.log_test("Get Users List", False, f"Response: {response}")

    def test_update_user(self):
        """Test updating a user"""
        if not self.admin_token or not self.test_user_ids:
            return self.log_test("Update User", False, "No admin token or test users available")
        
        user_id = self.test_user_ids[0]
        update_data = {
            "full_name": "Updated Test User",
            "email": "updated@test.com"
        }
        
        success, response = self.make_request('PUT', f'users/{user_id}', update_data, token=self.admin_token, expected_status=200)
        return self.log_test(
            "Update User", 
            success and response.get('full_name') == 'Updated Test User',
            f"Updated user: {response.get('username', 'N/A')}"
        )

    def test_change_password(self):
        """Test changing password"""
        if not self.admin_token:
            return self.log_test("Change Password", False, "No admin token available")
        
        password_data = {
            "current_password": "admin123",
            "new_password": "newadmin123"
        }
        
        success, response = self.make_request('PUT', 'auth/change-password', password_data, token=self.admin_token, expected_status=200)
        
        if success:
            # Change password back
            revert_data = {
                "current_password": "newadmin123",
                "new_password": "admin123"
            }
            self.make_request('PUT', 'auth/change-password', revert_data, token=self.admin_token)
            
        return self.log_test(
            "Change Password", 
            success and 'message' in response,
            "Password change functionality working"
        )

    def test_password_reset_request(self):
        """Test password reset request"""
        reset_data = {
            "username_or_email": "admin"
        }
        
        success, response = self.make_request('POST', 'auth/password-reset', reset_data, expected_status=200)
        return self.log_test(
            "Password Reset Request", 
            success and 'message' in response,
            "Password reset request processed"
        )

    def test_medicines_endpoint(self):
        """Test medicines endpoint"""
        if not self.admin_token:
            return self.log_test("Medicines Endpoint", False, "No admin token available")
        
        success, response = self.make_request('GET', 'medicines', token=self.admin_token, expected_status=200)
        return self.log_test(
            "Medicines Endpoint", 
            success and isinstance(response, list),
            f"Retrieved medicines list: {len(response) if isinstance(response, list) else 0} items"
        )

    def test_sales_endpoint(self):
        """Test sales endpoint"""
        if not self.admin_token:
            return self.log_test("Sales Endpoint", False, "No admin token available")
        
        success, response = self.make_request('GET', 'sales', token=self.admin_token, expected_status=200)
        return self.log_test(
            "Sales Endpoint", 
            success and isinstance(response, list),
            f"Retrieved sales list: {len(response) if isinstance(response, list) else 0} items"
        )

    def test_sales_analytics(self):
        """Test sales analytics endpoint"""
        if not self.admin_token:
            return self.log_test("Sales Analytics", False, "No admin token available")
        
        success, response = self.make_request('GET', 'sales/analytics', token=self.admin_token, expected_status=200)
        return self.log_test(
            "Sales Analytics", 
            success and 'total_sales' in response,
            f"Analytics data: {response.get('total_sales', 0)} total sales"
        )

    def test_shop_details(self):
        """Test shop details endpoint"""
        if not self.admin_token:
            return self.log_test("Shop Details", False, "No admin token available")
        
        success, response = self.make_request('GET', 'shop', token=self.admin_token, expected_status=200)
        return self.log_test(
            "Shop Details", 
            success,
            f"Shop details: {'Retrieved' if success else 'Failed'}"
        )

    def test_unauthorized_access(self):
        """Test unauthorized access to protected endpoints"""
        success, response = self.make_request('GET', 'users', expected_status=401)
        return self.log_test(
            "Unauthorized Access Protection", 
            not success or response.get('status_code') == 401,
            "Correctly blocked unauthorized access"
        )

    def test_token_refresh(self):
        """Test token refresh functionality"""
        if not self.admin_token:
            return self.log_test("Token Refresh", False, "No admin token available")
        
        # First login to get refresh token
        login_data = {
            "username": "admin",
            "password": "admin123",
            "remember_me": True
        }
        
        success, login_response = self.make_request('POST', 'auth/login', login_data, expected_status=200)
        
        if success and 'refresh_token' in login_response:
            refresh_token = login_response['refresh_token']
            success, refresh_response = self.make_request('POST', 'auth/refresh', token=refresh_token, expected_status=200)
            
            return self.log_test(
                "Token Refresh", 
                success and 'access_token' in refresh_response,
                "Token refresh working correctly"
            )
        else:
            return self.log_test("Token Refresh", False, "Could not get refresh token")

    def test_logout(self):
        """Test logout functionality"""
        if not self.admin_token:
            return self.log_test("Logout", False, "No admin token available")
        
        success, response = self.make_request('POST', 'auth/logout', token=self.admin_token, expected_status=200)
        return self.log_test(
            "Logout", 
            success and 'message' in response,
            "Logout functionality working"
        )

    def cleanup_test_users(self):
        """Clean up test users created during testing"""
        if not self.admin_token:
            return
        
        for user_id in self.test_user_ids:
            try:
                self.make_request('DELETE', f'users/{user_id}', token=self.admin_token)
            except:
                pass

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting MediPOS API Testing...")
        print(f"📍 Testing against: {self.base_url}")
        print("=" * 60)

        # Basic connectivity tests
        self.test_root_endpoint()
        
        # Authentication tests
        self.test_admin_login()
        self.test_admin_login_with_remember_me()
        self.test_invalid_login()
        self.test_get_current_user()
        
        # User management tests (admin only)
        self.test_create_manager_user()
        self.test_create_cashier_user()
        self.test_get_users_list()
        self.test_update_user()
        self.test_change_password()
        self.test_password_reset_request()
        
        # Core functionality tests
        self.test_medicines_endpoint()
        self.test_sales_endpoint()
        self.test_sales_analytics()
        self.test_shop_details()
        
        # Security tests
        self.test_unauthorized_access()
        self.test_token_refresh()
        self.test_logout()
        
        # Cleanup
        self.cleanup_test_users()
        
        # Results
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed! Backend API is working correctly.")
            return 0
        else:
            failed_tests = self.tests_run - self.tests_passed
            print(f"⚠️  {failed_tests} test(s) failed. Please check the issues above.")
            return 1

def main():
    """Main test execution"""
    tester = MediPOSAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())