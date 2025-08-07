from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, date
from enum import Enum


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="Medicine Sales & Stock Management API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    UPI = "upi"

class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager" 
    CASHIER = "cashier"

# Models
class Medicine(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    price: float
    stock_quantity: int
    expiry_date: date
    batch_number: str
    supplier: str
    barcode: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class MedicineCreate(BaseModel):
    name: str
    price: float
    stock_quantity: int
    expiry_date: date
    batch_number: str
    supplier: str
    barcode: Optional[str] = None

class SaleItem(BaseModel):
    medicine_id: str
    medicine_name: str
    quantity: int
    price: float
    total: float

class Sale(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    items: List[SaleItem]
    total_amount: float
    payment_method: PaymentMethod
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    cashier_id: str
    sale_date: datetime = Field(default_factory=datetime.utcnow)
    receipt_number: str

class SaleCreate(BaseModel):
    items: List[SaleItem]
    total_amount: float
    payment_method: PaymentMethod
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    cashier_id: str

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password_hash: str
    role: UserRole
    permissions: dict = Field(default_factory=dict)
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    username: str
    password: str
    role: UserRole
    permissions: dict = Field(default_factory=dict)

class ShopDetails(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    phone: str
    email: Optional[str] = None
    license_number: str
    gst_number: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Basic API endpoints
@api_router.get("/")
async def root():
    return {"message": "Medicine Sales & Stock Management API"}

# Medicine endpoints
@api_router.post("/medicines", response_model=Medicine)
async def create_medicine(medicine: MedicineCreate):
    medicine_dict = medicine.dict()
    medicine_obj = Medicine(**medicine_dict)
    
    # Convert date objects to strings for MongoDB
    medicine_data = medicine_obj.dict()
    if isinstance(medicine_data.get('expiry_date'), date):
        medicine_data['expiry_date'] = medicine_data['expiry_date'].isoformat()
    
    await db.medicines.insert_one(medicine_data)
    return medicine_obj

@api_router.get("/medicines", response_model=List[Medicine])
async def get_medicines(search: Optional[str] = Query(None)):
    query = {}
    if search:
        query = {
            "$or": [
                {"name": {"$regex": search, "$options": "i"}},
                {"barcode": {"$regex": search, "$options": "i"}}
            ]
        }
    
    medicines = await db.medicines.find(query).to_list(1000)
    # Convert expiry_date string back to date object for response
    for medicine in medicines:
        if isinstance(medicine.get('expiry_date'), str):
            try:
                medicine['expiry_date'] = datetime.fromisoformat(medicine['expiry_date']).date()
            except (ValueError, AttributeError):
                pass
    return [Medicine(**medicine) for medicine in medicines]

@api_router.get("/medicines/{medicine_id}", response_model=Medicine)
async def get_medicine(medicine_id: str):
    medicine = await db.medicines.find_one({"id": medicine_id})
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")
    
    # Convert expiry_date string back to date object for response
    if isinstance(medicine.get('expiry_date'), str):
        try:
            medicine['expiry_date'] = datetime.fromisoformat(medicine['expiry_date']).date()
        except (ValueError, AttributeError):
            pass
    return Medicine(**medicine)

@api_router.put("/medicines/{medicine_id}", response_model=Medicine)
async def update_medicine(medicine_id: str, medicine_update: MedicineCreate):
    medicine = await db.medicines.find_one({"id": medicine_id})
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")
    
    update_dict = medicine_update.dict()
    update_dict["updated_at"] = datetime.utcnow()
    
    await db.medicines.update_one(
        {"id": medicine_id},
        {"$set": update_dict}
    )
    
    updated_medicine = await db.medicines.find_one({"id": medicine_id})
    return Medicine(**updated_medicine)

@api_router.delete("/medicines/{medicine_id}")
async def delete_medicine(medicine_id: str):
    result = await db.medicines.delete_one({"id": medicine_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return {"message": "Medicine deleted successfully"}

# Sales endpoints
@api_router.post("/sales", response_model=Sale)
async def create_sale(sale: SaleCreate):
    # Generate receipt number
    receipt_number = f"RCP{int(datetime.utcnow().timestamp())}"
    
    # Check stock availability and update inventory
    for item in sale.items:
        medicine = await db.medicines.find_one({"id": item.medicine_id})
        if not medicine:
            raise HTTPException(status_code=404, detail=f"Medicine {item.medicine_name} not found")
        
        if medicine["stock_quantity"] < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {item.medicine_name}")
        
        # Update stock
        new_stock = medicine["stock_quantity"] - item.quantity
        await db.medicines.update_one(
            {"id": item.medicine_id},
            {"$set": {"stock_quantity": new_stock, "updated_at": datetime.utcnow()}}
        )
    
    # Create sale record
    sale_dict = sale.dict()
    sale_obj = Sale(**sale_dict, receipt_number=receipt_number)
    await db.sales.insert_one(sale_obj.dict())
    
    return sale_obj

@api_router.get("/sales", response_model=List[Sale])
async def get_sales(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    medicine_name: Optional[str] = Query(None),
    limit: int = Query(100)
):
    query = {}
    
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = datetime.combine(start_date, datetime.min.time())
        if end_date:
            date_query["$lte"] = datetime.combine(end_date, datetime.max.time())
        query["sale_date"] = date_query
    
    if medicine_name:
        query["items.medicine_name"] = {"$regex": medicine_name, "$options": "i"}
    
    sales = await db.sales.find(query).sort("sale_date", -1).limit(limit).to_list(limit)
    return [Sale(**sale) for sale in sales]

@api_router.get("/sales/analytics")
async def get_sales_analytics(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None)
):
    match_stage = {}
    
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = datetime.combine(start_date, datetime.min.time())
        if end_date:
            date_query["$lte"] = datetime.combine(end_date, datetime.max.time())
        match_stage["sale_date"] = date_query
    
    pipeline = [
        {"$match": match_stage} if match_stage else {"$match": {}},
        {"$group": {
            "_id": None,
            "total_sales": {"$sum": "$total_amount"},
            "total_transactions": {"$sum": 1},
            "avg_transaction": {"$avg": "$total_amount"}
        }}
    ]
    
    result = await db.sales.aggregate(pipeline).to_list(1)
    
    if result:
        return {
            "total_sales": round(result[0]["total_sales"], 2),
            "total_transactions": result[0]["total_transactions"],
            "avg_transaction": round(result[0]["avg_transaction"], 2)
        }
    else:
        return {
            "total_sales": 0,
            "total_transactions": 0,
            "avg_transaction": 0
        }

# User endpoints
@api_router.post("/users", response_model=User)
async def create_user(user: UserCreate):
    # Simple password hashing (in production, use proper hashing)
    import hashlib
    password_hash = hashlib.sha256(user.password.encode()).hexdigest()
    
    user_dict = user.dict()
    user_dict.pop("password")
    user_dict["password_hash"] = password_hash
    
    user_obj = User(**user_dict)
    await db.users.insert_one(user_obj.dict())
    return user_obj

@api_router.get("/users", response_model=List[User])
async def get_users():
    users = await db.users.find().to_list(1000)
    return [User(**user) for user in users]

# Shop details endpoints
@api_router.post("/shop", response_model=ShopDetails)
async def create_or_update_shop(shop: ShopDetails):
    # Check if shop details already exist
    existing_shop = await db.shop_details.find_one({})
    
    if existing_shop:
        # Update existing shop details
        shop.id = existing_shop["id"]
        await db.shop_details.update_one(
            {"id": existing_shop["id"]},
            {"$set": shop.dict()}
        )
    else:
        # Create new shop details
        await db.shop_details.insert_one(shop.dict())
    
    return shop

@api_router.get("/shop", response_model=Optional[ShopDetails])
async def get_shop():
    shop = await db.shop_details.find_one({})
    if shop:
        return ShopDetails(**shop)
    return None

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