from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from typing import List
from datetime import timedelta
import json
import random

from . import models, schemas, auth
from .database import engine, get_db, Base

import os

import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize database
try:
    Base.metadata.create_all(bind=engine)
    logger.info("Database initialized successfully")
except Exception as e:
    logger.error(f"Database initialization failed: {e}")

app = FastAPI(title="SwiftRide Premium API")

@app.on_event("startup")
async def startup_event():
    logger.info("Server is starting up...")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os

# Get the directory of the current file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

# Serve Frontend
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

@app.get("/")
async def serve_frontend():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

@app.post("/register", response_model=schemas.UserOut)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(
        username=user.username, 
        full_name=user.full_name or user.username.capitalize(),
        hashed_password=hashed_password, 
        role=user.role,
        avatar_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={user.username}"
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not db_user or not auth.verify_password(form_data.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": db_user.username, "role": db_user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/cabs", response_model=List[schemas.VehicleOut])
def get_cabs(type: str = None, capacity: int = None, db: Session = Depends(get_db)):
    query = db.query(models.Vehicle)
    if type:
        query = query.filter(models.Vehicle.type == type)
    if capacity:
        query = query.filter(models.Vehicle.capacity >= capacity)
    return query.all()

@app.post("/book", response_model=schemas.BookingOut)
def book_cab(booking: schemas.BookingCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if current_user.role != models.RoleEnum.customer:
        raise HTTPException(status_code=403, detail="Only customers can book cabs")
    
    # Check if first ride or if promo code is used
    previous_bookings = db.query(models.Booking).filter(models.Booking.customer_id == current_user.id).count()
    
    base_fare = 150.0 # Base fare in INR
    discount = 0.0
    
    # If promo code is provided
    if booking.promo_code:
        if booking.promo_code.upper() == "FIRST50":
            # Flat 50 INR discount
            if previous_bookings == 0:
                discount = 50.0
            else:
                raise HTTPException(status_code=400, detail="Promo code only valid for first-time riders")
        else:
            raise HTTPException(status_code=400, detail="Invalid promo code")
    # Auto-apply fallback
    elif previous_bookings == 0:
        discount = 50.0
        
    final_fare = max(0, base_fare - discount)
    
    db_booking = models.Booking(
        customer_id=current_user.id,
        pickup_lat=booking.pickup_lat,
        pickup_lng=booking.pickup_lng,
        dropoff_lat=booking.dropoff_lat,
        dropoff_lng=booking.dropoff_lng,
        fare=base_fare,
        promo_code=booking.promo_code,
        discount_applied=discount,
        final_fare=final_fare,
        scheduled_time=booking.scheduled_time,
        status=models.BookingStatus.PENDING
    )
    db.add(db_booking)
    db.commit()
    db.refresh(db_booking)
    return db_booking

@app.get("/stats", response_model=schemas.SystemStats)
def get_stats(db: Session = Depends(get_db)):
    total_users = db.query(models.User).filter(models.User.role == models.RoleEnum.customer).count()
    total_drivers = db.query(models.User).filter(models.User.role == models.RoleEnum.driver).count()
    total_bookings = db.query(models.Booking).count()
    
    active_drivers = db.query(models.User).filter(models.User.role == models.RoleEnum.driver).limit(5).all()
    recent_users = db.query(models.User).filter(models.User.role == models.RoleEnum.customer).order_by(models.User.id.desc()).limit(5).all()
    
    return {
        "total_users": total_users,
        "total_drivers": total_drivers,
        "total_bookings": total_bookings,
        "active_drivers": active_drivers,
        "recent_users": recent_users
    }

@app.websocket("/ws/driver-location")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.post("/seed")
def seed_data(db: Session = Depends(get_db)):
    # Create some drivers
    driver_data = [
        {"name": "Rahul Sharma", "user": "driver_rahul", "car": "Maruti Suzuki Dzire", "plate": "DL 1C A 1234", "type": "Economy", "price": 12.0},
        {"name": "Amit Patel", "user": "driver_amit", "car": "Toyota Innova Crysta", "plate": "MH 01 AB 5678", "type": "XL", "price": 25.0},
        {"name": "Suresh Raina", "user": "driver_suresh", "car": "Honda City", "plate": "KA 05 MN 9012", "type": "Business", "price": 35.0},
        {"name": "Priya Singh", "user": "driver_priya", "car": "Hyundai Aura", "plate": "HR 26 BD 3456", "type": "Economy", "price": 11.5},
        {"name": "Vikram Singh", "user": "driver_vikram", "car": "Mercedes-Benz E-Class", "plate": "DL 2C S 0007", "type": "Business", "price": 85.0},
    ]

    for d in driver_data:
        if not db.query(models.User).filter(models.User.username == d["user"]).first():
            hashed_password = auth.get_password_hash("password")
            driver = models.User(
                username=d["user"], 
                full_name=d["name"], 
                hashed_password=hashed_password, 
                role=models.RoleEnum.driver,
                avatar_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={d['user']}",
                rating=round(random.uniform(4.7, 5.0), 1)
            )
            db.add(driver)
            db.commit()
            db.refresh(driver)
            
            vehicle = models.Vehicle(
                type=d["type"], 
                capacity=4 if d["type"] != "XL" else 6, 
                price_per_km=d["price"], 
                driver_id=driver.id,
                model_name=d["car"],
                plate_number=d["plate"]
            )
            db.add(vehicle)
            db.commit()

    # Create a test customer if not exists
    if not db.query(models.User).filter(models.User.username == "customer1").first():
        hashed_password = auth.get_password_hash("password")
        customer = models.User(
            username="customer1", 
            full_name="Jane Doe", 
            hashed_password=hashed_password, 
            role=models.RoleEnum.customer,
            avatar_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed=customer1"
        )
        db.add(customer)
        db.commit()

    return {"message": "Data seeded successfully with premium profiles"}
