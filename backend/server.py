from fastapi import FastAPI, APIRouter, HTTPException, Query, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, date, timedelta
from enum import Enum
import jwt
from passlib.context import CryptContext
import secrets

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('SECRET_KEY', secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 30

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()

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
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    password_hash: str
    role: UserRole
    permissions: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True
    last_login: Optional[datetime] = None
    password_reset_token: Optional[str] = None
    password_reset_expires: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    password: str
    role: UserRole
    permissions: Dict[str, Any] = Field(default_factory=dict)

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[UserRole] = None
    permissions: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class UserLogin(BaseModel):
    username: str
    password: str
    remember_me: bool = False

class ChangePassword(BaseModel):
    current_password: str
    new_password: str

class PasswordReset(BaseModel):
    username_or_email: str

class PasswordResetConfirm(BaseModel):
    reset_token: str
    new_password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: Dict[str, Any]

class UserResponse(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: UserRole
    permissions: Dict[str, Any]
    is_active: bool
    last_login: Optional[datetime] = None
    created_at: datetime

class ShopDetails(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    phone: str
    email: Optional[str] = None
    license_number: str
    gst_number: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Authentication functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=30)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_type = payload.get("type")
        if token_type == "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Cannot use refresh token for authentication"
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"username": username})
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_active", True):
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def require_role(allowed_roles: List[UserRole]):
    def role_checker(current_user: dict = Depends(get_current_active_user)):
        user_role = current_user.get("role")
        if user_role not in [role.value for role in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return role_checker

# Authentication endpoints
@api_router.post("/auth/login", response_model=Token)
async def login(user_login: UserLogin):
    user = await db.users.find_one({"username": user_login.username})
    if not user or not verify_password(user_login.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated"
        )
    
    # Update last login
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.utcnow()}}
    )
    
    # Create tokens
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS if user_login.remember_me else 1)
    
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(
        data={"sub": user["username"]}, expires_delta=refresh_token_expires
    )
    
    # Prepare user data for response
    user_data = {
        "id": user["id"],
        "username": user["username"],
        "email": user.get("email"),
        "full_name": user.get("full_name"),
        "role": user["role"],
        "permissions": user.get("permissions", {}),
        "is_active": user.get("is_active", True)
    }
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user_data
    }

@api_router.post("/auth/refresh", response_model=Token)
async def refresh_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        token_type = payload.get("type")
        if token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired"
        )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
    
    user = await db.users.find_one({"username": username})
    if not user or not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Create new access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    
    user_data = {
        "id": user["id"],
        "username": user["username"],
        "email": user.get("email"),
        "full_name": user.get("full_name"),
        "role": user["role"],
        "permissions": user.get("permissions", {}),
        "is_active": user.get("is_active", True)
    }
    
    return {
        "access_token": access_token,
        "refresh_token": credentials.credentials,  # Return same refresh token
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user_data
    }

@api_router.post("/auth/logout")
async def logout(current_user: dict = Depends(get_current_active_user)):
    return {"message": "Successfully logged out"}

@api_router.post("/auth/password-reset", response_model=dict)
async def request_password_reset(password_reset: PasswordReset):
    user = await db.users.find_one({
        "$or": [
            {"username": password_reset.username_or_email},
            {"email": password_reset.username_or_email}
        ]
    })
    
    if user:
        # Generate reset token
        reset_token = secrets.token_urlsafe(32)
        expires = datetime.utcnow() + timedelta(hours=1)
        
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "password_reset_token": reset_token,
                "password_reset_expires": expires
            }}
        )
        
        # In a real app, you would send an email here
        # For now, we'll return the token (remove this in production)
        return {
            "message": "Password reset token generated",
            "reset_token": reset_token  # Remove this in production
        }
    
    # Always return success to prevent username enumeration
    return {"message": "If account exists, password reset instructions have been sent"}

@api_router.post("/auth/password-reset/confirm", response_model=dict)
async def confirm_password_reset(reset_data: PasswordResetConfirm):
    user = await db.users.find_one({
        "password_reset_token": reset_data.reset_token,
        "password_reset_expires": {"$gt": datetime.utcnow()}
    })
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Update password and clear reset token
    password_hash = get_password_hash(reset_data.new_password)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password_hash": password_hash,
            "updated_at": datetime.utcnow()
        },
        "$unset": {
            "password_reset_token": "",
            "password_reset_expires": ""
        }}
    )
    
    return {"message": "Password has been reset successfully"}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_current_user_profile(current_user: dict = Depends(get_current_active_user)):
    # Convert datetime strings back to datetime objects if needed
    if isinstance(current_user.get('created_at'), str):
        try:
            current_user['created_at'] = datetime.fromisoformat(current_user['created_at'])
        except (ValueError, AttributeError):
            current_user['created_at'] = datetime.utcnow()
    
    if isinstance(current_user.get('last_login'), str):
        try:
            current_user['last_login'] = datetime.fromisoformat(current_user['last_login'])
        except (ValueError, AttributeError):
            pass
    
    return UserResponse(**current_user)

