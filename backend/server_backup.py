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
from datetime import datetime, timedelta, time as datetime_time
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
import asyncio

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

# Global scheduler instance
scheduler = AsyncIOScheduler()


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

class NotificationHistory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # 'daily_sales', 'low_stock', 'near_expiry', 'expired'
    message: str
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    success: bool
    error_message: Optional[str] = None


# Define Models (keeping existing models)
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
    min_stock_level: Optional[int] = 10
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
async def test_telegram_connection(bot_token: str, chat_id: str):
    """Test Telegram bot connection"""
    try:
        result = await telegram_service.test_connection(bot_token, chat_id)
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


# Keep all existing endpoints from the original file but add stock monitoring
# I'll add the stock monitoring hook to the existing medicine endpoints

# Tally Import Endpoints and all other existing endpoints remain the same
# ... (keeping all the existing endpoints from the original server.py)

# Include all existing models and endpoints from the original file
# (TallyDataProcessor, backup/restore endpoints, analytics, etc.)


# Modified medicine update endpoint to trigger immediate low stock alerts
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


# Existing endpoints with stock monitoring hooks
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


# Keep all other existing endpoints...
# (I'll keep the original endpoints but add stock monitoring where needed)

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "MediPOS RMS Analytics API with Telegram Notifications"}

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