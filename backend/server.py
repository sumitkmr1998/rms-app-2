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

# Telegram imports
import httpx
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

# Global scheduler instance for Telegram notifications
scheduler = AsyncIOScheduler()


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

# Telegram Notification Models
class TelegramSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bot_token: str
    chat_id: str
    enabled: bool = True
    daily_sales_report_enabled: bool = True
    daily_sales_report_time: str = "18:00"  # Format: HH:MM
    low_stock_alerts_enabled: bool = True
    low_stock_threshold: int = 10
    immediate_low_stock_alerts: bool = True
    daily_low_stock_reminder: bool = True
    daily_low_stock_reminder_time: str = "09:00"
    near_expiry_alerts_enabled: bool = True
    near_expiry_days_threshold: int = 30
    near_expiry_alert_time: str = "09:00"
    expired_alerts_enabled: bool = True
    expired_alert_time: str = "09:00"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TelegramSettingsUpdate(BaseModel):
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None
    enabled: Optional[bool] = None
    daily_sales_report_enabled: Optional[bool] = None
    daily_sales_report_time: Optional[str] = None
    low_stock_alerts_enabled: Optional[bool] = None
    low_stock_threshold: Optional[int] = None
    immediate_low_stock_alerts: Optional[bool] = None
    daily_low_stock_reminder: Optional[bool] = None
    daily_low_stock_reminder_time: Optional[str] = None
    near_expiry_alerts_enabled: Optional[bool] = None
    near_expiry_days_threshold: Optional[int] = None
    near_expiry_alert_time: Optional[str] = None
    expired_alerts_enabled: Optional[bool] = None
    expired_alert_time: Optional[str] = None

class TelegramTestRequest(BaseModel):
    bot_token: str
    chat_id: str

class NotificationHistory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # 'daily_sales', 'low_stock', 'near_expiry', 'expired'
    message: str
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    success: bool
    error_message: Optional[str] = None

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

