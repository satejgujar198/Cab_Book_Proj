from backend.database import SessionLocal
from backend import models

db = SessionLocal()
users = db.query(models.User).all()
vehicles = db.query(models.Vehicle).all()

print(f"Users: {len(users)}")
for u in users:
    print(f" - {u.username} ({u.role})")

print(f"Vehicles: {len(vehicles)}")
for v in vehicles:
    print(f" - {v.type} (ID: {v.id}, Driver: {v.driver_id})")

db.close()