@api_router.put("/auth/change-password", response_model=dict)
async def change_password(
    password_data: ChangePassword,
    current_user: dict = Depends(get_current_active_user)
):
    if not verify_password(password_data.current_password, current_user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    new_password_hash = get_password_hash(password_data.new_password)
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "password_hash": new_password_hash,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"message": "Password changed successfully"}

# Basic API endpoints
@api_router.get("/")
async def root():
    return {"message": "Medicine Sales & Stock Management API"}

# Medicine endpoints (require authentication)
@api_router.post("/medicines", response_model=Medicine)
async def create_medicine(
    medicine: MedicineCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.MANAGER]))
):
    medicine_dict = medicine.dict()
    medicine_obj = Medicine(**medicine_dict)
    
    # Convert date objects to strings for MongoDB
    medicine_data = medicine_obj.dict()
    if isinstance(medicine_data.get('expiry_date'), date):
        medicine_data['expiry_date'] = medicine_data['expiry_date'].isoformat()
    
    await db.medicines.insert_one(medicine_data)
    return medicine_obj

@api_router.get("/medicines", response_model=List[Medicine])
async def get_medicines(
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_active_user)
):
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
async def get_medicine(
    medicine_id: str,
    current_user: dict = Depends(get_current_active_user)
):
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
async def update_medicine(
    medicine_id: str,
    medicine_update: MedicineCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.MANAGER]))
):
    medicine = await db.medicines.find_one({"id": medicine_id})
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")
    
    update_dict = medicine_update.dict()
    update_dict["updated_at"] = datetime.utcnow()
    
    # Convert date objects to strings for MongoDB
    if isinstance(update_dict.get('expiry_date'), date):
        update_dict['expiry_date'] = update_dict['expiry_date'].isoformat()
    
    await db.medicines.update_one(
        {"id": medicine_id},
        {"$set": update_dict}
    )
    
    updated_medicine = await db.medicines.find_one({"id": medicine_id})
    # Convert expiry_date string back to date object for response
    if isinstance(updated_medicine.get('expiry_date'), str):
        try:
            updated_medicine['expiry_date'] = datetime.fromisoformat(updated_medicine['expiry_date']).date()
        except (ValueError, AttributeError):
            pass
    return Medicine(**updated_medicine)

