import pymongo
import os
from datetime import datetime, timedelta
from bson.objectid import ObjectId
import random

MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/')
client = pymongo.MongoClient(MONGO_URI)
db = client['jivahar']

donor_id = ObjectId("66ed84cd3dc3a0ec277f0a92")

# Ensure default admin account exists
from werkzeug.security import generate_password_hash
if not db.users.find_one({"email": "admin@jivahar.com"}):
    db.users.insert_one({
        "name": "Platform Administrator",
        "email": "admin@jivahar.com",
        "password": generate_password_hash("admin123"),
        "role": "admin",
        "approved": True,
        "phone": "9876543210"
    })
    print("Admin user (admin@jivahar.com) created successfully!")
else:
    print("Admin user already exists.")

# Clean up any legacy mock donations
db.donations.delete_many({"donor_id": donor_id})
print("Database initialized (all mock donations removed)!")

