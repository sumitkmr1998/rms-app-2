from fastapi import FastAPI, APIRouter, Query, HTTPException, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
from collections import defaultdict
import pandas as pd
import xml.etree.ElementTree as ET
import xmltodict
import csv
import io
import json
import re
import base64
import zipfile
import tempfile
from fastapi.responses import StreamingResponse
from io import BytesIO
import aiohttp
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class Medicine(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    price: float
    stock_quantity: int
    expiry_date: str
    batch_number: str
    supplier: str
    barcode: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Sale(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    receipt_number: str
    items: List[Dict]
    total_amount: float
    subtotal_amount: Optional[float] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    discount_amount: Optional[float] = None
    payment_method: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    cashier_id: str
    is_return: Optional[bool] = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class StockMovement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    medicine_id: str
    medicine_name: str
    movement_type: str  # 'addition', 'sale', 'return', 'adjustment'
    quantity_change: int  # positive for additions, negative for reductions
    previous_stock: int
    new_stock: int
    reference_id: Optional[str] = None  # sale_id or adjustment_id
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AnalyticsDateRange(BaseModel):
    start_date: str
    end_date: str

class SalesAnalyticsResponse(BaseModel):
    total_sales: float
    total_transactions: int
    total_items_sold: int
    top_selling_medicines: List[Dict]
    daily_sales: List[Dict]
    payment_method_breakdown: Dict[str, float]
    hourly_sales_pattern: List[Dict]

class Shop(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    phone: str
    email: str
    license_number: str
    gst_number: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ShopUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    license_number: Optional[str] = None
    gst_number: Optional[str] = None

# Tally Import Models
class TallyImportSettings(BaseModel):
    duplicate_handling: str  # 'skip', 'merge', 'overwrite'
    import_categories: List[str] = []  # Future use for categories
    validation_strict: bool = True

class TallyMedicinePreview(BaseModel):
    row_number: int
    name: str
    price: Optional[float] = None
    stock_quantity: Optional[int] = None
    supplier: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None
    barcode: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    original_data: Dict[str, Any] = {}
    status: str = "valid"  # 'valid', 'warning', 'error'
    issues: List[str] = []

class TallyImportPreviewResponse(BaseModel):
    total_records: int
    valid_records: int
    invalid_records: int
    duplicates_found: int
    medicines: List[TallyMedicinePreview]
    import_summary: Dict[str, Any]
    field_mappings: Dict[str, str]

class TallyImportResult(BaseModel):
    success: bool
    total_processed: int
    imported: int
    skipped: int
    errors: int
    duplicates_handled: int
    error_details: List[Dict]
    import_id: str

# Tally Processing Utilities
class TallyDataProcessor:
    def __init__(self):
        self.common_field_mappings = {
            # Medicine name variations
            'name': ['name', 'medicine_name', 'item_name', 'product_name', 'stockitem', 'stock_item_name'],
            'price': ['price', 'rate', 'selling_price', 'unit_price', 'mrp', 'sale_rate'],
            'stock_quantity': ['stock', 'quantity', 'stock_quantity', 'qty', 'closing_balance', 'current_stock'],
            'supplier': ['supplier', 'vendor', 'manufacturer', 'company', 'supplier_name'],
            'batch_number': ['batch', 'batch_no', 'batch_number', 'lot_number'],
            'expiry_date': ['expiry', 'expiry_date', 'exp_date', 'expiration_date'],
            'barcode': ['barcode', 'ean', 'sku', 'item_code', 'product_code'],
            'category': ['category', 'group', 'item_group', 'product_category'],
            'unit': ['unit', 'uom', 'base_unit', 'stock_unit']
        }

    def parse_csv_file(self, content: bytes) -> List[Dict]:
        """Parse CSV file content"""
        try:
            # Try different encodings
            for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
                try:
                    content_str = content.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue
            else:
                raise ValueError("Unable to decode file with common encodings")

            # Parse CSV
            csv_reader = csv.DictReader(io.StringIO(content_str))
            return list(csv_reader)
        except Exception as e:
            logging.error(f"CSV parsing error: {e}")
            raise HTTPException(status_code=400, detail=f"CSV parsing failed: {str(e)}")

    def parse_excel_file(self, content: bytes) -> List[Dict]:
        """Parse Excel file content"""
        try:
            # Read Excel file
            df = pd.read_excel(io.BytesIO(content), engine='openpyxl')
            # Fill NaN values with empty strings
            df = df.fillna('')
            return df.to_dict('records')
        except Exception as e:
            logging.error(f"Excel parsing error: {e}")
            raise HTTPException(status_code=400, detail=f"Excel parsing failed: {str(e)}")

    def parse_xml_file(self, content: bytes) -> List[Dict]:
        """Parse XML file content (Tally XML format)"""
        try:
            content_str = content.decode('utf-8')
            
            # Try to parse as XML
            try:
                root = ET.fromstring(content_str)
                return self._extract_xml_stock_items(root)
            except ET.ParseError:
                # Try xmltodict for more flexible parsing
                data = xmltodict.parse(content_str)
                return self._extract_xmltodict_stock_items(data)
                
        except Exception as e:
            logging.error(f"XML parsing error: {e}")
            raise HTTPException(status_code=400, detail=f"XML parsing failed: {str(e)}")

    def _extract_xml_stock_items(self, root) -> List[Dict]:
        """Extract stock items from XML ElementTree"""
        items = []
        
        # Common Tally XML structures
        for item in root.findall('.//STOCKITEM') or root.findall('.//stockitem'):
            item_data = {}
            for child in item:
                if child.text:
                    item_data[child.tag.lower()] = child.text.strip()
            if item_data:
                items.append(item_data)
        
        # Alternative structure
        for item in root.findall('.//INVENTORY') or root.findall('.//inventory'):
            item_data = {}
            for child in item:
                if child.text:
                    item_data[child.tag.lower()] = child.text.strip()
            if item_data:
                items.append(item_data)
                
        return items

    def _extract_xmltodict_stock_items(self, data) -> List[Dict]:
        """Extract stock items from xmltodict parsed data"""
        items = []
        
        def find_stock_items(obj, items_list):
            if isinstance(obj, dict):
                for key, value in obj.items():
                    if key.lower() in ['stockitem', 'inventory', 'item'] and isinstance(value, (list, dict)):
                        if isinstance(value, dict):
                            items_list.append(value)
                        elif isinstance(value, list):
                            items_list.extend(value)
                    else:
                        find_stock_items(value, items_list)
            elif isinstance(obj, list):
                for item in obj:
                    find_stock_items(item, items_list)
        
        find_stock_items(data, items)
        return items

    def map_fields(self, raw_data: List[Dict]) -> List[TallyMedicinePreview]:
        """Map raw data fields to medicine fields"""
        mapped_items = []
        
        if not raw_data:
            return mapped_items

        # Get available fields from first record
        available_fields = set()
        for record in raw_data[:5]:  # Check first 5 records
            available_fields.update(k.lower().strip() for k in record.keys() if k)

        # Create field mapping based on available fields
        field_mapping = {}
        for target_field, possible_fields in self.common_field_mappings.items():
            for possible_field in possible_fields:
                if possible_field in available_fields:
                    field_mapping[target_field] = possible_field
                    break

        # Process each record
        for idx, record in enumerate(raw_data):
            if not record or not any(record.values()):
                continue
                
            medicine_data = {
                'row_number': idx + 1,
                'original_data': record,
                'status': 'valid',
                'issues': []
            }

            # Map fields
            for target_field, source_field in field_mapping.items():
                value = record.get(source_field, '')
                if isinstance(value, str):
                    value = value.strip()
                
                if target_field == 'name':
                    medicine_data['name'] = value
                elif target_field == 'price':
                    medicine_data['price'] = self._parse_number(value, field_name='price')
                elif target_field == 'stock_quantity':
                    medicine_data['stock_quantity'] = self._parse_integer(value, field_name='stock_quantity')
                elif target_field == 'expiry_date':
                    medicine_data['expiry_date'] = self._parse_date(value)
                else:
                    medicine_data[target_field] = value

            # Set defaults for missing required fields
            if not medicine_data.get('name'):
                # Try to find name in any field that might contain it
                for key, value in record.items():
                    if value and isinstance(value, str) and len(value.strip()) > 2:
                        medicine_data['name'] = value.strip()
                        break
                
                if not medicine_data.get('name'):
                    medicine_data['status'] = 'error'
                    medicine_data['issues'].append('Medicine name is required')

            # Set reasonable defaults
            if medicine_data.get('price') is None:
                medicine_data['price'] = 0.0
                medicine_data['issues'].append('Price not found, defaulted to 0')
                
            if medicine_data.get('stock_quantity') is None:
                medicine_data['stock_quantity'] = 0
                medicine_data['issues'].append('Stock quantity not found, defaulted to 0')

            # Validate
            if len(medicine_data['issues']) > 0 and medicine_data['status'] == 'valid':
                medicine_data['status'] = 'warning'

            mapped_items.append(TallyMedicinePreview(**medicine_data))

        return mapped_items

    def _parse_number(self, value, field_name='number') -> Optional[float]:
        """Parse number from string, handling various formats"""
        if not value or value == '':
            return None
            
        try:
            # Remove common currency symbols and spaces
            cleaned = re.sub(r'[₹$,\s]', '', str(value))
            return float(cleaned)
        except (ValueError, TypeError):
            return None

    def _parse_integer(self, value, field_name='integer') -> Optional[int]:
        """Parse integer from string"""
        if not value or value == '':
            return None
            
        try:
            # Remove decimals and convert to int
            cleaned = re.sub(r'[,\s]', '', str(value))
            return int(float(cleaned))
        except (ValueError, TypeError):
            return None

    def _parse_date(self, value) -> Optional[str]:
        """Parse date from various formats to YYYY-MM-DD"""
        if not value or value == '':
            return None
            
        try:
            # Common date formats
            date_formats = [
                '%Y-%m-%d', '%d-%m-%Y', '%m-%d-%Y',
                '%Y/%m/%d', '%d/%m/%Y', '%m/%d/%Y',
                '%Y.%m.%d', '%d.%m.%Y', '%m.%d.%Y',
                '%d %b %Y', '%d %B %Y',
                '%b %d, %Y', '%B %d, %Y'
            ]
            
            for fmt in date_formats:
                try:
                    parsed_date = datetime.strptime(str(value).strip(), fmt)
                    return parsed_date.strftime('%Y-%m-%d')
                except ValueError:
                    continue
                    
            return None
        except Exception:
            return None

# Backup and Restore Models
class BackupOptions(BaseModel):
    include_medicines: bool = True
    include_sales: bool = True
    include_stock_movements: bool = True
    include_shop_details: bool = True
    include_import_logs: bool = True
    include_status_checks: bool = False
    backup_name: Optional[str] = None

class BackupMetadata(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    data_categories: List[str]
    total_records: int
    file_size: int
    
class BackupListResponse(BaseModel):
    backups: List[BackupMetadata]

class RestoreOptions(BaseModel):
    backup_id: str
    include_medicines: bool = True
    include_sales: bool = True
    include_stock_movements: bool = True
    include_shop_details: bool = True
    include_import_logs: bool = True
    include_status_checks: bool = False
    clear_existing_data: bool = False

class RestoreResult(BaseModel):
    success: bool
    restored_records: Dict[str, int]
    errors: List[str]
    restore_id: str

class BackupPreview(BaseModel):
    metadata: BackupMetadata
    data_summary: Dict[str, int]
    categories_available: List[str]

# Telegram Notification Models
class TelegramSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None
    notifications_enabled: bool = True
    low_stock_alerts_enabled: bool = True
    expiry_alerts_enabled: bool = True
    expired_alerts_enabled: bool = True
    daily_reports_enabled: bool = True
    daily_report_time: str = "18:00"  # 6 PM default
    low_stock_check_time: str = "*/4 * * * *"  # Every 4 hours (cron format)
    expiry_check_time: str = "0 9 * * *"  # 9 AM daily (cron format)
    expired_check_time: str = "0 10 * * *"  # 10 AM daily (cron format)
    timezone: str = "UTC"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TelegramSettingsUpdate(BaseModel):
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    low_stock_alerts_enabled: Optional[bool] = None
    expiry_alerts_enabled: Optional[bool] = None
    expired_alerts_enabled: Optional[bool] = None
    daily_reports_enabled: Optional[bool] = None
    daily_report_time: Optional[str] = None
    low_stock_check_time: Optional[str] = None
    expiry_check_time: Optional[str] = None
    expired_check_time: Optional[str] = None
    timezone: Optional[str] = None

class MedicineNotificationSettings(BaseModel):
    medicine_id: str
    low_stock_threshold: int = 10
    expiry_alert_days: int = 30  # Alert 30 days before expiry
    enabled: bool = True

class NotificationHistory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    notification_type: str  # 'low_stock', 'expiry', 'expired', 'daily_report'
    message: str
    status: str  # 'sent', 'failed', 'pending'
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    data: Optional[Dict] = None

class TelegramTestRequest(BaseModel):
    bot_token: str
    chat_id: str
    message: Optional[str] = "🧪 Test notification from MediPOS RMS"

class DailySalesReportRequest(BaseModel):
    date: Optional[str] = None  # YYYY-MM-DD format, defaults to today

# Enhanced Medicine Model with notification settings
class MedicineWithNotifications(Medicine):
    low_stock_threshold: int = 10
    expiry_alert_days: int = 30
    notifications_enabled: bool = True

# Global processor instance
tally_processor = TallyDataProcessor()

# Telegram Notification Service
class TelegramNotificationService:
    def __init__(self, db_instance):
        self.db = db_instance
        self.base_url = "https://api.telegram.org/bot"
    
    async def send_message(self, bot_token: str, chat_id: str, message: str) -> bool:
        """Send a message via Telegram Bot API"""
        try:
            url = f"{self.base_url}{bot_token}/sendMessage"
            data = {
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "HTML"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=data) as response:
                    if response.status == 200:
                        return True
                    else:
                        error_text = await response.text()
                        logging.error(f"Telegram API error: {response.status} - {error_text}")
                        return False
        except Exception as e:
            logging.error(f"Failed to send Telegram message: {e}")
            return False
    
    async def test_connection(self, bot_token: str, chat_id: str, test_message: str = None) -> Dict:
        """Test Telegram bot connection"""
        try:
            message = test_message or "🧪 <b>Test Notification</b>\n\n✅ Your MediPOS RMS Telegram notifications are working correctly!"
            success = await self.send_message(bot_token, chat_id, message)
            
            if success:
                return {"success": True, "message": "Test notification sent successfully"}
            else:
                return {"success": False, "message": "Failed to send test notification"}
        except Exception as e:
            return {"success": False, "message": f"Connection test failed: {str(e)}"}
    
    async def send_low_stock_alert(self, medicines_low_stock: List[Dict]):
        """Send low stock alert"""
        try:
            settings = await self.get_telegram_settings()
            if not settings or not settings.get('low_stock_alerts_enabled') or not settings.get('notifications_enabled'):
                return
                
            if not medicines_low_stock:
                return
                
            message = "🔴 <b>LOW STOCK ALERT</b>\n\n"
            message += f"📅 Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n"
            
            for med in medicines_low_stock:
                threshold = med.get('threshold', 10)
                current_stock = med.get('current_stock', 0)
                message += f"🔸 <b>{med['name']}</b>\n"
                message += f"   📦 Current Stock: <b>{current_stock}</b>\n"
                message += f"   ⚠️ Threshold: {threshold}\n"
                message += f"   💰 Price: ₹{med.get('price', 0):.2f}\n\n"
            
            message += "Please restock these medicines soon! 📋"
            
            success = await self.send_message(settings['bot_token'], settings['chat_id'], message)
            
            # Log notification
            await self.log_notification('low_stock', message, 'sent' if success else 'failed', medicines_low_stock)
            return success
            
        except Exception as e:
            logging.error(f"Failed to send low stock alert: {e}")
            return False
    
    async def send_expiry_alert(self, medicines_expiring: List[Dict]):
        """Send medicines expiry alert"""
        try:
            settings = await self.get_telegram_settings()
            if not settings or not settings.get('expiry_alerts_enabled') or not settings.get('notifications_enabled'):
                return
                
            if not medicines_expiring:
                return
                
            message = "⏰ <b>MEDICINES EXPIRY ALERT</b>\n\n"
            message += f"📅 Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n"
            
            for med in medicines_expiring:
                days_to_expiry = med.get('days_to_expiry', 0)
                expiry_date = med.get('expiry_date', '')
                message += f"🔸 <b>{med['name']}</b>\n"
                message += f"   📦 Stock: {med.get('stock_quantity', 0)} units\n"
                message += f"   📅 Expires: <b>{expiry_date}</b> ({days_to_expiry} days)\n"
                message += f"   🏷️ Batch: {med.get('batch_number', 'N/A')}\n\n"
            
            message += "⚠️ Please check these medicines and take necessary action!"
            
            success = await self.send_message(settings['bot_token'], settings['chat_id'], message)
            
            # Log notification
            await self.log_notification('expiry', message, 'sent' if success else 'failed', medicines_expiring)
            return success
            
        except Exception as e:
            logging.error(f"Failed to send expiry alert: {e}")
            return False
    
    async def send_expired_alert(self, medicines_expired: List[Dict]):
        """Send alert for medicines that have already expired"""
        try:
            settings = await self.get_telegram_settings()
            if not settings or not settings.get('expired_alerts_enabled') or not settings.get('notifications_enabled'):
                return
                
            if not medicines_expired:
                return
                
            message = "🚨 <b>EXPIRED MEDICINES ALERT</b>\n\n"
            message += f"📅 Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n"
            message += "⚠️ <b>The following medicines have EXPIRED and should be removed immediately:</b>\n\n"
            
            for med in medicines_expired:
                days_expired = abs(med.get('days_expired', 0))
                expiry_date = med.get('expiry_date', '')
                message += f"🔴 <b>{med['name']}</b>\n"
                message += f"   📦 Stock: {med.get('stock_quantity', 0)} units\n"
                message += f"   📅 Expired: <b>{expiry_date}</b> ({days_expired} days ago)\n"
                message += f"   🏷️ Batch: {med.get('batch_number', 'N/A')}\n"
                message += f"   💰 Value: ₹{(med.get('price', 0) * med.get('stock_quantity', 0)):,.2f}\n\n"
            
            message += "🚨 <b>URGENT ACTION REQUIRED:</b>\n"
            message += "• Remove expired medicines from inventory\n"
            message += "• Follow proper disposal procedures\n"
            message += "• Update stock records\n"
            message += "• Check for similar batches"
            
            success = await self.send_message(settings['bot_token'], settings['chat_id'], message)
            
            # Log notification
            await self.log_notification('expired', message, 'sent' if success else 'failed', medicines_expired)
            return success
            
        except Exception as e:
            logging.error(f"Failed to send expired alert: {e}")
            return False
    
    async def send_daily_sales_report(self, date_str: str = None):
        """Send daily sales report with payment breakdown"""
        try:
            settings = await self.get_telegram_settings()
            if not settings or not settings.get('daily_reports_enabled') or not settings.get('notifications_enabled'):
                return
                
            if not date_str:
                date_str = datetime.now().strftime('%Y-%m-%d')
            
            # Get sales data for the date
            start_date = datetime.fromisoformat(date_str + 'T00:00:00')
            end_date = datetime.fromisoformat(date_str + 'T23:59:59')
            
            # Aggregate sales data
            sales_pipeline = [
                {"$match": {"created_at": {"$gte": start_date, "$lte": end_date}}},
                {"$group": {
                    "_id": None,
                    "total_sales": {"$sum": "$total_amount"},
                    "total_transactions": {"$sum": 1},
                    "total_items": {"$sum": {"$sum": "$items.quantity"}},
                    "all_sales": {"$push": "$$ROOT"}
                }}
            ]
            
            result = await self.db.sales.aggregate(sales_pipeline).to_list(1)
            
            if not result:
                sales_data = {"total_sales": 0, "total_transactions": 0, "total_items": 0, "all_sales": []}
            else:
                sales_data = result[0]
            
            all_sales = sales_data.get("all_sales", [])
            
            # Payment method breakdown
            payment_breakdown = defaultdict(lambda: {"count": 0, "amount": 0})
            for sale in all_sales:
                method = sale.get("payment_method", "cash")
                payment_breakdown[method]["count"] += 1
                payment_breakdown[method]["amount"] += sale.get("total_amount", 0)
            
            # Create report message
            message = "📊 <b>DAILY SALES REPORT</b>\n\n"
            message += f"📅 Date: <b>{date_str}</b>\n\n"
            
            message += f"💰 <b>Total Sales:</b> ₹{sales_data.get('total_sales', 0):,.2f}\n"
            message += f"📄 <b>Total Transactions:</b> {sales_data.get('total_transactions', 0)}\n"
            message += f"📦 <b>Total Items Sold:</b> {sales_data.get('total_items', 0)}\n\n"
            
            if payment_breakdown:
                message += "<b>💳 PAYMENT METHOD BREAKDOWN:</b>\n"
                for method, data in payment_breakdown.items():
                    emoji = "💵" if method == "cash" else "💳" if method == "card" else "📱"
                    message += f"{emoji} <b>{method.upper()}:</b>\n"
                    message += f"   • Transactions: {data['count']}\n"
                    message += f"   • Amount: ₹{data['amount']:,.2f}\n\n"
            
            # Top selling medicines (if any sales)
            if all_sales:
                medicine_sales = defaultdict(lambda: {"quantity": 0, "revenue": 0, "name": ""})
                for sale in all_sales:
                    for item in sale.get("items", []):
                        med_id = item.get("medicine_id")
                        medicine_sales[med_id]["quantity"] += item.get("quantity", 0)
                        medicine_sales[med_id]["revenue"] += item.get("total", 0)
                        medicine_sales[med_id]["name"] = item.get("medicine_name", "Unknown")
                
                top_selling = sorted(
                    [{"medicine_id": k, **v} for k, v in medicine_sales.items()],
                    key=lambda x: x["quantity"],
                    reverse=True
                )[:5]
                
                if top_selling:
                    message += "<b>🏆 TOP SELLING MEDICINES:</b>\n"
                    for i, med in enumerate(top_selling, 1):
                        message += f"{i}. <b>{med['name']}</b>\n"
                        message += f"   📦 Sold: {med['quantity']} units\n"
                        message += f"   💰 Revenue: ₹{med['revenue']:,.2f}\n\n"
            
            message += f"📱 Generated at: {datetime.now().strftime('%H:%M:%S')}"
            
            success = await self.send_message(settings['bot_token'], settings['chat_id'], message)
            
            # Log notification
            await self.log_notification('daily_report', message, 'sent' if success else 'failed', {"date": date_str, "sales_data": sales_data})
            return success
            
        except Exception as e:
            logging.error(f"Failed to send daily sales report: {e}")
            return False
    
    async def get_telegram_settings(self):
        """Get current Telegram settings"""
        try:
            settings = await self.db.telegram_settings.find_one()
            if settings:
                settings.pop("_id", None)
            return settings
        except Exception as e:
            logging.error(f"Failed to get Telegram settings: {e}")
            return None
    
    async def log_notification(self, notification_type: str, message: str, status: str, data: Any = None, error_message: str = None):
        """Log notification to history"""
        try:
            log_entry = {
                "id": str(uuid.uuid4()),
                "notification_type": notification_type,
                "message": message,
                "status": status,
                "error_message": error_message,
                "created_at": datetime.utcnow(),
                "data": data
            }
            await self.db.notification_history.insert_one(log_entry)
        except Exception as e:
            logging.error(f"Failed to log notification: {e}")

# Global notification service instance (will be initialized after app setup)
notification_service = None

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "MediPOS RMS Analytics API"}

# Tally Import Endpoints
@api_router.post("/tally/upload-preview")
async def upload_tally_file_preview(file: UploadFile = File(...)):
    """Upload and preview Tally file before importing"""
    try:
        # Validate file type
        allowed_extensions = ['.csv', '.xlsx', '.xls', '.xml']
        file_extension = os.path.splitext(file.filename.lower())[1]
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
            )

        # Read file content
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded")

        # Parse based on file type
        raw_data = []
        if file_extension == '.csv':
            raw_data = tally_processor.parse_csv_file(content)
        elif file_extension in ['.xlsx', '.xls']:
            raw_data = tally_processor.parse_excel_file(content)
        elif file_extension == '.xml':
            raw_data = tally_processor.parse_xml_file(content)

        if not raw_data:
            raise HTTPException(status_code=400, detail="No data found in file")

        # Map fields and create preview
        mapped_data = tally_processor.map_fields(raw_data)
        
        # Check for duplicates against existing medicines
        existing_medicines = await db.medicines.find({}, {"name": 1}).to_list(10000)
        existing_names = {med["name"].lower() for med in existing_medicines}
        
        duplicates_count = 0
        for item in mapped_data:
            if item.name and item.name.lower() in existing_names:
                duplicates_count += 1
                if item.status == 'valid':
                    item.status = 'warning'
                item.issues.append('Duplicate medicine name found in database')

        # Generate statistics
        valid_count = sum(1 for item in mapped_data if item.status == 'valid')
        invalid_count = sum(1 for item in mapped_data if item.status == 'error')
        
        # Field mappings for frontend display
        field_mappings = {}
        if raw_data:
            sample_record = raw_data[0]
            for target_field, possible_fields in tally_processor.common_field_mappings.items():
                for possible_field in possible_fields:
                    if possible_field in [k.lower() for k in sample_record.keys()]:
                        field_mappings[target_field] = possible_field
                        break

        return TallyImportPreviewResponse(
            total_records=len(mapped_data),
            valid_records=valid_count,
            invalid_records=invalid_count,
            duplicates_found=duplicates_count,
            medicines=mapped_data,
            import_summary={
                "file_name": file.filename,
                "file_size": len(content),
                "file_type": file_extension,
                "processed_at": datetime.utcnow().isoformat()
            },
            field_mappings=field_mappings
        )

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"File preview error: {e}")
        raise HTTPException(status_code=500, detail=f"File processing failed: {str(e)}")

@api_router.post("/tally/import")
async def import_tally_data(
    file: UploadFile = File(...),
    duplicate_handling: str = "skip",
    validation_strict: bool = True
):
    """Import Tally data with specified settings"""
    try:
        # Validate settings
        if duplicate_handling not in ['skip', 'merge', 'overwrite']:
            raise HTTPException(status_code=400, detail="Invalid duplicate handling option")

        # Generate import ID for tracking
        import_id = str(uuid.uuid4())
        
        # Process file (similar to preview)
        file_extension = os.path.splitext(file.filename.lower())[1]
        content = await file.read()
        
        # Parse file
        raw_data = []
        if file_extension == '.csv':
            raw_data = tally_processor.parse_csv_file(content)
        elif file_extension in ['.xlsx', '.xls']:
            raw_data = tally_processor.parse_excel_file(content)
        elif file_extension == '.xml':
            raw_data = tally_processor.parse_xml_file(content)

        mapped_data = tally_processor.map_fields(raw_data)
        
        # Import statistics
        total_processed = len(mapped_data)
        imported = 0
        skipped = 0
        errors = 0
        duplicates_handled = 0
        error_details = []

        # Get existing medicines for duplicate checking
        existing_medicines = await db.medicines.find().to_list(10000)
        existing_by_name = {med["name"].lower(): med for med in existing_medicines}

        # Process each medicine
        for item in mapped_data:
            try:
                if item.status == 'error':
                    errors += 1
                    error_details.append({
                        "row": item.row_number,
                        "name": item.name,
                        "issues": item.issues
                    })
                    continue

                # Check for duplicates
                is_duplicate = item.name and item.name.lower() in existing_by_name
                
                if is_duplicate:
                    duplicates_handled += 1
                    
                    if duplicate_handling == 'skip':
                        skipped += 1
                        continue
                    elif duplicate_handling == 'overwrite':
                        # Update existing medicine
                        existing_medicine = existing_by_name[item.name.lower()]
                        update_data = {
                            "name": item.name,
                            "price": item.price or 0.0,
                            "stock_quantity": item.stock_quantity or 0,
                            "supplier": item.supplier or "",
                            "batch_number": item.batch_number or "",
                            "barcode": item.barcode or "",
                            "updated_at": datetime.utcnow()
                        }
                        
                        if item.expiry_date:
                            update_data["expiry_date"] = item.expiry_date
                            
                        result = await db.medicines.update_one(
                            {"id": existing_medicine["id"]},
                            {"$set": update_data}
                        )
                        
                        if result.modified_count:
                            imported += 1
                        else:
                            skipped += 1
                            
                    elif duplicate_handling == 'merge':
                        # Merge with existing data (update only non-empty fields)
                        existing_medicine = existing_by_name[item.name.lower()]
                        update_data = {"updated_at": datetime.utcnow()}
                        
                        if item.price and item.price > 0:
                            update_data["price"] = item.price
                        if item.stock_quantity and item.stock_quantity >= 0:
                            update_data["stock_quantity"] = item.stock_quantity
                        if item.supplier:
                            update_data["supplier"] = item.supplier
                        if item.batch_number:
                            update_data["batch_number"] = item.batch_number
                        if item.barcode:
                            update_data["barcode"] = item.barcode
                        if item.expiry_date:
                            update_data["expiry_date"] = item.expiry_date
                            
                        result = await db.medicines.update_one(
                            {"id": existing_medicine["id"]},
                            {"$set": update_data}
                        )
                        
                        if result.modified_count:
                            imported += 1
                        else:
                            skipped += 1
                else:
                    # Create new medicine
                    medicine_data = {
                        "id": str(uuid.uuid4()),
                        "name": item.name,
                        "price": item.price or 0.0,
                        "stock_quantity": item.stock_quantity or 0,
                        "supplier": item.supplier or "",
                        "batch_number": item.batch_number or "",
                        "barcode": item.barcode or "",
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    }
                    
                    if item.expiry_date:
                        medicine_data["expiry_date"] = item.expiry_date
                    else:
                        # Set default expiry date (1 year from now)
                        medicine_data["expiry_date"] = (datetime.utcnow() + timedelta(days=365)).strftime('%Y-%m-%d')
                        
                    await db.medicines.insert_one(medicine_data)
                    imported += 1

            except Exception as item_error:
                errors += 1
                error_details.append({
                    "row": item.row_number,
                    "name": item.name,
                    "error": str(item_error)
                })
                logging.error(f"Import error for row {item.row_number}: {item_error}")

        # Store import log
        import_log = {
            "import_id": import_id,
            "filename": file.filename,
            "imported_at": datetime.utcnow(),
            "settings": {
                "duplicate_handling": duplicate_handling,
                "validation_strict": validation_strict
            },
            "results": {
                "total_processed": total_processed,
                "imported": imported,
                "skipped": skipped,
                "errors": errors,
                "duplicates_handled": duplicates_handled
            }
        }
        
        await db.import_logs.insert_one(import_log)

        return TallyImportResult(
            success=errors < total_processed,  # Success if not all failed
            total_processed=total_processed,
            imported=imported,
            skipped=skipped,
            errors=errors,
            duplicates_handled=duplicates_handled,
            error_details=error_details[:10],  # Limit error details
            import_id=import_id
        )

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Import error: {e}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@api_router.get("/tally/import-history")
async def get_import_history():
    """Get import history"""
    try:
        imports = await db.import_logs.find().sort("imported_at", -1).limit(50).to_list(50)
        
        for import_record in imports:
            if "_id" in import_record:
                import_record.pop("_id")
                
        return {"imports": imports}
    except Exception as e:
        logging.error(f"Import history error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch import history")

# Telegram Notification Endpoints
@api_router.get("/telegram/settings")
async def get_telegram_settings():
    """Get current Telegram notification settings"""
    try:
        settings = await db.telegram_settings.find_one()
        if settings:
            settings.pop("_id", None)
            # Don't expose the bot token in the response for security
            if settings.get("bot_token"):
                settings["bot_token"] = "***CONFIGURED***"
            return TelegramSettings(**settings)
        else:
            # Return default settings
            default_settings = TelegramSettings()
            return default_settings
    except Exception as e:
        logging.error(f"Error fetching Telegram settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch Telegram settings")

@api_router.put("/telegram/settings")
async def update_telegram_settings(settings: TelegramSettingsUpdate):
    """Update Telegram notification settings"""
    try:
        # Get existing settings
        existing = await db.telegram_settings.find_one()
        
        if existing:
            # Update existing settings
            update_data = {k: v for k, v in settings.dict().items() if v is not None}
            update_data["updated_at"] = datetime.utcnow()
            
            result = await db.telegram_settings.update_one(
                {"id": existing["id"]},
                {"$set": update_data}
            )
            
            if result.modified_count:
                updated_settings = await db.telegram_settings.find_one({"id": existing["id"]})
                updated_settings.pop("_id", None)
                
                # Mask bot token in response
                if updated_settings.get("bot_token"):
                    updated_settings["bot_token"] = "***CONFIGURED***"
                
                # Update scheduler with new settings
                await update_notification_schedules()
                    
                return TelegramSettings(**updated_settings)
            else:
                existing.pop("_id", None)
                if existing.get("bot_token"):
                    existing["bot_token"] = "***CONFIGURED***"
                return TelegramSettings(**existing)
        else:
            # Create new settings
            new_settings_data = {
                "id": str(uuid.uuid4()),
                "bot_token": settings.bot_token,
                "chat_id": settings.chat_id,
                "notifications_enabled": settings.notifications_enabled if settings.notifications_enabled is not None else True,
                "low_stock_alerts_enabled": settings.low_stock_alerts_enabled if settings.low_stock_alerts_enabled is not None else True,
                "expiry_alerts_enabled": settings.expiry_alerts_enabled if settings.expiry_alerts_enabled is not None else True,
                "expired_alerts_enabled": settings.expired_alerts_enabled if settings.expired_alerts_enabled is not None else True,
                "daily_reports_enabled": settings.daily_reports_enabled if settings.daily_reports_enabled is not None else True,
                "daily_report_time": settings.daily_report_time or "18:00",
                "low_stock_check_time": settings.low_stock_check_time or "0 */4 * * *",
                "expiry_check_time": settings.expiry_check_time or "0 9 * * *",
                "expired_check_time": settings.expired_check_time or "0 10 * * *",
                "timezone": settings.timezone or "UTC",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            settings_obj = TelegramSettings(**new_settings_data)
            await db.telegram_settings.insert_one(settings_obj.dict())
            
            # Mask bot token in response
            response_data = settings_obj.dict()
            if response_data.get("bot_token"):
                response_data["bot_token"] = "***CONFIGURED***"
            
            # Update scheduler with new settings
            await update_notification_schedules()
            
            return TelegramSettings(**response_data)
            
    except Exception as e:
        logging.error(f"Error updating Telegram settings: {e}")
        raise HTTPException(status_code=500, detail="Error updating Telegram settings")

@api_router.post("/telegram/test")
async def test_telegram_connection(test_request: TelegramTestRequest):
    """Test Telegram bot connection"""
    try:
        global notification_service
        if notification_service is None:
            notification_service = TelegramNotificationService(db)
            
        result = await notification_service.test_connection(
            test_request.bot_token,
            test_request.chat_id,
            test_request.message
        )
        return result
    except Exception as e:
        logging.error(f"Telegram test error: {e}")
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")

@api_router.get("/medicines/{medicine_id}/notification-settings")
async def get_medicine_notification_settings(medicine_id: str):
    """Get notification settings for a specific medicine"""
    try:
        settings = await db.medicine_notification_settings.find_one({"medicine_id": medicine_id})
        if settings:
            settings.pop("_id", None)
            return settings
        else:
            # Return default settings
            return {
                "medicine_id": medicine_id,
                "low_stock_threshold": 10,
                "expiry_alert_days": 30,
                "enabled": True
            }
    except Exception as e:
        logging.error(f"Error fetching medicine notification settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch notification settings")

@api_router.put("/medicines/{medicine_id}/notification-settings")
async def update_medicine_notification_settings(medicine_id: str, settings: MedicineNotificationSettings):
    """Update notification settings for a specific medicine"""
    try:
        # Verify medicine exists
        medicine = await db.medicines.find_one({"id": medicine_id})
        if not medicine:
            raise HTTPException(status_code=404, detail="Medicine not found")
        
        existing = await db.medicine_notification_settings.find_one({"medicine_id": medicine_id})
        
        if existing:
            # Update existing settings
            update_data = {
                "low_stock_threshold": settings.low_stock_threshold,
                "expiry_alert_days": settings.expiry_alert_days,
                "enabled": settings.enabled
            }
            
            result = await db.medicine_notification_settings.update_one(
                {"medicine_id": medicine_id},
                {"$set": update_data}
            )
            
            if result.modified_count:
                updated_settings = await db.medicine_notification_settings.find_one({"medicine_id": medicine_id})
                updated_settings.pop("_id", None)
                return updated_settings
            else:
                existing.pop("_id", None)
                return existing
        else:
            # Create new settings
            settings_data = {
                "medicine_id": medicine_id,
                "low_stock_threshold": settings.low_stock_threshold,
                "expiry_alert_days": settings.expiry_alert_days,
                "enabled": settings.enabled
            }
            
            await db.medicine_notification_settings.insert_one(settings_data)
            return settings_data
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating medicine notification settings: {e}")
        raise HTTPException(status_code=500, detail="Error updating notification settings")

@api_router.post("/telegram/send-daily-report")
async def send_daily_sales_report(report_request: DailySalesReportRequest = None):
    """Manually send daily sales report"""
    try:
        global notification_service
        if notification_service is None:
            notification_service = TelegramNotificationService(db)
        
        date_str = report_request.date if report_request else None
        if not date_str:
            date_str = datetime.now().strftime('%Y-%m-%d')
            
        success = await notification_service.send_daily_sales_report(date_str)
        
        if success:
            return {"success": True, "message": f"Daily report for {date_str} sent successfully"}
        else:
            return {"success": False, "message": "Failed to send daily report"}
            
    except Exception as e:
        logging.error(f"Manual daily report error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send report: {str(e)}")

@api_router.post("/telegram/check-low-stock")
async def check_and_send_low_stock_alerts():
    """Manually check and send low stock alerts"""
    try:
        global notification_service
        if notification_service is None:
            notification_service = TelegramNotificationService(db)
        
        # Get all medicines with their notification settings
        medicines = await db.medicines.find().to_list(10000)
        low_stock_medicines = []
        
        for medicine in medicines:
            # Get notification settings for this medicine
            settings = await db.medicine_notification_settings.find_one({"medicine_id": medicine["id"]})
            threshold = settings.get("low_stock_threshold", 10) if settings else 10
            enabled = settings.get("enabled", True) if settings else True
            
            if enabled and medicine.get("stock_quantity", 0) <= threshold:
                low_stock_medicines.append({
                    "id": medicine["id"],
                    "name": medicine["name"],
                    "current_stock": medicine.get("stock_quantity", 0),
                    "threshold": threshold,
                    "price": medicine.get("price", 0)
                })
        
        if low_stock_medicines:
            success = await notification_service.send_low_stock_alert(low_stock_medicines)
            return {
                "success": success,
                "message": f"Found {len(low_stock_medicines)} medicines with low stock",
                "medicines": low_stock_medicines
            }
        else:
            return {
                "success": True,
                "message": "No medicines with low stock found",
                "medicines": []
            }
            
    except Exception as e:
        logging.error(f"Low stock check error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check low stock: {str(e)}")

@api_router.post("/telegram/check-expiring")
async def check_and_send_expiry_alerts():
    """Manually check and send expiry alerts"""
    try:
        global notification_service
        if notification_service is None:
            notification_service = TelegramNotificationService(db)
        
        # Get all medicines with their notification settings
        medicines = await db.medicines.find().to_list(10000)
        expiring_medicines = []
        
        current_date = datetime.now().date()
        
        for medicine in medicines:
            # Get notification settings for this medicine
            settings = await db.medicine_notification_settings.find_one({"medicine_id": medicine["id"]})
            alert_days = settings.get("expiry_alert_days", 30) if settings else 30
            enabled = settings.get("enabled", True) if settings else True
            
            if enabled and medicine.get("expiry_date"):
                try:
                    expiry_date = datetime.fromisoformat(medicine["expiry_date"]).date()
                    days_to_expiry = (expiry_date - current_date).days
                    
                    if 0 <= days_to_expiry <= alert_days:
                        expiring_medicines.append({
                            "id": medicine["id"],
                            "name": medicine["name"],
                            "expiry_date": medicine["expiry_date"],
                            "days_to_expiry": days_to_expiry,
                            "stock_quantity": medicine.get("stock_quantity", 0),
                            "batch_number": medicine.get("batch_number", "N/A"),
                            "alert_days": alert_days
                        })
                except (ValueError, TypeError):
                    continue
        
        if expiring_medicines:
            success = await notification_service.send_expiry_alert(expiring_medicines)
            return {
                "success": success,
                "message": f"Found {len(expiring_medicines)} medicines expiring soon",
                "medicines": expiring_medicines
            }
        else:
            return {
                "success": True,
                "message": "No medicines expiring soon found",
                "medicines": []
            }
            
    except Exception as e:
        logging.error(f"Expiry check error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check expiring medicines: {str(e)}")

@api_router.post("/telegram/check-expired")
async def check_and_send_expired_alerts():
    """Manually check and send alerts for already expired medicines"""
    try:
        global notification_service
        if notification_service is None:
            notification_service = TelegramNotificationService(db)
        
        # Get all medicines with their notification settings
        medicines = await db.medicines.find().to_list(10000)
        expired_medicines = []
        
        current_date = datetime.now().date()
        
        for medicine in medicines:
            # Get notification settings for this medicine
            settings = await db.medicine_notification_settings.find_one({"medicine_id": medicine["id"]})
            enabled = settings.get("enabled", True) if settings else True
            
            if enabled and medicine.get("expiry_date") and medicine.get("stock_quantity", 0) > 0:
                try:
                    expiry_date = datetime.fromisoformat(medicine["expiry_date"]).date()
                    days_expired = (current_date - expiry_date).days
                    
                    # If medicine is expired (days_expired > 0) and still has stock
                    if days_expired > 0:
                        expired_medicines.append({
                            "id": medicine["id"],
                            "name": medicine["name"],
                            "expiry_date": medicine["expiry_date"],
                            "days_expired": days_expired,
                            "stock_quantity": medicine.get("stock_quantity", 0),
                            "batch_number": medicine.get("batch_number", "N/A"),
                            "price": medicine.get("price", 0),
                            "supplier": medicine.get("supplier", "N/A")
                        })
                except (ValueError, TypeError):
                    continue
        
        if expired_medicines:
            success = await notification_service.send_expired_alert(expired_medicines)
            total_value = sum(med["price"] * med["stock_quantity"] for med in expired_medicines)
            return {
                "success": success,
                "message": f"Found {len(expired_medicines)} expired medicines with stock",
                "total_expired_value": total_value,
                "medicines": expired_medicines
            }
        else:
            return {
                "success": True,
                "message": "No expired medicines with remaining stock found",
                "total_expired_value": 0,
                "medicines": []
            }
            
    except Exception as e:
        logging.error(f"Expired medicines check error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check expired medicines: {str(e)}")

@api_router.get("/telegram/notification-history")
async def get_notification_history(limit: int = Query(50, description="Number of notifications to retrieve")):
    """Get notification history"""
    try:
        history = await db.notification_history.find().sort("created_at", -1).limit(limit).to_list(limit)
        
        for record in history:
            if "_id" in record:
                record.pop("_id")
                
        return {"notifications": history}
    except Exception as e:
        logging.error(f"Notification history error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch notification history")

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Shop Management Endpoints
@api_router.get("/shop")
async def get_shop():
    """Get shop details"""
    try:
        shop = await db.shop.find_one()
        if shop:
            # Convert MongoDB _id to string if it exists, otherwise use the id field
            if "_id" in shop:
                shop.pop("_id")
            return Shop(**shop)
        else:
            # Return default shop data if none exists
            return {
                "id": str(uuid.uuid4()),
                "name": "",
                "address": "",
                "phone": "",
                "email": "",
                "license_number": "",
                "gst_number": "",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
    except Exception as e:
        logging.error(f"Error fetching shop details: {e}")
        return {
            "id": str(uuid.uuid4()),
            "name": "",
            "address": "",
            "phone": "",
            "email": "",
            "license_number": "",
            "gst_number": "",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }

@api_router.put("/shop")
async def update_shop(shop_data: ShopUpdate):
    """Update shop details"""
    try:
        # Check if shop exists
        existing_shop = await db.shop.find_one()
        
        if existing_shop:
            # Update existing shop
            update_data = {k: v for k, v in shop_data.dict().items() if v is not None}
            update_data["updated_at"] = datetime.utcnow()
            
            result = await db.shop.update_one(
                {"id": existing_shop["id"]},
                {"$set": update_data}
            )
            
            if result.modified_count:
                updated_shop = await db.shop.find_one({"id": existing_shop["id"]})
                updated_shop.pop("_id")
                return Shop(**updated_shop)
            else:
                existing_shop.pop("_id")
                return Shop(**existing_shop)
        else:
            # Create new shop
            new_shop_data = {
                "id": str(uuid.uuid4()),
                "name": shop_data.name or "",
                "address": shop_data.address or "",
                "phone": shop_data.phone or "",
                "email": shop_data.email or "",
                "license_number": shop_data.license_number or "",
                "gst_number": shop_data.gst_number or "",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            shop_obj = Shop(**new_shop_data)
            await db.shop.insert_one(shop_obj.dict())
            return shop_obj
            
    except Exception as e:
        logging.error(f"Error updating shop details: {e}")
        raise HTTPException(status_code=500, detail="Error updating shop details")

# Analytics Endpoints
@api_router.post("/analytics/sales")
async def get_sales_analytics(date_range: AnalyticsDateRange):
    """Get comprehensive sales analytics for a date range"""
    try:
        start_date = datetime.fromisoformat(date_range.start_date.replace('Z', '+00:00'))
        end_date = datetime.fromisoformat(date_range.end_date.replace('Z', '+00:00'))
        
        # Aggregate sales data
        sales_pipeline = [
            {
                "$match": {
                    "created_at": {"$gte": start_date, "$lte": end_date}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_sales": {"$sum": "$total_amount"},
                    "total_transactions": {"$sum": 1},
                    "total_items": {"$sum": {"$sum": "$items.quantity"}},
                    "all_sales": {"$push": "$$ROOT"}
                }
            }
        ]
        
        result = await db.sales.aggregate(sales_pipeline).to_list(1)
        
        if not result:
            return SalesAnalyticsResponse(
                total_sales=0,
                total_transactions=0,
                total_items_sold=0,
                top_selling_medicines=[],
                daily_sales=[],
                payment_method_breakdown={},
                hourly_sales_pattern=[]
            )
        
        sales_data = result[0]
        all_sales = sales_data.get("all_sales", [])
        
        # Calculate top selling medicines
        medicine_sales = defaultdict(lambda: {"quantity": 0, "revenue": 0, "name": ""})
        for sale in all_sales:
            for item in sale.get("items", []):
                med_id = item.get("medicine_id")
                medicine_sales[med_id]["quantity"] += item.get("quantity", 0)
                medicine_sales[med_id]["revenue"] += item.get("total", 0)
                medicine_sales[med_id]["name"] = item.get("medicine_name", "Unknown")
        
        top_selling = sorted(
            [{"medicine_id": k, **v} for k, v in medicine_sales.items()],
            key=lambda x: x["quantity"],
            reverse=True
        )[:10]
        
        # Daily sales breakdown
        daily_sales = defaultdict(float)
        for sale in all_sales:
            day = sale["created_at"].strftime("%Y-%m-%d")
            daily_sales[day] += sale.get("total_amount", 0)
        
        daily_sales_list = [{"date": k, "sales": v} for k, v in sorted(daily_sales.items())]
        
        # Payment method breakdown
        payment_breakdown = defaultdict(float)
        for sale in all_sales:
            method = sale.get("payment_method", "cash")
            payment_breakdown[method] += sale.get("total_amount", 0)
        
        # Hourly sales pattern
        hourly_sales = defaultdict(float)
        for sale in all_sales:
            hour = sale["created_at"].hour
            hourly_sales[hour] += sale.get("total_amount", 0)
        
        hourly_pattern = [{"hour": h, "sales": hourly_sales.get(h, 0)} for h in range(24)]
        
        return SalesAnalyticsResponse(
            total_sales=sales_data.get("total_sales", 0),
            total_transactions=sales_data.get("total_transactions", 0),
            total_items_sold=sales_data.get("total_items", 0),
            top_selling_medicines=top_selling,
            daily_sales=daily_sales_list,
            payment_method_breakdown=dict(payment_breakdown),
            hourly_sales_pattern=hourly_pattern
        )
        
    except Exception as e:
        logging.error(f"Error in sales analytics: {e}")
        return SalesAnalyticsResponse(
            total_sales=0,
            total_transactions=0,
            total_items_sold=0,
            top_selling_medicines=[],
            daily_sales=[],
            payment_method_breakdown={},
            hourly_sales_pattern=[]
        )

@api_router.get("/analytics/medicine-sales/{medicine_id}")
async def get_medicine_sales_history(
    medicine_id: str,
    days: int = Query(30, description="Number of days to look back")
):
    """Get sales history for a specific medicine"""
    try:
        start_date = datetime.utcnow() - timedelta(days=days)
        
        pipeline = [
            {
                "$match": {
                    "created_at": {"$gte": start_date},
                    "items.medicine_id": medicine_id
                }
            },
            {
                "$unwind": "$items"
            },
            {
                "$match": {
                    "items.medicine_id": medicine_id
                }
            },
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": "$created_at"
                        }
                    },
                    "quantity_sold": {"$sum": "$items.quantity"},
                    "revenue": {"$sum": "$items.total"},
                    "medicine_name": {"$first": "$items.medicine_name"}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        
        results = await db.sales.aggregate(pipeline).to_list(1000)
        
        return {
            "medicine_id": medicine_id,
            "sales_history": [
                {
                    "date": result["_id"],
                    "quantity_sold": result["quantity_sold"],
                    "revenue": result["revenue"],
                    "medicine_name": result.get("medicine_name", "Unknown")
                }
                for result in results
            ]
        }
        
    except Exception as e:
        logging.error(f"Error in medicine sales history: {e}")
        return {"medicine_id": medicine_id, "sales_history": []}

@api_router.get("/analytics/stock-history/{medicine_id}")
async def get_stock_movement_history(
    medicine_id: str,
    days: int = Query(30, description="Number of days to look back")
):
    """Get stock movement history for a specific medicine"""
    try:
        start_date = datetime.utcnow() - timedelta(days=days)
        
        movements = await db.stock_movements.find({
            "medicine_id": medicine_id,
            "created_at": {"$gte": start_date}
        }).sort("created_at", 1).to_list(1000)
        
        return {
            "medicine_id": medicine_id,
            "stock_movements": [
                {
                    "date": movement["created_at"].isoformat(),
                    "movement_type": movement.get("movement_type", "unknown"),
                    "quantity_change": movement.get("quantity_change", 0),
                    "previous_stock": movement.get("previous_stock", 0),
                    "new_stock": movement.get("new_stock", 0),
                    "notes": movement.get("notes", "")
                }
                for movement in movements
            ]
        }
        
    except Exception as e:
        logging.error(f"Error in stock movement history: {e}")
        return {"medicine_id": medicine_id, "stock_movements": []}

@api_router.get("/analytics/medicines-sold-summary")
async def get_medicines_sold_summary(days: int = Query(30, description="Number of days to look back")):
    """Get summary of all medicines with quantities sold"""
    try:
        start_date = datetime.utcnow() - timedelta(days=days)
        
        pipeline = [
            {
                "$match": {
                    "created_at": {"$gte": start_date}
                }
            },
            {
                "$unwind": "$items"
            },
            {
                "$group": {
                    "_id": "$items.medicine_id",
                    "medicine_name": {"$first": "$items.medicine_name"},
                    "total_quantity_sold": {"$sum": "$items.quantity"},
                    "total_revenue": {"$sum": "$items.total"},
                    "average_price": {"$avg": "$items.price"},
                    "sale_count": {"$sum": 1}
                }
            },
            {
                "$sort": {"total_quantity_sold": -1}
            }
        ]
        
        results = await db.sales.aggregate(pipeline).to_list(1000)
        
        return {
            "period_days": days,
            "medicines_summary": [
                {
                    "medicine_id": result["_id"],
                    "medicine_name": result.get("medicine_name", "Unknown"),
                    "total_quantity_sold": result["total_quantity_sold"],
                    "total_revenue": result["total_revenue"],
                    "average_price": result.get("average_price", 0),
                    "sale_count": result["sale_count"]
                }
                for result in results
            ]
        }
        
    except Exception as e:
        logging.error(f"Error in medicines sold summary: {e}")
        return {"period_days": days, "medicines_summary": []}

# Backup and Restore Endpoints
@api_router.post("/backup/create")
async def create_backup(options: BackupOptions):
    """Create a backup with selective data inclusion"""
    try:
        backup_id = str(uuid.uuid4())
        backup_name = options.backup_name or f"Backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        backup_data = {
            "metadata": {
                "id": backup_id,
                "name": backup_name,
                "created_at": datetime.utcnow().isoformat(),
                "data_categories": [],
                "version": "1.0"
            },
            "data": {}
        }
        
        total_records = 0
        
        # Backup medicines
        if options.include_medicines:
            medicines = await db.medicines.find({}).to_list(10000)
            for medicine in medicines:
                if "_id" in medicine:
                    medicine.pop("_id")
                # Convert datetime objects to ISO format strings
                if "created_at" in medicine:
                    medicine["created_at"] = medicine["created_at"].isoformat()
                if "updated_at" in medicine:
                    medicine["updated_at"] = medicine["updated_at"].isoformat()
            backup_data["data"]["medicines"] = medicines
            backup_data["metadata"]["data_categories"].append("medicines")
            total_records += len(medicines)
        
        # Backup sales
        if options.include_sales:
            sales = await db.sales.find({}).to_list(10000)
            for sale in sales:
                if "_id" in sale:
                    sale.pop("_id")
                if "created_at" in sale:
                    sale["created_at"] = sale["created_at"].isoformat()
            backup_data["data"]["sales"] = sales
            backup_data["metadata"]["data_categories"].append("sales")
            total_records += len(sales)
        
        # Backup stock movements
        if options.include_stock_movements:
            stock_movements = await db.stock_movements.find({}).to_list(10000)
            for movement in stock_movements:
                if "_id" in movement:
                    movement.pop("_id")
                if "created_at" in movement:
                    movement["created_at"] = movement["created_at"].isoformat()
            backup_data["data"]["stock_movements"] = stock_movements
            backup_data["metadata"]["data_categories"].append("stock_movements")
            total_records += len(stock_movements)
        
        # Backup shop details
        if options.include_shop_details:
            shop = await db.shop.find_one()
            if shop:
                if "_id" in shop:
                    shop.pop("_id")
                if "created_at" in shop:
                    shop["created_at"] = shop["created_at"].isoformat()
                if "updated_at" in shop:
                    shop["updated_at"] = shop["updated_at"].isoformat()
                backup_data["data"]["shop"] = shop
                backup_data["metadata"]["data_categories"].append("shop")
                total_records += 1
        
        # Backup import logs
        if options.include_import_logs:
            import_logs = await db.import_logs.find({}).to_list(1000)
            for log in import_logs:
                if "_id" in log:
                    log.pop("_id")
                if "imported_at" in log:
                    log["imported_at"] = log["imported_at"].isoformat()
            backup_data["data"]["import_logs"] = import_logs
            backup_data["metadata"]["data_categories"].append("import_logs")
            total_records += len(import_logs)
        
        # Backup status checks
        if options.include_status_checks:
            status_checks = await db.status_checks.find({}).to_list(1000)
            for check in status_checks:
                if "_id" in check:
                    check.pop("_id")
                if "timestamp" in check:
                    check["timestamp"] = check["timestamp"].isoformat()
            backup_data["data"]["status_checks"] = status_checks
            backup_data["metadata"]["data_categories"].append("status_checks")
            total_records += len(status_checks)
        
        backup_data["metadata"]["total_records"] = total_records
        
        # Convert to JSON and calculate size
        backup_json = json.dumps(backup_data, default=str, indent=2)
        file_size = len(backup_json.encode('utf-8'))
        backup_data["metadata"]["file_size"] = file_size
        
        # Store backup metadata in database
        backup_metadata = {
            "id": backup_id,
            "name": backup_name,
            "created_at": datetime.utcnow(),
            "data_categories": backup_data["metadata"]["data_categories"],
            "total_records": total_records,
            "file_size": file_size,
            "backup_data": backup_json  # Store the actual backup data
        }
        
        await db.backups.insert_one(backup_metadata)
        
        return {
            "success": True,
            "backup_id": backup_id,
            "backup_name": backup_name,
            "total_records": total_records,
            "file_size": file_size,
            "data_categories": backup_data["metadata"]["data_categories"]
        }
        
    except Exception as e:
        logging.error(f"Backup creation error: {e}")
        raise HTTPException(status_code=500, detail=f"Backup creation failed: {str(e)}")

@api_router.get("/backup/list", response_model=BackupListResponse)
async def list_backups():
    """Get list of available backups"""
    try:
        backups = await db.backups.find({}, {
            "id": 1, "name": 1, "created_at": 1, 
            "data_categories": 1, "total_records": 1, "file_size": 1
        }).sort("created_at", -1).to_list(100)
        
        backup_list = []
        for backup in backups:
            if "_id" in backup:
                backup.pop("_id")
            backup_list.append(BackupMetadata(**backup))
        
        return BackupListResponse(backups=backup_list)
        
    except Exception as e:
        logging.error(f"Backup list error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch backup list")

@api_router.get("/backup/preview/{backup_id}", response_model=BackupPreview)
async def preview_backup(backup_id: str):
    """Preview backup contents before restore"""
    try:
        backup = await db.backups.find_one({"id": backup_id})
        if not backup:
            raise HTTPException(status_code=404, detail="Backup not found")
        
        # Parse backup data to get summary
        backup_data = json.loads(backup["backup_data"])
        data_summary = {}
        
        for category in backup["data_categories"]:
            if category in backup_data["data"]:
                if category == "shop":
                    data_summary[category] = 1 if backup_data["data"][category] else 0
                else:
                    data_summary[category] = len(backup_data["data"][category])
        
        backup.pop("_id")
        backup.pop("backup_data")  # Don't send full data in preview
        
        return BackupPreview(
            metadata=BackupMetadata(**backup),
            data_summary=data_summary,
            categories_available=backup["data_categories"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Backup preview error: {e}")
        raise HTTPException(status_code=500, detail="Failed to preview backup")

@api_router.get("/backup/download/{backup_id}")
async def download_backup(backup_id: str):
    """Download backup file"""
    try:
        backup = await db.backups.find_one({"id": backup_id})
        if not backup:
            raise HTTPException(status_code=404, detail="Backup not found")
        
        backup_json = backup["backup_data"]
        filename = f"{backup['name']}.json"
        
        def iter_content():
            yield backup_json.encode('utf-8')
        
        return StreamingResponse(
            iter_content(),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Backup download error: {e}")
        raise HTTPException(status_code=500, detail="Failed to download backup")

@api_router.post("/backup/restore")
async def restore_backup(options: RestoreOptions):
    """Restore data from backup with selective options"""
    try:
        restore_id = str(uuid.uuid4())
        
        # Get backup data
        backup = await db.backups.find_one({"id": options.backup_id})
        if not backup:
            raise HTTPException(status_code=404, detail="Backup not found")
        
        backup_data = json.loads(backup["backup_data"])
        restored_records = {}
        errors = []
        
        # Clear existing data if requested
        if options.clear_existing_data:
            if options.include_medicines:
                await db.medicines.delete_many({})
            if options.include_sales:
                await db.sales.delete_many({})
            if options.include_stock_movements:
                await db.stock_movements.delete_many({})
            if options.include_shop_details:
                await db.shop.delete_many({})
            if options.include_import_logs:
                await db.import_logs.delete_many({})
            if options.include_status_checks:
                await db.status_checks.delete_many({})
        
        # Restore medicines
        if options.include_medicines and "medicines" in backup_data["data"]:
            try:
                medicines = backup_data["data"]["medicines"]
                for medicine in medicines:
                    # Convert ISO format strings back to datetime objects
                    if "created_at" in medicine:
                        medicine["created_at"] = datetime.fromisoformat(medicine["created_at"].replace('Z', '+00:00'))
                    if "updated_at" in medicine:
                        medicine["updated_at"] = datetime.fromisoformat(medicine["updated_at"].replace('Z', '+00:00'))
                
                if medicines:
                    await db.medicines.insert_many(medicines)
                restored_records["medicines"] = len(medicines)
            except Exception as e:
                errors.append(f"Failed to restore medicines: {str(e)}")
                restored_records["medicines"] = 0
        
        # Restore sales
        if options.include_sales and "sales" in backup_data["data"]:
            try:
                sales = backup_data["data"]["sales"]
                for sale in sales:
                    if "created_at" in sale:
                        sale["created_at"] = datetime.fromisoformat(sale["created_at"].replace('Z', '+00:00'))
                
                if sales:
                    await db.sales.insert_many(sales)
                restored_records["sales"] = len(sales)
            except Exception as e:
                errors.append(f"Failed to restore sales: {str(e)}")
                restored_records["sales"] = 0
        
        # Restore stock movements
        if options.include_stock_movements and "stock_movements" in backup_data["data"]:
            try:
                movements = backup_data["data"]["stock_movements"]
                for movement in movements:
                    if "created_at" in movement:
                        movement["created_at"] = datetime.fromisoformat(movement["created_at"].replace('Z', '+00:00'))
                
                if movements:
                    await db.stock_movements.insert_many(movements)
                restored_records["stock_movements"] = len(movements)
            except Exception as e:
                errors.append(f"Failed to restore stock movements: {str(e)}")
                restored_records["stock_movements"] = 0
        
        # Restore shop details
        if options.include_shop_details and "shop" in backup_data["data"]:
            try:
                shop_data = backup_data["data"]["shop"]
                if shop_data:
                    if "created_at" in shop_data:
                        shop_data["created_at"] = datetime.fromisoformat(shop_data["created_at"].replace('Z', '+00:00'))
                    if "updated_at" in shop_data:
                        shop_data["updated_at"] = datetime.fromisoformat(shop_data["updated_at"].replace('Z', '+00:00'))
                    
                    await db.shop.replace_one({"id": shop_data["id"]}, shop_data, upsert=True)
                    restored_records["shop"] = 1
                else:
                    restored_records["shop"] = 0
            except Exception as e:
                errors.append(f"Failed to restore shop details: {str(e)}")
                restored_records["shop"] = 0
        
        # Restore import logs
        if options.include_import_logs and "import_logs" in backup_data["data"]:
            try:
                logs = backup_data["data"]["import_logs"]
                for log in logs:
                    if "imported_at" in log:
                        log["imported_at"] = datetime.fromisoformat(log["imported_at"].replace('Z', '+00:00'))
                
                if logs:
                    await db.import_logs.insert_many(logs)
                restored_records["import_logs"] = len(logs)
            except Exception as e:
                errors.append(f"Failed to restore import logs: {str(e)}")
                restored_records["import_logs"] = 0
        
        # Restore status checks
        if options.include_status_checks and "status_checks" in backup_data["data"]:
            try:
                checks = backup_data["data"]["status_checks"]
                for check in checks:
                    if "timestamp" in check:
                        check["timestamp"] = datetime.fromisoformat(check["timestamp"].replace('Z', '+00:00'))
                
                if checks:
                    await db.status_checks.insert_many(checks)
                restored_records["status_checks"] = len(checks)
            except Exception as e:
                errors.append(f"Failed to restore status checks: {str(e)}")
                restored_records["status_checks"] = 0
        
        # Store restore log
        restore_log = {
            "restore_id": restore_id,
            "backup_id": options.backup_id,
            "restored_at": datetime.utcnow(),
            "restored_records": restored_records,
            "errors": errors,
            "options": options.dict()
        }
        
        await db.restore_logs.insert_one(restore_log)
        
        return RestoreResult(
            success=len(errors) == 0,
            restored_records=restored_records,
            errors=errors,
            restore_id=restore_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Restore error: {e}")
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")

@api_router.delete("/backup/{backup_id}")
async def delete_backup(backup_id: str):
    """Delete a backup"""
    try:
        result = await db.backups.delete_one({"id": backup_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Backup not found")
        
        return {"success": True, "message": "Backup deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Backup deletion error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete backup")

@api_router.post("/backup/upload")
async def upload_backup_file(file: UploadFile = File(...)):
    """Upload and restore from backup file"""
    try:
        if not file.filename.endswith('.json'):
            raise HTTPException(status_code=400, detail="Only JSON backup files are supported")
        
        # Read and parse the uploaded file
        content = await file.read()
        try:
            backup_data = json.loads(content.decode('utf-8'))
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON format")
        
        # Validate backup structure
        if "metadata" not in backup_data or "data" not in backup_data:
            raise HTTPException(status_code=400, detail="Invalid backup file structure")
        
        # Generate new backup ID and store in database
        backup_id = str(uuid.uuid4())
        backup_metadata = backup_data["metadata"]
        backup_metadata["id"] = backup_id
        backup_metadata["created_at"] = datetime.utcnow()
        
        # Store in database
        backup_record = {
            "id": backup_id,
            "name": backup_metadata.get("name", f"Uploaded_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"),
            "created_at": datetime.utcnow(),
            "data_categories": backup_metadata.get("data_categories", []),
            "total_records": backup_metadata.get("total_records", 0),
            "file_size": len(content),
            "backup_data": json.dumps(backup_data, default=str)
        }
        
        await db.backups.insert_one(backup_record)
        
        return {
            "success": True,
            "backup_id": backup_id,
            "message": "Backup file uploaded successfully",
            "name": backup_record["name"],
            "data_categories": backup_record["data_categories"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Backup upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


# Include the router in the main app
app.include_router(api_router)

# Initialize notification service
notification_service = TelegramNotificationService(db)

# Initialize scheduler
scheduler = AsyncIOScheduler()

# Periodic tasks
async def periodic_low_stock_check():
    """Periodic task to check low stock and send alerts"""
    try:
        # Get Telegram settings
        settings = await db.telegram_settings.find_one()
        if not settings or not settings.get('low_stock_alerts_enabled') or not settings.get('notifications_enabled'):
            return
        
        # Get all medicines with their notification settings
        medicines = await db.medicines.find().to_list(10000)
        low_stock_medicines = []
        
        for medicine in medicines:
            # Get notification settings for this medicine
            notification_settings = await db.medicine_notification_settings.find_one({"medicine_id": medicine["id"]})
            threshold = notification_settings.get("low_stock_threshold", 10) if notification_settings else 10
            enabled = notification_settings.get("enabled", True) if notification_settings else True
            
            if enabled and medicine.get("stock_quantity", 0) <= threshold:
                low_stock_medicines.append({
                    "id": medicine["id"],
                    "name": medicine["name"],
                    "current_stock": medicine.get("stock_quantity", 0),
                    "threshold": threshold,
                    "price": medicine.get("price", 0)
                })
        
        if low_stock_medicines:
            await notification_service.send_low_stock_alert(low_stock_medicines)
            
    except Exception as e:
        logging.error(f"Periodic low stock check error: {e}")

async def periodic_expiry_check():
    """Periodic task to check expiring medicines and send alerts"""
    try:
        # Get Telegram settings
        settings = await db.telegram_settings.find_one()
        if not settings or not settings.get('expiry_alerts_enabled') or not settings.get('notifications_enabled'):
            return
        
        # Get all medicines with their notification settings
        medicines = await db.medicines.find().to_list(10000)
        expiring_medicines = []
        
        current_date = datetime.now().date()
        
        for medicine in medicines:
            # Get notification settings for this medicine
            notification_settings = await db.medicine_notification_settings.find_one({"medicine_id": medicine["id"]})
            alert_days = notification_settings.get("expiry_alert_days", 30) if notification_settings else 30
            enabled = notification_settings.get("enabled", True) if notification_settings else True
            
            if enabled and medicine.get("expiry_date"):
                try:
                    expiry_date = datetime.fromisoformat(medicine["expiry_date"]).date()
                    days_to_expiry = (expiry_date - current_date).days
                    
                    if 0 <= days_to_expiry <= alert_days:
                        expiring_medicines.append({
                            "id": medicine["id"],
                            "name": medicine["name"],
                            "expiry_date": medicine["expiry_date"],
                            "days_to_expiry": days_to_expiry,
                            "stock_quantity": medicine.get("stock_quantity", 0),
                            "batch_number": medicine.get("batch_number", "N/A"),
                            "alert_days": alert_days
                        })
                except (ValueError, TypeError):
                    continue
        
        if expiring_medicines:
            await notification_service.send_expiry_alert(expiring_medicines)
            
    except Exception as e:
        logging.error(f"Periodic expiry check error: {e}")

async def periodic_expired_check():
    """Periodic task to check already expired medicines with remaining stock"""
    try:
        # Get Telegram settings
        settings = await db.telegram_settings.find_one()
        if not settings or not settings.get('expired_alerts_enabled') or not settings.get('notifications_enabled'):
            return
        
        # Get all medicines with their notification settings
        medicines = await db.medicines.find().to_list(10000)
        expired_medicines = []
        
        current_date = datetime.now().date()
        
        for medicine in medicines:
            # Get notification settings for this medicine
            notification_settings = await db.medicine_notification_settings.find_one({"medicine_id": medicine["id"]})
            enabled = notification_settings.get("enabled", True) if notification_settings else True
            
            if enabled and medicine.get("expiry_date") and medicine.get("stock_quantity", 0) > 0:
                try:
                    expiry_date = datetime.fromisoformat(medicine["expiry_date"]).date()
                    days_expired = (current_date - expiry_date).days
                    
                    # If medicine is expired (days_expired > 0) and still has stock
                    if days_expired > 0:
                        expired_medicines.append({
                            "id": medicine["id"],
                            "name": medicine["name"],
                            "expiry_date": medicine["expiry_date"],
                            "days_expired": days_expired,
                            "stock_quantity": medicine.get("stock_quantity", 0),
                            "batch_number": medicine.get("batch_number", "N/A"),
                            "price": medicine.get("price", 0),
                            "supplier": medicine.get("supplier", "N/A")
                        })
                except (ValueError, TypeError):
                    continue
        
        if expired_medicines:
            await notification_service.send_expired_alert(expired_medicines)
            
    except Exception as e:
        logging.error(f"Periodic expired check error: {e}")

async def daily_sales_report_task():
    """Task to send daily sales report"""
    try:
        settings = await db.telegram_settings.find_one()
        if not settings or not settings.get('daily_reports_enabled') or not settings.get('notifications_enabled'):
            return
        
        date_str = datetime.now().strftime('%Y-%m-%d')
        await notification_service.send_daily_sales_report(date_str)
        
    except Exception as e:
        logging.error(f"Daily sales report task error: {e}")

# Schedule periodic tasks
def setup_scheduler():
    """Setup scheduled tasks"""
    try:
        # Default schedules - will be updated based on user settings
        # Low stock check every 4 hours
        scheduler.add_job(
            periodic_low_stock_check,
            CronTrigger(minute=0, hour="*/4"),  # Every 4 hours at minute 0
            id='low_stock_check',
            replace_existing=True
        )
        
        # Expiry check daily at 9 AM
        scheduler.add_job(
            periodic_expiry_check,
            CronTrigger(minute=0, hour=9),  # 9:00 AM daily
            id='expiry_check',
            replace_existing=True
        )
        
        # Expired medicines check daily at 10 AM
        scheduler.add_job(
            periodic_expired_check,
            CronTrigger(minute=0, hour=10),  # 10:00 AM daily
            id='expired_check',
            replace_existing=True
        )
        
        # Daily sales report (will be updated based on user settings)
        scheduler.add_job(
            daily_sales_report_task,
            CronTrigger(minute=0, hour=18),  # 6:00 PM daily (default)
            id='daily_sales_report',
            replace_existing=True
        )
        
        if not scheduler.running:
            scheduler.start()
            logging.info("Scheduler started successfully")
        
        # Update schedules based on database settings
        async def init_schedules():
            await update_notification_schedules()
            
        # Schedule the initialization
        import asyncio
        if hasattr(asyncio, '_get_running_loop') and asyncio._get_running_loop():
            asyncio.create_task(init_schedules())
        else:
            # Run in new event loop if no loop is running
            try:
                asyncio.run(init_schedules())
            except:
                pass
            
    except Exception as e:
        logging.error(f"Failed to setup scheduler: {e}")

# Update daily report schedule based on settings
async def update_daily_report_schedule():
    """Update daily report schedule based on current settings"""
    try:
        settings = await db.telegram_settings.find_one()
        if settings and settings.get('daily_report_time'):
            time_parts = settings['daily_report_time'].split(':')
            hour = int(time_parts[0])
            minute = int(time_parts[1]) if len(time_parts) > 1 else 0
            
            # Remove existing job
            try:
                scheduler.remove_job('daily_sales_report')
            except:
                pass
            
            # Add updated job
            scheduler.add_job(
                daily_sales_report_task,
                CronTrigger(minute=minute, hour=hour),
                id='daily_sales_report',
                replace_existing=True
            )
    except Exception as e:
        logging.error(f"Failed to update daily report schedule: {e}")

# Update all notification schedules based on settings
async def update_notification_schedules():
    """Update all notification schedules based on current settings"""
    try:
        settings = await db.telegram_settings.find_one()
        if not settings:
            return
            
        # Update daily report schedule
        if settings.get('daily_report_time'):
            time_parts = settings['daily_report_time'].split(':')
            hour = int(time_parts[0])
            minute = int(time_parts[1]) if len(time_parts) > 1 else 0
            
            try:
                scheduler.remove_job('daily_sales_report')
            except:
                pass
            
            scheduler.add_job(
                daily_sales_report_task,
                CronTrigger(minute=minute, hour=hour),
                id='daily_sales_report',
                replace_existing=True
            )
        
        # Update low stock check schedule
        if settings.get('low_stock_check_time'):
            try:
                scheduler.remove_job('low_stock_check')
            except:
                pass
            
            # Parse cron expression for low stock check
            cron_parts = settings['low_stock_check_time'].split()
            if len(cron_parts) >= 5:
                scheduler.add_job(
                    periodic_low_stock_check,
                    CronTrigger.from_crontab(settings['low_stock_check_time']),
                    id='low_stock_check',
                    replace_existing=True
                )
        
        # Update expiry check schedule
        if settings.get('expiry_check_time'):
            try:
                scheduler.remove_job('expiry_check')
            except:
                pass
            
            # Parse cron expression for expiry check
            cron_parts = settings['expiry_check_time'].split()
            if len(cron_parts) >= 5:
                scheduler.add_job(
                    periodic_expiry_check,
                    CronTrigger.from_crontab(settings['expiry_check_time']),
                    id='expiry_check',
                    replace_existing=True
                )
        
        # Update expired check schedule
        if settings.get('expired_check_time'):
            try:
                scheduler.remove_job('expired_check')
            except:
                pass
            
            # Parse cron expression for expired check
            cron_parts = settings['expired_check_time'].split()
            if len(cron_parts) >= 5:
                scheduler.add_job(
                    periodic_expired_check,
                    CronTrigger.from_crontab(settings['expired_check_time']),
                    id='expired_check',
                    replace_existing=True
                )
                
    except Exception as e:
        logging.error(f"Failed to update notification schedules: {e}")

# Setup scheduler on startup
setup_scheduler()

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the API router
app.include_router(api_router)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