@api_router.delete("/medicines/{medicine_id}")
async def delete_medicine(
    medicine_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.MANAGER]))
):
    result = await db.medicines.delete_one({"id": medicine_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return {"message": "Medicine deleted successfully"}

# Sales endpoints (require authentication)
@api_router.post("/sales", response_model=Sale)
async def create_sale(
    sale: SaleCreate,
    current_user: dict = Depends(get_current_active_user)
):
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
    
    # Create sale record with current user as cashier
    sale_dict = sale.dict()
    sale_dict["cashier_id"] = current_user["id"]
    sale_obj = Sale(**sale_dict, receipt_number=receipt_number)
    
    # Convert datetime objects to serializable format for MongoDB
    sale_data = sale_obj.dict()
    if isinstance(sale_data.get('sale_date'), datetime):
        sale_data['sale_date'] = sale_data['sale_date'].isoformat()
    
    await db.sales.insert_one(sale_data)
    
    return sale_obj

@api_router.get("/sales", response_model=List[Sale])
async def get_sales(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    medicine_name: Optional[str] = Query(None),
    limit: int = Query(100),
    current_user: dict = Depends(get_current_active_user)
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
    
    # Convert datetime strings back to datetime objects for response
    for sale in sales:
        if isinstance(sale.get('sale_date'), str):
            try:
                sale['sale_date'] = datetime.fromisoformat(sale['sale_date'])
            except (ValueError, AttributeError):
                pass
    
    return [Sale(**sale) for sale in sales]

@api_router.get("/sales/analytics")
async def get_sales_analytics(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: dict = Depends(get_current_active_user)
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

# User management endpoints (admin only)
@api_router.post("/users", response_model=UserResponse)
async def create_user(
    user: UserCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    # Check if username already exists
    existing_user = await db.users.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Check if email already exists
    if user.email:
        existing_email = await db.users.find_one({"email": user.email})
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )
    
    # Hash password
    password_hash = get_password_hash(user.password)
    
    user_dict = user.dict()
    user_dict.pop("password")
    user_dict["password_hash"] = password_hash
    
    user_obj = User(**user_dict)
    
    # Convert datetime objects to serializable format for MongoDB
    user_data = user_obj.dict()
    if isinstance(user_data.get('created_at'), datetime):
        user_data['created_at'] = user_data['created_at'].isoformat()
    if isinstance(user_data.get('updated_at'), datetime):
        user_data['updated_at'] = user_data['updated_at'].isoformat()
    
    await db.users.insert_one(user_data)
    
    # Return user without password hash
    user_response_data = {k: v for k, v in user_obj.dict().items() if k != 'password_hash'}
    return UserResponse(**user_response_data)

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    users = await db.users.find().to_list(1000)
    
    # Convert datetime strings back to datetime objects for response
    for user in users:
        if isinstance(user.get('created_at'), str):
            try:
                user['created_at'] = datetime.fromisoformat(user['created_at'])
            except (ValueError, AttributeError):
                user['created_at'] = datetime.utcnow()
        
        if isinstance(user.get('last_login'), str):
            try:
                user['last_login'] = datetime.fromisoformat(user['last_login'])
            except (ValueError, AttributeError):
                pass
    
    # Remove password_hash from response
    user_responses = []
    for user in users:
        user_data = {k: v for k, v in user.items() if k != 'password_hash'}
        user_responses.append(UserResponse(**user_data))
    
    return user_responses

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Convert datetime strings back to datetime objects for response
    if isinstance(user.get('created_at'), str):
        try:
            user['created_at'] = datetime.fromisoformat(user['created_at'])
        except (ValueError, AttributeError):
            user['created_at'] = datetime.utcnow()
    
    if isinstance(user.get('last_login'), str):
        try:
            user['last_login'] = datetime.fromisoformat(user['last_login'])
        except (ValueError, AttributeError):
            pass
    
    # Remove password_hash from response
    user_data = {k: v for k, v in user.items() if k != 'password_hash'}
    return UserResponse(**user_data)

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if username already exists (if being updated)
    if user_update.username and user_update.username != user["username"]:
        existing_user = await db.users.find_one({"username": user_update.username})
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )
    
    # Check if email already exists (if being updated)
    if user_update.email and user_update.email != user.get("email"):
        existing_email = await db.users.find_one({"email": user_update.email})
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )
    
    update_dict = {k: v for k, v in user_update.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.utcnow()
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": update_dict}
    )
    
    updated_user = await db.users.find_one({"id": user_id})
    
    # Convert datetime strings back to datetime objects for response
    if isinstance(updated_user.get('created_at'), str):
        try:
            updated_user['created_at'] = datetime.fromisoformat(updated_user['created_at'])
        except (ValueError, AttributeError):
            updated_user['created_at'] = datetime.utcnow()
    
    if isinstance(updated_user.get('last_login'), str):
        try:
            updated_user['last_login'] = datetime.fromisoformat(updated_user['last_login'])
        except (ValueError, AttributeError):
            pass
    
    # Remove password_hash from response
    user_data = {k: v for k, v in updated_user.items() if k != 'password_hash'}
    return UserResponse(**user_data)

@api_router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    # Prevent deleting self
    if user_id == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

# Shop details endpoints
@api_router.post("/shop", response_model=ShopDetails)
async def create_or_update_shop(
    shop: ShopDetails,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    # Check if shop details already exist
    existing_shop = await db.shop_details.find_one({})
    
    # Convert datetime objects to serializable format for MongoDB
    shop_data = shop.dict()
    if isinstance(shop_data.get('updated_at'), datetime):
        shop_data['updated_at'] = shop_data['updated_at'].isoformat()
    
    if existing_shop:
        # Update existing shop details
        shop.id = existing_shop["id"]
        shop_data["id"] = existing_shop["id"]
        await db.shop_details.update_one(
            {"id": existing_shop["id"]},
            {"$set": shop_data}
        )
    else:
        # Create new shop details
        await db.shop_details.insert_one(shop_data)
    
    return shop

@api_router.get("/shop", response_model=Optional[ShopDetails])
async def get_shop(current_user: dict = Depends(get_current_active_user)):
    shop = await db.shop_details.find_one({})
    if shop:
        # Convert datetime strings back to datetime objects for response
        if isinstance(shop.get('updated_at'), str):
            try:
                shop['updated_at'] = datetime.fromisoformat(shop['updated_at'])
            except (ValueError, AttributeError):
                pass
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

# Create default admin user on startup
@app.on_event("startup")
async def create_default_admin():
    admin_exists = await db.users.find_one({"role": "admin"})
    if not admin_exists:
        default_admin = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "email": "admin@pharmacy.com",
            "full_name": "System Administrator",
            "password_hash": get_password_hash("admin123"),
            "role": "admin",
            "permissions": {
                "can_manage_users": True,
                "can_modify_stock": True,
                "can_view_reports": True,
                "can_manage_system": True
            },
            "is_active": True,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        await db.users.insert_one(default_admin)
        logger.info("Default admin user created - username: admin, password: admin123")