# Patient Management Models
class ProcedureType(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    fee: float
    description: Optional[str] = None

class DefaultFeeSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    consultation_fee: float = 100.0
    procedures: List[ProcedureType] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Patient(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    address: str
    patient_number: str  # Auto-generated patient ID like PAT001
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class PatientVisit(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    patient_name: str  # Denormalized for easier queries
    visit_date: datetime = Field(default_factory=datetime.utcnow)
    service_type: str  # 'consultation' or 'procedure'
    procedure_name: Optional[str] = None  # Name of procedure if service_type is 'procedure'
    fee_amount: float
    total_fee: float
    payment_method: str = 'cash'
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PatientCreate(BaseModel):
    name: str
    phone: str
    address: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None

class PatientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None

class PatientVisitCreate(BaseModel):
    patient_id: str
    service_type: str  # 'consultation' or 'procedure'
    procedure_name: Optional[str] = None
    fee_amount: float
    payment_method: str = 'cash'
    notes: Optional[str] = None

class PatientAnalyticsRequest(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    date_range: Optional[str] = None  # 'today', 'yesterday', 'this_month', 'custom'

class PatientAnalyticsResponse(BaseModel):
    total_patients: int
    total_visits: int
    total_revenue: float
    consultations_count: int
    procedures_count: int
    consultation_revenue: float
    procedure_revenue: float
    daily_visits: List[Dict]
    popular_procedures: List[Dict]
    date_range: str
    period_label: str

# Global processor instance
tally_processor = TallyDataProcessor()


# Telegram Service Class
class TelegramService:
    def __init__(self):
        self.base_url = "https://api.telegram.org/bot"
    
    async def send_message(self, bot_token: str, chat_id: str, message: str) -> bool:
        """Send a message to Telegram chat"""
        try:
            url = f"{self.base_url}{bot_token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "HTML"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload)
                result = response.json()
                
                if response.status_code == 200 and result.get("ok"):
                    return True
                else:
                    error_msg = result.get("description", "Unknown error")
                    logging.error(f"Telegram send failed: {error_msg}")
                    return False
                    
        except Exception as e:
            logging.error(f"Telegram send error: {str(e)}")
            return False
    
    async def test_connection(self, bot_token: str, chat_id: str) -> Dict[str, Any]:
        """Test Telegram bot connection"""
        try:
            # Test bot info
            url = f"{self.base_url}{bot_token}/getMe"
            async with httpx.AsyncClient() as client:
                response = await client.get(url)
                bot_info = response.json()
                
                if not (response.status_code == 200 and bot_info.get("ok")):
                    return {
                        "success": False,
                        "error": f"Invalid bot token: {bot_info.get('description', 'Unknown error')}"
                    }
                
                # Test sending a message
                test_message = "🔧 Telegram notification connection test successful!"
                send_success = await self.send_message(bot_token, chat_id, test_message)
                
                if send_success:
                    return {
                        "success": True,
                        "bot_info": bot_info.get("result", {}),
                        "message": "Connection test successful"
                    }
                else:
                    return {
                        "success": False,
                        "error": "Failed to send test message. Please check chat ID."
                    }
                    
        except Exception as e:
            return {
                "success": False,
                "error": f"Connection error: {str(e)}"
            }

# Global telegram service instance
telegram_service = TelegramService()


# Notification Functions
async def send_daily_sales_report():
    """Send daily sales report"""
    try:
        settings = await get_telegram_settings()
        if not (settings and settings.get("enabled") and settings.get("daily_sales_report_enabled")):
            return
        
        # Get today's sales
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        
        sales = await db.sales.find({
            "created_at": {"$gte": today, "$lt": tomorrow}
        }).to_list(1000)
        
        if not sales:
            message = f"📊 <b>Daily Sales Report - {today.strftime('%d %b %Y')}</b>\n\n❌ No sales recorded today."
        else:
            total_sales = sum(sale.get("total_amount", 0) for sale in sales)
            total_transactions = len(sales)
            
            # Calculate items sold
            total_items = 0
            medicine_sales = defaultdict(int)
            for sale in sales:
                for item in sale.get("items", []):
                    qty = item.get("quantity", 0)
                    total_items += qty
                    medicine_sales[item.get("medicine_name", "Unknown")] += qty
            
            # Top selling medicine
            top_medicine = max(medicine_sales.items(), key=lambda x: x[1]) if medicine_sales else ("None", 0)
            
            message = f"""📊 <b>Daily Sales Report - {today.strftime('%d %b %Y')}</b>

💰 <b>Total Sales:</b> ₹{total_sales:,.2f}
🛒 <b>Transactions:</b> {total_transactions}
📦 <b>Items Sold:</b> {total_items}
🏆 <b>Top Medicine:</b> {top_medicine[0]} ({top_medicine[1]} units)

✅ Have a great day ahead!"""
        
        success = await telegram_service.send_message(
            settings["bot_token"], settings["chat_id"], message
        )
        
        # Log notification
        await log_notification("daily_sales", message, success)
        
    except Exception as e:
        logging.error(f"Daily sales report error: {str(e)}")
        await log_notification("daily_sales", str(e), False, str(e))


async def send_low_stock_alerts():
    """Send low stock alerts"""
    try:
        settings = await get_telegram_settings()
        if not (settings and settings.get("enabled") and settings.get("low_stock_alerts_enabled")):
            return
        
        threshold = settings.get("low_stock_threshold", 10)
        
        # Get low stock medicines
        low_stock_medicines = await db.medicines.find({
            "stock_quantity": {"$lte": threshold}
        }).to_list(1000)
        
        if not low_stock_medicines:
            return
        
        out_of_stock = [m for m in low_stock_medicines if m.get("stock_quantity", 0) == 0]
        low_stock = [m for m in low_stock_medicines if m.get("stock_quantity", 0) > 0]
        
        message = f"⚠️ <b>Low Stock Alert</b>\n\n"
        
        if out_of_stock:
            message += f"🚨 <b>OUT OF STOCK ({len(out_of_stock)}):</b>\n"
            for medicine in out_of_stock[:5]:  # Limit to 5 items
                message += f"• {medicine.get('name', 'Unknown')} - <b>0 units</b>\n"
            if len(out_of_stock) > 5:
                message += f"... and {len(out_of_stock) - 5} more items\n"
            message += "\n"
        
        if low_stock:
            message += f"⚠️ <b>LOW STOCK ({len(low_stock)}):</b>\n"
            for medicine in low_stock[:5]:  # Limit to 5 items
                qty = medicine.get('stock_quantity', 0)
                message += f"• {medicine.get('name', 'Unknown')} - <b>{qty} units left</b>\n"
            if len(low_stock) > 5:
                message += f"... and {len(low_stock) - 5} more items\n"
        
        message += f"\n📋 Please restock these medicines soon!"
        
        success = await telegram_service.send_message(
            settings["bot_token"], settings["chat_id"], message
        )
        
        await log_notification("low_stock", message, success)
        
    except Exception as e:
        logging.error(f"Low stock alert error: {str(e)}")
        await log_notification("low_stock", str(e), False, str(e))


async def send_near_expiry_alerts():
    """Send near expiry alerts"""
    try:
        settings = await get_telegram_settings()
        if not (settings and settings.get("enabled") and settings.get("near_expiry_alerts_enabled")):
            return
        
        days_threshold = settings.get("near_expiry_days_threshold", 30)
        cutoff_date = datetime.utcnow() + timedelta(days=days_threshold)
        today = datetime.utcnow()
        
        # Get medicines expiring soon
        near_expiry_medicines = await db.medicines.find({}).to_list(1000)
        
        expiring_soon = []
        for medicine in near_expiry_medicines:
            try:
                expiry_date = datetime.strptime(medicine.get("expiry_date", ""), "%Y-%m-%d")
                if today <= expiry_date <= cutoff_date:
                    days_to_expire = (expiry_date - today).days
                    expiring_soon.append((medicine, days_to_expire))
            except:
                continue
        
        if not expiring_soon:
            return
        
        # Sort by days to expire
        expiring_soon.sort(key=lambda x: x[1])
        
        message = f"⏰ <b>Near Expiry Alert</b>\n\n"
        message += f"📅 <b>Medicines expiring in {days_threshold} days:</b>\n\n"
        
        for medicine, days in expiring_soon[:10]:  # Limit to 10 items
            qty = medicine.get('stock_quantity', 0)
            name = medicine.get('name', 'Unknown')
            expiry_date = medicine.get('expiry_date', 'Unknown')
            
            if days <= 7:
                urgency = "🚨 URGENT"
            elif days <= 15:
                urgency = "⚠️ SOON"
            else:
                urgency = "📅"
                
            message += f"{urgency} <b>{name}</b>\n"
            message += f"   Expires: {expiry_date} ({days} days)\n"
            message += f"   Stock: {qty} units\n\n"
        
        if len(expiring_soon) > 10:
            message += f"... and {len(expiring_soon) - 10} more items\n\n"
        
        message += "💡 Consider selling or returning these items soon!"
        
        success = await telegram_service.send_message(
            settings["bot_token"], settings["chat_id"], message
        )
        
        await log_notification("near_expiry", message, success)
        
    except Exception as e:
        logging.error(f"Near expiry alert error: {str(e)}")
        await log_notification("near_expiry", str(e), False, str(e))


async def send_expired_alerts():
    """Send expired product alerts"""
    try:
        settings = await get_telegram_settings()
        if not (settings and settings.get("enabled") and settings.get("expired_alerts_enabled")):
            return
        
        today = datetime.utcnow()
        
        # Get expired medicines
        all_medicines = await db.medicines.find({}).to_list(1000)
        
        expired_medicines = []
        for medicine in all_medicines:
            try:
                expiry_date = datetime.strptime(medicine.get("expiry_date", ""), "%Y-%m-%d")
                if expiry_date < today:
                    days_expired = (today - expiry_date).days
                    expired_medicines.append((medicine, days_expired))
            except:
                continue
        
        if not expired_medicines:
            return
        
        # Sort by days expired (most recent first)
        expired_medicines.sort(key=lambda x: x[1])
        
        message = f"🚨 <b>Expired Products Alert</b>\n\n"
        message += f"❌ <b>Found {len(expired_medicines)} expired medicines:</b>\n\n"
        
        total_value = 0
        for medicine, days in expired_medicines[:10]:  # Limit to 10 items
            qty = medicine.get('stock_quantity', 0)
            price = medicine.get('price', 0)
            name = medicine.get('name', 'Unknown')
            expiry_date = medicine.get('expiry_date', 'Unknown')
            value = qty * price
            total_value += value
            
            message += f"💊 <b>{name}</b>\n"
            message += f"   Expired: {expiry_date} ({days} days ago)\n"
            message += f"   Stock: {qty} units (₹{value:,.2f})\n\n"
        
        if len(expired_medicines) > 10:
            remaining_value = sum((m[0].get('stock_quantity', 0) * m[0].get('price', 0)) for m in expired_medicines[10:])
            total_value += remaining_value
            message += f"... and {len(expired_medicines) - 10} more items\n\n"
        
        message += f"💰 <b>Total Value:</b> ₹{total_value:,.2f}\n"
        message += "⚠️ Please remove these items from inventory!"
        
        success = await telegram_service.send_message(
            settings["bot_token"], settings["chat_id"], message
        )
        
        await log_notification("expired", message, success)
        
    except Exception as e:
        logging.error(f"Expired alert error: {str(e)}")
        await log_notification("expired", str(e), False, str(e))


async def send_immediate_low_stock_alert(medicine_name: str, current_stock: int, threshold: int):
    """Send immediate low stock alert when stock goes below threshold"""
    try:
        settings = await get_telegram_settings()
        if not (settings and settings.get("enabled") and settings.get("low_stock_alerts_enabled") and settings.get("immediate_low_stock_alerts")):
            return
        
        if current_stock == 0:
            message = f"🚨 <b>OUT OF STOCK ALERT</b>\n\n"
            message += f"💊 <b>{medicine_name}</b> is now out of stock!\n"
            message += f"📦 Current stock: <b>0 units</b>\n\n"
            message += f"⚠️ Immediate restocking required!"
        else:
            message = f"⚠️ <b>LOW STOCK ALERT</b>\n\n"
            message += f"💊 <b>{medicine_name}</b> is running low!\n"
            message += f"📦 Current stock: <b>{current_stock} units</b>\n"
            message += f"📋 Threshold: {threshold} units\n\n"
            message += f"💡 Please consider restocking soon."
        
        success = await telegram_service.send_message(
            settings["bot_token"], settings["chat_id"], message
        )
        
        await log_notification("immediate_low_stock", message, success)
        
    except Exception as e:
        logging.error(f"Immediate low stock alert error: {str(e)}")


async def get_telegram_settings():
    """Get telegram settings from database"""
    try:
        settings = await db.telegram_settings.find_one()
        return settings
    except Exception as e:
        logging.error(f"Error getting telegram settings: {str(e)}")
        return None


async def log_notification(notification_type: str, message: str, success: bool, error_message: str = None):
    """Log notification to database"""
    try:
        notification = NotificationHistory(
            type=notification_type,
            message=message,
            success=success,
            error_message=error_message
        )
        await db.notification_history.insert_one(notification.dict())
    except Exception as e:
        logging.error(f"Error logging notification: {str(e)}")


def setup_scheduler():
    """Setup scheduled tasks"""
    scheduler.start()
    
    # Add default jobs (will be updated when settings are changed)
    scheduler.add_job(
        send_daily_sales_report,
        CronTrigger(hour=18, minute=0),
        id="daily_sales_report",
        replace_existing=True
    )
    
    scheduler.add_job(
        send_low_stock_alerts,
        CronTrigger(hour=9, minute=0),
        id="daily_low_stock_reminder",
        replace_existing=True
    )
    
    scheduler.add_job(
        send_near_expiry_alerts,
        CronTrigger(hour=9, minute=0),
        id="near_expiry_alerts",
        replace_existing=True
    )
    
    scheduler.add_job(
        send_expired_alerts,
        CronTrigger(hour=9, minute=0),
        id="expired_alerts",
        replace_existing=True
    )


async def update_scheduler_jobs(settings: dict):
    """Update scheduler jobs based on settings"""
    try:
        # Daily sales report
        if settings.get("daily_sales_report_enabled"):
            time_parts = settings.get("daily_sales_report_time", "18:00").split(":")
            hour, minute = int(time_parts[0]), int(time_parts[1])
            scheduler.add_job(
                send_daily_sales_report,
                CronTrigger(hour=hour, minute=minute),
                id="daily_sales_report",
                replace_existing=True
            )
        else:
            try:
                scheduler.remove_job("daily_sales_report")
            except:
                pass
        
        # Daily low stock reminder
        if settings.get("daily_low_stock_reminder") and settings.get("low_stock_alerts_enabled"):
            time_parts = settings.get("daily_low_stock_reminder_time", "09:00").split(":")
            hour, minute = int(time_parts[0]), int(time_parts[1])
            scheduler.add_job(
                send_low_stock_alerts,
                CronTrigger(hour=hour, minute=minute),
                id="daily_low_stock_reminder",
                replace_existing=True
            )
        else:
            try:
                scheduler.remove_job("daily_low_stock_reminder")
            except:
                pass
        
        # Near expiry alerts
        if settings.get("near_expiry_alerts_enabled"):
            time_parts = settings.get("near_expiry_alert_time", "09:00").split(":")
            hour, minute = int(time_parts[0]), int(time_parts[1])
            scheduler.add_job(
                send_near_expiry_alerts,
                CronTrigger(hour=hour, minute=minute),
                id="near_expiry_alerts",
                replace_existing=True
            )
        else:
            try:
                scheduler.remove_job("near_expiry_alerts")
            except:
                pass
        
        # Expired alerts
        if settings.get("expired_alerts_enabled"):
            time_parts = settings.get("expired_alert_time", "09:00").split(":")
            hour, minute = int(time_parts[0]), int(time_parts[1])
            scheduler.add_job(
                send_expired_alerts,
                CronTrigger(hour=hour, minute=minute),
                id="expired_alerts",
                replace_existing=True
            )
        else:
            try:
                scheduler.remove_job("expired_alerts")
            except:
                pass
                
    except Exception as e:
        logging.error(f"Error updating scheduler jobs: {str(e)}")


async def check_and_trigger_low_stock_alert(medicine_id: str, new_stock: int):
    """Check if medicine stock is low and trigger immediate alert if needed"""
    try:
        settings = await get_telegram_settings()
        if not (settings and settings.get("enabled") and settings.get("immediate_low_stock_alerts")):
            return
        
        threshold = settings.get("low_stock_threshold", 10)
        
        if new_stock <= threshold:
            # Get medicine details
            medicine = await db.medicines.find_one({"id": medicine_id})
            if medicine:
                await send_immediate_low_stock_alert(
                    medicine.get("name", "Unknown"),
                    new_stock,
                    threshold
                )
    except Exception as e:
        logging.error(f"Error checking low stock alert: {str(e)}")

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "MediPOS RMS Analytics API with Telegram Notifications"}


# Telegram API Endpoints
@api_router.get("/telegram/settings")
async def get_telegram_settings_api():
    """Get Telegram notification settings"""
    try:
        settings = await db.telegram_settings.find_one()
        if settings:
            settings.pop("_id", None)
            # Don't expose bot token in full for security
            if settings.get("bot_token"):
                settings["bot_token"] = settings["bot_token"][:10] + "..." + settings["bot_token"][-10:]
            return settings
        else:
            # Return default settings
            return {
                "id": str(uuid.uuid4()),
                "bot_token": "",
                "chat_id": "",
                "enabled": False,
                "daily_sales_report_enabled": True,
                "daily_sales_report_time": "18:00",
                "low_stock_alerts_enabled": True,
                "low_stock_threshold": 10,
                "immediate_low_stock_alerts": True,
                "daily_low_stock_reminder": True,
                "daily_low_stock_reminder_time": "09:00",
                "near_expiry_alerts_enabled": True,
                "near_expiry_days_threshold": 30,
                "near_expiry_alert_time": "09:00",
                "expired_alerts_enabled": True,
                "expired_alert_time": "09:00",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
    except Exception as e:
        logging.error(f"Error getting telegram settings: {e}")
        raise HTTPException(status_code=500, detail="Error fetching telegram settings")


@api_router.put("/telegram/settings")
async def update_telegram_settings_api(settings_data: TelegramSettingsUpdate):
    """Update Telegram notification settings"""
    try:
        existing_settings = await db.telegram_settings.find_one()
        
        if existing_settings:
            # Update existing settings
            update_data = {k: v for k, v in settings_data.dict().items() if v is not None}
            update_data["updated_at"] = datetime.utcnow()
            
            result = await db.telegram_settings.update_one(
                {"id": existing_settings["id"]},
                {"$set": update_data}
            )
            
            if result.modified_count:
                updated_settings = await db.telegram_settings.find_one({"id": existing_settings["id"]})
                updated_settings.pop("_id")
                
                # Update scheduler jobs
                await update_scheduler_jobs(updated_settings)
                
                return updated_settings
            else:
                existing_settings.pop("_id")
                return existing_settings
        else:
            # Create new settings
            new_settings_data = {
                "id": str(uuid.uuid4()),
                "bot_token": settings_data.bot_token or "",
                "chat_id": settings_data.chat_id or "",
                "enabled": settings_data.enabled if settings_data.enabled is not None else False,
                "daily_sales_report_enabled": settings_data.daily_sales_report_enabled if settings_data.daily_sales_report_enabled is not None else True,
                "daily_sales_report_time": settings_data.daily_sales_report_time or "18:00",
                "low_stock_alerts_enabled": settings_data.low_stock_alerts_enabled if settings_data.low_stock_alerts_enabled is not None else True,
                "low_stock_threshold": settings_data.low_stock_threshold or 10,
                "immediate_low_stock_alerts": settings_data.immediate_low_stock_alerts if settings_data.immediate_low_stock_alerts is not None else True,
                "daily_low_stock_reminder": settings_data.daily_low_stock_reminder if settings_data.daily_low_stock_reminder is not None else True,
                "daily_low_stock_reminder_time": settings_data.daily_low_stock_reminder_time or "09:00",
                "near_expiry_alerts_enabled": settings_data.near_expiry_alerts_enabled if settings_data.near_expiry_alerts_enabled is not None else True,
                "near_expiry_days_threshold": settings_data.near_expiry_days_threshold or 30,
                "near_expiry_alert_time": settings_data.near_expiry_alert_time or "09:00",
                "expired_alerts_enabled": settings_data.expired_alerts_enabled if settings_data.expired_alerts_enabled is not None else True,
                "expired_alert_time": settings_data.expired_alert_time or "09:00",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            settings_obj = TelegramSettings(**new_settings_data)
            await db.telegram_settings.insert_one(settings_obj.dict())
            
            # Update scheduler jobs
            await update_scheduler_jobs(new_settings_data)
            
            return settings_obj.dict()
            
    except Exception as e:
        logging.error(f"Error updating telegram settings: {e}")
        raise HTTPException(status_code=500, detail="Error updating telegram settings")


@api_router.post("/telegram/test")
async def test_telegram_connection(request: TelegramTestRequest):
    """Test Telegram bot connection"""
    try:
        result = await telegram_service.test_connection(request.bot_token, request.chat_id)
        return result
    except Exception as e:
        logging.error(f"Telegram test error: {e}")
        raise HTTPException(status_code=500, detail="Error testing telegram connection")


@api_router.post("/telegram/send-test")
async def send_test_notification():
    """Send test notification"""
    try:
        settings = await get_telegram_settings()
        if not settings or not settings.get("enabled"):
            raise HTTPException(status_code=400, detail="Telegram notifications are not enabled")
        
        test_message = f"""🧪 <b>Test Notification</b>

✅ Your Telegram notifications are working perfectly!

📱 Bot: Connected
💬 Chat: Active  
🕐 Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC

🎉 You're all set to receive notifications!"""
        
        success = await telegram_service.send_message(
            settings["bot_token"], settings["chat_id"], test_message
        )
        
        if success:
            await log_notification("test", test_message, True)
            return {"success": True, "message": "Test notification sent successfully"}
        else:
            return {"success": False, "message": "Failed to send test notification"}
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Test notification error: {e}")
        raise HTTPException(status_code=500, detail="Error sending test notification")


@api_router.post("/telegram/send-manual/{notification_type}")
async def send_manual_notification(notification_type: str):
    """Send manual notification"""
    try:
        if notification_type == "daily_sales":
            await send_daily_sales_report()
        elif notification_type == "low_stock":
            await send_low_stock_alerts()
        elif notification_type == "near_expiry":
            await send_near_expiry_alerts()
        elif notification_type == "expired":
            await send_expired_alerts()
        else:
            raise HTTPException(status_code=400, detail="Invalid notification type")
        
        return {"success": True, "message": f"{notification_type.replace('_', ' ').title()} notification sent"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Manual notification error: {e}")
        raise HTTPException(status_code=500, detail="Error sending manual notification")


@api_router.get("/telegram/history")
async def get_notification_history():
    """Get notification history"""
    try:
        history = await db.notification_history.find().sort("sent_at", -1).limit(50).to_list(50)
        
        for item in history:
            if "_id" in item:
                item.pop("_id")
                
        return {"history": history}
    except Exception as e:
        logging.error(f"Notification history error: {e}")
        raise HTTPException(status_code=500, detail="Error fetching notification history")


# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "MediPOS RMS Analytics API"}

# Basic Medicine CRUD Endpoints
@api_router.get("/medicines")
async def get_medicines(search: str = ""):
    """Get all medicines with optional search"""
    try:
        if search:
            # Search by name, supplier, or batch number
            query = {
                "$or": [
                    {"name": {"$regex": search, "$options": "i"}},
                    {"supplier": {"$regex": search, "$options": "i"}},
                    {"batch_number": {"$regex": search, "$options": "i"}}
                ]
            }
        else:
            query = {}
            
        medicines = await db.medicines.find(query).to_list(1000)
        
        for medicine in medicines:
            if "_id" in medicine:
                medicine.pop("_id")
                
        return {"medicines": medicines}
    except Exception as e:
        logging.error(f"Error fetching medicines: {e}")
        raise HTTPException(status_code=500, detail="Error fetching medicines")


@api_router.post("/medicines")
async def add_medicine(medicine_data: Medicine):
    """Add a new medicine to inventory"""
    try:
        medicine_dict = medicine_data.dict()
        await db.medicines.insert_one(medicine_dict)
        
        # Check for low stock alert
        await check_and_trigger_low_stock_alert(
            medicine_dict["id"], 
            medicine_dict["stock_quantity"]
        )
        
        return medicine_data
    except Exception as e:
        logging.error(f"Error adding medicine: {e}")
        raise HTTPException(status_code=500, detail="Error adding medicine")


@api_router.put("/medicines/{medicine_id}")
async def update_medicine(medicine_id: str, medicine_data: dict):
    """Update medicine information"""
    try:
        medicine_data["updated_at"] = datetime.utcnow()
        
        result = await db.medicines.update_one(
            {"id": medicine_id},
            {"$set": medicine_data}
        )
        
        if result.modified_count:
            # Check for low stock alert if stock was updated
            if "stock_quantity" in medicine_data:
                await check_and_trigger_low_stock_alert(
                    medicine_id,
                    medicine_data["stock_quantity"]
                )
            
            updated_medicine = await db.medicines.find_one({"id": medicine_id})
            if updated_medicine:
                updated_medicine.pop("_id")
            return updated_medicine
        else:
            raise HTTPException(status_code=404, detail="Medicine not found")
            
    except Exception as e:
        logging.error(f"Error updating medicine: {e}")
        raise HTTPException(status_code=500, detail="Error updating medicine")


@api_router.delete("/medicines/{medicine_id}")
async def delete_medicine(medicine_id: str):
    """Delete a medicine from inventory"""
    try:
        result = await db.medicines.delete_one({"id": medicine_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Medicine not found")
        
        return {"success": True, "message": "Medicine deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting medicine: {e}")
        raise HTTPException(status_code=500, detail="Error deleting medicine")


# Sales endpoints with stock monitoring
@api_router.get("/sales")
async def get_sales():
    """Get all sales"""
    try:
        sales = await db.sales.find().sort("created_at", -1).to_list(1000)
        
        for sale in sales:
            if "_id" in sale:
                sale.pop("_id")
                
        return {"sales": sales}
    except Exception as e:
        logging.error(f"Error fetching sales: {e}")
        raise HTTPException(status_code=500, detail="Error fetching sales")


@api_router.post("/sales")
async def add_sale(sale_data: Sale):
    """Add a new sale (with stock monitoring)"""
    try:
        sale_dict = sale_data.dict()
        await db.sales.insert_one(sale_dict)
        
        # Update stock for each item and trigger alerts if needed
        for item in sale_dict.get("items", []):
            medicine_id = item.get("medicine_id")
            quantity_sold = item.get("quantity", 0)
            
            if medicine_id and quantity_sold > 0:
                # Get current medicine
                medicine = await db.medicines.find_one({"id": medicine_id})
                if medicine:
                    new_stock = medicine.get("stock_quantity", 0) - quantity_sold
                    
                    # Update stock
                    await db.medicines.update_one(
                        {"id": medicine_id},
                        {"$set": {"stock_quantity": max(0, new_stock), "updated_at": datetime.utcnow()}}
                    )
                    
                    # Check for low stock alert
                    await check_and_trigger_low_stock_alert(medicine_id, max(0, new_stock))
        
        return sale_data
    except Exception as e:
        logging.error(f"Error adding sale: {e}")
        raise HTTPException(status_code=500, detail="Error adding sale")


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


# Patient Management API Endpoints

# Helper function to generate patient number
async def generate_patient_number():
    """Generate unique patient number like PAT001"""
    try:
        last_patient = await db.patients.find().sort("created_at", -1).limit(1).to_list(1)
        if last_patient:
            # Extract number from last patient number and increment
            last_number = last_patient[0].get("patient_number", "PAT000")
            number_part = int(last_number.replace("PAT", "")) + 1
        else:
            number_part = 1
        return f"PAT{number_part:03d}"
    except:
        return f"PAT001"

# Default fee settings endpoints
@api_router.get("/patients/fee-settings")
async def get_fee_settings():
    """Get default fee settings"""
    try:
        settings = await db.fee_settings.find_one()
        if settings:
            settings.pop("_id", None)
            return settings
        else:
            # Return default settings
            default_settings = DefaultFeeSettings()
            return default_settings.dict()
    except Exception as e:
        logging.error(f"Error fetching fee settings: {e}")
        raise HTTPException(status_code=500, detail="Error fetching fee settings")

@api_router.put("/patients/fee-settings")
async def update_fee_settings(settings_data: DefaultFeeSettings):
    """Update default fee settings"""
    try:
        existing_settings = await db.fee_settings.find_one()
        
        if existing_settings:
            # Update existing settings
            update_data = settings_data.dict()
            update_data["updated_at"] = datetime.utcnow()
            
            result = await db.fee_settings.update_one(
                {"id": existing_settings["id"]},
                {"$set": update_data}
            )
            
            if result.modified_count:
                updated_settings = await db.fee_settings.find_one({"id": existing_settings["id"]})
                if updated_settings:
                    updated_settings.pop("_id", None)
                    return updated_settings
                else:
                    # Fallback to returning the update data
                    return update_data
            else:
                existing_settings.pop("_id", None)
                return existing_settings
        else:
            # Create new settings
            settings_dict = settings_data.dict()
            await db.fee_settings.insert_one(settings_dict)
            return settings_dict
            
    except Exception as e:
        logging.error(f"Error updating fee settings: {e}")
        raise HTTPException(status_code=500, detail="Error updating fee settings")

# Patient CRUD endpoints
@api_router.get("/patients")
async def get_patients(search: str = ""):
    """Get all patients with optional search"""
    try:
        if search:
            query = {
                "$or": [
                    {"name": {"$regex": search, "$options": "i"}},
                    {"phone": {"$regex": search, "$options": "i"}},
                    {"patient_number": {"$regex": search, "$options": "i"}}
                ]
            }
        else:
            query = {}
            
        patients = await db.patients.find(query).sort("created_at", -1).to_list(1000)
        
        for patient in patients:
            if "_id" in patient:
                patient.pop("_id")
                
        return {"patients": patients}
    except Exception as e:
        logging.error(f"Error fetching patients: {e}")
        raise HTTPException(status_code=500, detail="Error fetching patients")

@api_router.post("/patients")
async def add_patient(patient_data: PatientCreate):
    """Add a new patient"""
    try:
        patient_number = await generate_patient_number()
        
        patient = Patient(
            name=patient_data.name,
            phone=patient_data.phone,
            address=patient_data.address,
            patient_number=patient_number,
            date_of_birth=patient_data.date_of_birth,
            gender=patient_data.gender
        )
        
        patient_dict = patient.dict()
        await db.patients.insert_one(patient_dict)
        
        return patient
    except Exception as e:
        logging.error(f"Error adding patient: {e}")
        raise HTTPException(status_code=500, detail="Error adding patient")

@api_router.get("/patients/{patient_id}")
async def get_patient(patient_id: str):
    """Get a specific patient"""
    try:
        patient = await db.patients.find_one({"id": patient_id})
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        patient.pop("_id", None)
        return patient
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching patient: {e}")
        raise HTTPException(status_code=500, detail="Error fetching patient")

@api_router.put("/patients/{patient_id}")
async def update_patient(patient_id: str, patient_data: PatientUpdate):
    """Update patient information"""
    try:
        update_data = {k: v for k, v in patient_data.dict().items() if v is not None}
        update_data["updated_at"] = datetime.utcnow()
        
        result = await db.patients.update_one(
            {"id": patient_id},
            {"$set": update_data}
        )
        
        if result.modified_count:
            updated_patient = await db.patients.find_one({"id": patient_id})
            if updated_patient:
                updated_patient.pop("_id", None)
            return updated_patient
        else:
            raise HTTPException(status_code=404, detail="Patient not found")
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating patient: {e}")
        raise HTTPException(status_code=500, detail="Error updating patient")

@api_router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str):
    """Delete a patient"""
    try:
        result = await db.patients.delete_one({"id": patient_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        return {"success": True, "message": "Patient deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting patient: {e}")
        raise HTTPException(status_code=500, detail="Error deleting patient")

# Patient visit endpoints
@api_router.get("/patients/visits")
async def get_all_visits(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    date_range: Optional[str] = None
):
    """Get all patient visits with optional date filtering"""
    try:
        query = {}
        
        # Handle date filtering
        if date_range:
            today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            
            if date_range == "today":
                tomorrow = today + timedelta(days=1)
                query["visit_date"] = {"$gte": today, "$lt": tomorrow}
                period_label = "Today"
            elif date_range == "yesterday":
                yesterday = today - timedelta(days=1)
                query["visit_date"] = {"$gte": yesterday, "$lt": today}
                period_label = "Yesterday"
            elif date_range == "this_month":
                start_month = today.replace(day=1)
                # Get first day of next month
                if today.month == 12:
                    end_month = today.replace(year=today.year + 1, month=1, day=1)
                else:
                    end_month = today.replace(month=today.month + 1, day=1)
                query["visit_date"] = {"$gte": start_month, "$lt": end_month}
                period_label = "This Month"
        elif start_date and end_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            query["visit_date"] = {"$gte": start_dt, "$lt": end_dt}
            period_label = f"{start_date} to {end_date}"
        else:
            period_label = "All Time"
            
        visits = await db.patient_visits.find(query).sort("visit_date", -1).to_list(1000)
        
        for visit in visits:
            if "_id" in visit:
                visit.pop("_id")
                
        return {"visits": visits, "period_label": period_label}
    except Exception as e:
        logging.error(f"Error fetching visits: {e}")
        raise HTTPException(status_code=500, detail="Error fetching visits")

@api_router.get("/patients/{patient_id}/visits")
async def get_patient_visits(patient_id: str):
    """Get all visits for a specific patient"""
    try:
        visits = await db.patient_visits.find({"patient_id": patient_id}).sort("visit_date", -1).to_list(1000)
        
        for visit in visits:
            if "_id" in visit:
                visit.pop("_id")
                
        return {"visits": visits}
    except Exception as e:
        logging.error(f"Error fetching patient visits: {e}")
        raise HTTPException(status_code=500, detail="Error fetching patient visits")

@api_router.post("/patients/visits")
async def add_patient_visit(visit_data: PatientVisitCreate):
    """Add a new patient visit"""
    try:
        # Get patient details for the visit
        patient = await db.patients.find_one({"id": visit_data.patient_id})
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        visit = PatientVisit(
            patient_id=visit_data.patient_id,
            patient_name=patient["name"],
            service_type=visit_data.service_type,
            procedure_name=visit_data.procedure_name,
            fee_amount=visit_data.fee_amount,
            total_fee=visit_data.fee_amount,  # For now, total equals fee_amount
            payment_method=visit_data.payment_method,
            notes=visit_data.notes
        )
        
        visit_dict = visit.dict()
        await db.patient_visits.insert_one(visit_dict)
        
        return visit
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error adding patient visit: {e}")
        raise HTTPException(status_code=500, detail="Error adding patient visit")

@api_router.put("/patients/visits/{visit_id}")
async def update_patient_visit(visit_id: str, visit_data: PatientVisitCreate):
    """Update a patient visit"""
    try:
        update_data = {
            "service_type": visit_data.service_type,
            "procedure_name": visit_data.procedure_name,
            "fee_amount": visit_data.fee_amount,
            "total_fee": visit_data.fee_amount,
            "payment_method": visit_data.payment_method,
            "notes": visit_data.notes
        }
        
        result = await db.patient_visits.update_one(
            {"id": visit_id},
            {"$set": update_data}
        )
        
        if result.modified_count:
            updated_visit = await db.patient_visits.find_one({"id": visit_id})
            if updated_visit:
                updated_visit.pop("_id", None)
            return updated_visit
        else:
            raise HTTPException(status_code=404, detail="Visit not found")
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating visit: {e}")
        raise HTTPException(status_code=500, detail="Error updating visit")

@api_router.delete("/patients/visits/{visit_id}")
async def delete_patient_visit(visit_id: str):
    """Delete a patient visit"""
    try:
        result = await db.patient_visits.delete_one({"id": visit_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Visit not found")
        
        return {"success": True, "message": "Visit deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting visit: {e}")
        raise HTTPException(status_code=500, detail="Error deleting visit")

# Patient analytics endpoint
@api_router.post("/patients/analytics")
async def get_patient_analytics(analytics_request: PatientAnalyticsRequest):
    """Get patient analytics with date filtering"""
    try:
        query = {}
        period_label = "All Time"
        
        # Handle date filtering
        if analytics_request.date_range:
            today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            
            if analytics_request.date_range == "today":
                tomorrow = today + timedelta(days=1)
                query["visit_date"] = {"$gte": today, "$lt": tomorrow}
                period_label = "Today"
            elif analytics_request.date_range == "yesterday":
                yesterday = today - timedelta(days=1)
                query["visit_date"] = {"$gte": yesterday, "$lt": today}
                period_label = "Yesterday"
            elif analytics_request.date_range == "this_month":
                start_month = today.replace(day=1)
                if today.month == 12:
                    end_month = today.replace(year=today.year + 1, month=1, day=1)
                else:
                    end_month = today.replace(month=today.month + 1, day=1)
                query["visit_date"] = {"$gte": start_month, "$lt": end_month}
                period_label = "This Month"
        elif analytics_request.start_date and analytics_request.end_date:
            start_dt = datetime.strptime(analytics_request.start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(analytics_request.end_date, "%Y-%m-%d") + timedelta(days=1)
            query["visit_date"] = {"$gte": start_dt, "$lt": end_dt}
            period_label = f"{analytics_request.start_date} to {analytics_request.end_date}"
        
        # Get visits based on query
        visits = await db.patient_visits.find(query).to_list(10000)
        
        # Calculate analytics
        total_visits = len(visits)
        total_revenue = sum(visit.get("total_fee", 0) for visit in visits)
        
        consultations = [v for v in visits if v.get("service_type") == "consultation"]
        procedures = [v for v in visits if v.get("service_type") == "procedure"]
        
        consultations_count = len(consultations)
        procedures_count = len(procedures)
        consultation_revenue = sum(v.get("total_fee", 0) for v in consultations)
        procedure_revenue = sum(v.get("total_fee", 0) for v in procedures)
        
        # Get total unique patients
        total_patients = await db.patients.count_documents({})
        
        # Daily visits for charts
        daily_visits = {}
        for visit in visits:
            visit_date = visit.get("visit_date")
            if visit_date:
                date_key = visit_date.strftime("%Y-%m-%d")
                if date_key not in daily_visits:
                    daily_visits[date_key] = {"date": date_key, "visits": 0, "revenue": 0}
                daily_visits[date_key]["visits"] += 1
                daily_visits[date_key]["revenue"] += visit.get("total_fee", 0)
        
        daily_visits_list = sorted(daily_visits.values(), key=lambda x: x["date"])
        
        # Popular procedures
        procedure_stats = defaultdict(lambda: {"count": 0, "revenue": 0})
        for visit in procedures:
            proc_name = visit.get("procedure_name", "Unknown Procedure")
            procedure_stats[proc_name]["count"] += 1
            procedure_stats[proc_name]["revenue"] += visit.get("total_fee", 0)
        
        popular_procedures = [
            {"name": name, "count": stats["count"], "revenue": stats["revenue"]}
            for name, stats in procedure_stats.items()
        ]
        popular_procedures = sorted(popular_procedures, key=lambda x: x["count"], reverse=True)[:10]
        
        return PatientAnalyticsResponse(
            total_patients=total_patients,
            total_visits=total_visits,
            total_revenue=total_revenue,
            consultations_count=consultations_count,
            procedures_count=procedures_count,
            consultation_revenue=consultation_revenue,
            procedure_revenue=procedure_revenue,
            daily_visits=daily_visits_list,
            popular_procedures=popular_procedures,
            date_range=analytics_request.date_range or "custom",
            period_label=period_label
        )
        
    except Exception as e:
        logging.error(f"Error getting patient analytics: {e}")
        raise HTTPException(status_code=500, detail="Error getting patient analytics")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    """Initialize scheduler and setup jobs"""
    setup_scheduler()
    
    # Load existing settings and update scheduler
    settings = await get_telegram_settings()
    if settings:
        await update_scheduler_jobs(settings)

@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown scheduler and database connection"""
    scheduler.shutdown()
    client.close()
