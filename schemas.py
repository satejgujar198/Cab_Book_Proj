from pydantic import BaseModel
from typing import Optional, List
from .models import RoleEnum, BookingStatus

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    role: Optional[RoleEnum] = RoleEnum.customer

class UserOut(BaseModel):
    id: int
    username: str
    full_name: Optional[str]
    avatar_url: Optional[str]
    role: RoleEnum
    rating: float
    is_active: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class VehicleCreate(BaseModel):
    type: str
    capacity: int
    price_per_km: float
    model_name: Optional[str] = "Toyota Camry"
    plate_number: Optional[str] = None

class VehicleOut(BaseModel):
    id: int
    type: str
    capacity: int
    price_per_km: float
    driver_id: int
    model_name: str
    plate_number: Optional[str]

    class Config:
        from_attributes = True

class BookingCreate(BaseModel):
    pickup_lat: float
    pickup_lng: float
    dropoff_lat: float
    dropoff_lng: float
    promo_code: Optional[str] = None
    scheduled_time: Optional[str] = None

class BookingOut(BaseModel):
    id: int
    customer_id: int
    driver_id: Optional[int]
    status: BookingStatus
    pickup_lat: float
    pickup_lng: float
    dropoff_lat: float
    dropoff_lng: float
    fare: Optional[float]
    promo_code: Optional[str]
    discount_applied: float
    final_fare: Optional[float]
    scheduled_time: Optional[str]

    class Config:
        from_attributes = True

class SystemStats(BaseModel):
    total_users: int
    total_drivers: int
    total_bookings: int
    active_drivers: List[UserOut]
    recent_users: List[UserOut]
