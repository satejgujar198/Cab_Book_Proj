from sqlalchemy import Column, Integer, String, Float, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
import enum
from .database import Base

class RoleEnum(str, enum.Enum):
    customer = "customer"
    driver = "driver"
    admin = "admin"

class BookingStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    hashed_password = Column(String)
    role = Column(Enum(RoleEnum), default=RoleEnum.customer)
    rating = Column(Float, default=4.5)
    is_active = Column(Boolean, default=True)

    vehicles = relationship("Vehicle", back_populates="driver")
    bookings_as_customer = relationship("Booking", foreign_keys="[Booking.customer_id]", back_populates="customer")
    bookings_as_driver = relationship("Booking", foreign_keys="[Booking.driver_id]", back_populates="driver_user")

class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String, default="Toyota Camry")
    plate_number = Column(String, unique=True, nullable=True)
    type = Column(String, index=True) # Economy, Business, XL
    capacity = Column(Integer)
    price_per_km = Column(Float)
    driver_id = Column(Integer, ForeignKey("users.id"))

    driver = relationship("User", back_populates="vehicles")

class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"))
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(Enum(BookingStatus), default=BookingStatus.PENDING)
    pickup_lat = Column(Float)
    pickup_lng = Column(Float)
    dropoff_lat = Column(Float)
    dropoff_lng = Column(Float)
    fare = Column(Float, nullable=True)
    promo_code = Column(String, nullable=True)
    discount_applied = Column(Float, default=0.0)
    final_fare = Column(Float, nullable=True)
    scheduled_time = Column(String, nullable=True)

    customer = relationship("User", foreign_keys=[customer_id], back_populates="bookings_as_customer")
    driver_user = relationship("User", foreign_keys=[driver_id], back_populates="bookings_as_driver")
