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

# Global processor instance
tally_processor = TallyDataProcessor()

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
