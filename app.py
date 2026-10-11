from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
import os
import re
import math
from datetime import datetime, timezone
from bson import ObjectId
app = Flask(__name__)
CORS(app) # Enables CORS for all routes so your webpage can access the API

# MongoDB connection string (defaults to local MongoDB at mongodb://localhost:27017/)
MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/')
client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)

try:
    client.admin.command('ping')
    print(f"Connected to MongoDB successfully at {MONGO_URI}")
except Exception as e:
    print(f"Warning: Could not connect to MongoDB at {MONGO_URI}: {e}")

# Connect to the 'jivahar' database
db = client['jivahar']

# Connect to the 'users' collection
users_collection = db['users']

# Auto-ensure default Admin user
try:
    if not users_collection.find_one({"email": "admin@jivahar.com"}):
        users_collection.insert_one({
            "name": "Platform Administrator",
            "email": "admin@jivahar.com",
            "password": generate_password_hash("admin123"),
            "role": "admin",
            "approved": True,
            "phone": "9876543210"
        })
except Exception as e:
    print("Warning initializing admin account:", e)

@app.route('/')
def home():
    return "Jivahar Flask API is running!"

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    
    email = data.get('email', '').strip()
    password = data.get('password', '')
    phone = data.get('phone', '').strip()
    role = data.get('role', '')
    name = data.get('name', '').strip()
    
    if not email or not password or not name:
        return jsonify({"success": False, "message": "Missing required fields (name, email, password)"}), 400
        
    # Backend Email Validation
    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        return jsonify({"success": False, "message": "Invalid email format"}), 400
        
    # Backend Phone Validation (Optional but if provided, must be 10-14 digits)
    if phone and not re.match(r"^\+?[0-9]{10,14}$", re.sub(r'[\s\-\(\)]', '', phone)):
        return jsonify({"success": False, "message": "Invalid phone format"}), 400
        
    # Check if user already exists
    if users_collection.find_one({"email": email}):
        return jsonify({"success": False, "message": "User with this email already exists"}), 409
        
    # Hash the password
    hashed_password = generate_password_hash(password)
        
    new_user = {
        "name": name,
        "email": email,
        "phone": phone,
        "password": hashed_password,
        "role": role,
        "approved": False if role == 'ngo' else True,
        "is_location_set": False
    }
    
    users_collection.insert_one(new_user)
    
    # Return success and the user (excluding password)
    new_user.pop('password', None)
    new_user['_id'] = str(new_user['_id']) # Convert ObjectId to string
    
    return jsonify({
        "success": True, 
        "message": "User registered successfully!",
        "user": new_user
    }), 201

@app.route('/api/auth/set-location', methods=['POST'])
def set_user_location():
    data = request.json or {}
    user_id = data.get('user_id')
    lat = data.get('lat')
    lng = data.get('lng')
    address = data.get('address', '')

    if not user_id or lat is None or lng is None:
        return jsonify({"success": False, "message": "Missing required fields (user_id, lat, lng)"}), 400

    try:
        if ObjectId.is_valid(str(user_id)):
            query = {"_id": ObjectId(user_id)}
        else:
            query = {"_id": str(user_id)}

        update_data = {
            "lat": float(lat),
            "lng": float(lng),
            "address": address,
            "location": {
                "address": address,
                "latitude": float(lat),
                "longitude": float(lng)
            },
            "is_location_set": True
        }

        users_collection.update_one(query, {"$set": update_data})
        user = users_collection.find_one(query)
        if user:
            user.pop('password', None)
            user['_id'] = str(user['_id'])
            return jsonify({"success": True, "message": "Location configured successfully!", "user": user})
        return jsonify({"success": True, "message": "Location updated successfully"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    
    email = data.get('email', '').strip()
    password = data.get('password', '')
    role = data.get('role')
    
    # Find user by email
    user = users_collection.find_one({"email": email})
    
    if user and check_password_hash(user.get('password', ''), password):
        # Check approval status for NGOs
        if user.get('role') == 'ngo' and not user.get('approved', False):
            return jsonify({
                "success": False,
                "message": "Your NGO account is pending admin approval."
            }), 403

        # Success!
        user.pop('password', None)
        user['_id'] = str(user['_id'])
        
        return jsonify({
            "success": True,
            "message": "Login successful",
            "user": user
        }), 200
    else:
        # Failed login
        return jsonify({
            "success": False,
            "message": "Invalid email or password"
        }), 401

donations_collection = db['donations']

def calculate_distance_km(lat1, lon1, lat2, lon2):
    try:
        R = 6371.0 # Earth radius in km
        dlat = math.radians(float(lat2) - float(lat1))
        dlon = math.radians(float(lon2) - float(lon1))
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(float(lat1))) * math.cos(math.radians(float(lat2))) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c
    except Exception:
        return 999.0

# Cascading Notification Time Gaps (in minutes)
TIER2_UNLOCK_MINUTES = 15  # Unlocks 25 km circle after 15 minutes if unclaimed

def evaluate_cascade_status(donation):
    """Automatically advances notification cascade tier based on elapsed time if unclaimed."""
    if donation.get('status') != 'Pending':
        return donation

    created_at = donation.get('created_at')
    if not created_at:
        return donation

    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        except Exception:
            return donation

    now = datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    elapsed_minutes = (now - created_at).total_seconds() / 60.0
    cascade = donation.get('notification_cascade', {})
    current_tier = cascade.get('active_tier', 1)

    new_tier = current_tier
    if elapsed_minutes >= TIER2_UNLOCK_MINUTES and current_tier < 2:
        new_tier = 2

    if new_tier > current_tier:
        new_radius = "25 km"
        t1_ngos = cascade.get('tier1_ngos', [])
        t2_ngos = cascade.get('tier2_ngos', [])

        currently_notified = t1_ngos + t2_ngos

        history = cascade.get('history', [])
        history.append({
            "tier": new_tier,
            "radius": new_radius,
            "notified_at": now.isoformat(),
            "reason": f"Auto-unlocked after {int(elapsed_minutes)} minutes unclaimed"
        })

        donations_collection.update_one(
            {"_id": donation['_id']},
            {"$set": {
                "notification_cascade.active_tier": new_tier,
                "notification_cascade.active_radius": new_radius,
                "notification_cascade.currently_notified": currently_notified,
                "notification_cascade.history": history
            }}
        )

        cascade['active_tier'] = new_tier
        cascade['active_radius'] = new_radius
        cascade['currently_notified'] = currently_notified
        cascade['history'] = history
        donation['notification_cascade'] = cascade

    return donation

@app.route('/api/donations', methods=['POST'])
def create_donation():
    try:
        data = request.json or {}
        donor_id = data.get('donor_id')
        items = data.get('items', [])
        pickup_location = data.get('pickup_location') or {}
        pickup_details = data.get('pickup_details') or {}
        
        if not donor_id or not items:
            return jsonify({"success": False, "message": "Missing required fields (donor_id and items required)"}), 400

        donor_lat = pickup_location.get('latitude') if pickup_location.get('latitude') is not None else pickup_details.get('lat')
        donor_lng = pickup_location.get('longitude') if pickup_location.get('longitude') is not None else pickup_details.get('lng')
        pickup_address = pickup_location.get('address') or pickup_details.get('address', 'Pickup Point')

        if not pickup_location:
            pickup_location = {
                "address": pickup_address,
                "latitude": float(donor_lat) if donor_lat is not None else None,
                "longitude": float(donor_lng) if donor_lng is not None else None
            }

        if not pickup_details:
            pickup_details = {
                "address": pickup_address,
                "lat": float(donor_lat) if donor_lat is not None else None,
                "lng": float(donor_lng) if donor_lng is not None else None
            }

        # Query all approved registered NGOs
        approved_ngos = list(users_collection.find({"role": "ngo", "approved": True}))
        
        tier1_ngos = [] # 0 - 15 km (Priority)
        tier2_ngos = [] # 15 - 25 km (Secondary Cascade)

        idx = 0
        for ngo in approved_ngos:
            idx += 1
            ngo_lat = ngo.get('lat') or ngo.get('location', {}).get('latitude')
            ngo_lng = ngo.get('lng') or ngo.get('location', {}).get('longitude')
            
            # Position calculation fallback if NGO coordinates not explicit
            if not ngo_lat or not ngo_lng:
                if donor_lat and donor_lng:
                    ngo_lat = float(donor_lat) + ((idx) * 0.005 * (1 if idx % 2 == 0 else -1))
                    ngo_lng = float(donor_lng) + ((idx) * 0.006 * (-1 if idx % 3 == 0 else 1))
                else:
                    ngo_lat = 12.9784 + (idx * 0.005)
                    ngo_lng = 77.6408 + (idx * 0.005)

            dist_km = calculate_distance_km(donor_lat or 12.9784, donor_lng or 77.6408, ngo_lat, ngo_lng)
            
            ngo_info = {
                "id": str(ngo.get('_id')),
                "name": ngo.get('name', 'Registered NGO'),
                "email": ngo.get('email', ''),
                "phone": ngo.get('phone', ''),
                "distance_km": round(dist_km, 1)
            }

            if dist_km <= 15.0:
                tier1_ngos.append(ngo_info)
            elif dist_km <= 25.0:
                tier2_ngos.append(ngo_info)

        # Initial notification goes to Tier 1 (15 km) first, or fallback to Tier 2 (25 km) if empty
        notified_initial = tier1_ngos if len(tier1_ngos) > 0 else tier2_ngos
        active_tier = 1 if len(tier1_ngos) > 0 else 2
        active_radius = "15 km" if active_tier == 1 else "25 km"

        notification_cascade = {
            "active_tier": active_tier,
            "active_radius": active_radius,
            "tier1_ngos": tier1_ngos,
            "tier2_ngos": tier2_ngos,
            "currently_notified": notified_initial,
            "history": [
                {
                    "tier": active_tier,
                    "radius": active_radius,
                    "notified_at": datetime.now(timezone.utc).isoformat(),
                    "ngo_count": len(notified_initial)
                }
            ]
        }
            
        donor_obj_id = ObjectId(str(donor_id)) if (len(str(donor_id)) == 24 and ObjectId.is_valid(str(donor_id))) else str(donor_id)

        donation = {
            "donor_id": donor_obj_id,
            "items": items,
            "pickup_location": pickup_location,
            "pickup_details": pickup_details,
            "status": "Pending",
            "notification_cascade": notification_cascade,
            "created_at": datetime.now(timezone.utc)
        }
        
        result = donations_collection.insert_one(donation)
        donation['_id'] = str(result.inserted_id)
        donation['donor_id'] = str(donation['donor_id'])
        donation['created_at'] = donation['created_at'].isoformat()

        msg = f"Donation created! Notified {len(notified_initial)} registered NGO(s) within {active_radius} priority radius."
        if active_tier == 1 and len(tier2_ngos) > 0:
            msg += f" Auto-unlock to 25 km (in {TIER2_UNLOCK_MINUTES}m) scheduled."

        return jsonify({
            "success": True, 
            "message": msg, 
            "donation": donation,
            "notification_summary": {
                "active_tier": active_tier,
                "active_radius": active_radius,
                "tier1_count": len(tier1_ngos),
                "tier2_count": len(tier2_ngos),
                "notified_count": len(notified_initial)
            }
        }), 201
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/donations/cascade-advance/<donation_id>', methods=['POST'])
def advance_donation_cascade(donation_id):
    try:
        from bson.objectid import ObjectId
        don_id = ObjectId(donation_id) if len(donation_id) == 24 else donation_id
        donation = donations_collection.find_one({"_id": don_id})
        
        if not donation:
            return jsonify({"success": False, "message": "Donation not found"}), 404

        cascade = donation.get('notification_cascade', {})
        current_tier = cascade.get('active_tier', 1)
        
        if current_tier >= 2:
            return jsonify({"success": False, "message": "Already at maximum 25 km notification radius"}), 400

        next_tier = 2
        next_radius = "25 km"
        next_ngos = cascade.get('tier2_ngos', [])
        
        currently_notified = cascade.get('currently_notified', []) + next_ngos

        history = cascade.get('history', [])
        history.append({
            "tier": next_tier,
            "radius": next_radius,
            "notified_at": datetime.now(timezone.utc).isoformat(),
            "ngo_count": len(next_ngos)
        })

        donations_collection.update_one(
            {"_id": don_id},
            {"$set": {
                "notification_cascade.active_tier": next_tier,
                "notification_cascade.active_radius": next_radius,
                "notification_cascade.currently_notified": currently_notified,
                "notification_cascade.history": history
            }}
        )

        return jsonify({
            "success": True,
            "message": f"Cascade expanded to Tier {next_tier} ({next_radius}). {len(next_ngos)} new NGO(s) notified!",
            "active_tier": next_tier,
            "active_radius": next_radius,
            "newly_notified_count": len(next_ngos)
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/donations/cancel/<donation_id>', methods=['POST'])
def cancel_donation(donation_id):
    try:
        from bson.objectid import ObjectId
        don_id = ObjectId(donation_id) if len(donation_id) == 24 else donation_id
        donation = donations_collection.find_one({"_id": don_id})
        
        if not donation:
            return jsonify({"success": False, "message": "Donation not found"}), 404

        current_status = donation.get('status', 'Pending')
        if current_status == 'Delivered':
            return jsonify({"success": False, "message": "Cannot cancel a donation that has already been delivered."}), 400

        if current_status == 'Cancelled':
            return jsonify({"success": False, "message": "Donation is already cancelled."}), 400

        donations_collection.update_one(
            {"_id": don_id},
            {"$set": {
                "status": "Cancelled",
                "cancelled_at": datetime.now(timezone.utc)
            }}
        )

        return jsonify({
            "success": True,
            "message": "Donation cancelled successfully."
        }), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/donations/<donor_id>', methods=['GET'])
def get_donations(donor_id):
    try:
        # Check if donor_id is a valid ObjectId, else use string
        query_id = ObjectId(donor_id) if len(donor_id) == 24 else donor_id
        donations = list(donations_collection.find({"donor_id": query_id}).sort("created_at", -1))
        
        for d in donations:
            evaluate_cascade_status(d)
            d['_id'] = str(d['_id'])
            d['donor_id'] = str(d['donor_id'])
            # Convert datetime to ISO format
            if 'created_at' in d and hasattr(d['created_at'], 'isoformat'):
                d['created_at'] = d['created_at'].isoformat()
                
        return jsonify({"success": True, "donations": donations}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/donations/stats/<donor_id>', methods=['GET'])
def get_donation_stats(donor_id):
    try:
        query_id = ObjectId(donor_id) if len(donor_id) == 24 else donor_id
        donations = list(donations_collection.find({"donor_id": query_id}))
        
        total_donations = len(donations)
        total_kg = 0
        total_items = 0
        
        # Simple stats calculation
        for d in donations:
            for item in d.get('items', []):
                total_items += 1
                qty = float(item.get('quantity', 0))
                unit = item.get('unit', '').lower()
                if unit == 'kg' or unit == 'litres':
                    total_kg += qty
                elif unit == 'pieces':
                    # approximate 10 pieces = 1kg just for stats if no other metric
                    total_kg += (qty * 0.1)
                    
        # approximate people impacted (e.g. 1 kg = 4 meals)
        people_impacted = int(total_kg * 4)
        
        stats = {
            "total_donations": total_donations,
            "total_kg": round(total_kg, 1),
            "total_items": total_items,
            "people_impacted": people_impacted
        }
        
        return jsonify({"success": True, "stats": stats}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# --- Admin NGO Approval Routes ---

@app.route('/api/admin/ngos/pending', methods=['GET'])
def get_pending_ngos():
    pending_ngos = list(users_collection.find({"role": "ngo", "approved": False}))
    for ngo in pending_ngos:
        ngo.pop('password', None)
        ngo['_id'] = str(ngo['_id'])
    
    return jsonify({
        "success": True,
        "ngos": pending_ngos
    }), 200

@app.route('/api/admin/ngos/approve/<user_id>', methods=['POST'])
def approve_ngo(user_id):
    from bson.objectid import ObjectId
    try:
        query_id = ObjectId(user_id) if (len(str(user_id)) == 24 and ObjectId.is_valid(str(user_id))) else str(user_id)
        result = users_collection.update_one(
            {"_id": query_id, "role": "ngo"},
            {"$set": {"approved": True}}
        )
        if result.modified_count == 1 or result.matched_count == 1:
            return jsonify({"success": True, "message": "NGO approved successfully! Account is now active."}), 200
        else:
            return jsonify({"success": False, "message": "NGO not found or already approved."}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400

@app.route('/api/donations/update-status/<donation_id>', methods=['POST'])
def update_donation_status(donation_id):
    try:
        from bson.objectid import ObjectId
        data = request.json or {}
        new_status = data.get('status')
        volunteer_name = data.get('volunteer_name', 'Assigned Volunteer')
        volunteer_phone = data.get('volunteer_phone', '')

        if not new_status:
            return jsonify({"success": False, "message": "Status is required"}), 400

        don_id = ObjectId(donation_id) if (len(str(donation_id)) == 24 and ObjectId.is_valid(str(donation_id))) else str(donation_id)
        
        update_data = {
            "status": new_status,
            "volunteer": volunteer_name,
            "volunteer_phone": volunteer_phone,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        result = donations_collection.update_one(
            {"_id": don_id},
            {"$set": update_data}
        )

        if result.modified_count == 1 or result.matched_count == 1:
            return jsonify({
                "success": True,
                "message": f"Donation status updated to '{new_status}' successfully!",
                "status": new_status
            }), 200
        else:
            return jsonify({"success": False, "message": "Donation record not found."}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/donations/all', methods=['GET'])
def get_all_donations():
    try:
        donations = list(donations_collection.find().sort("created_at", -1))
        for d in donations:
            evaluate_cascade_status(d)
            d['_id'] = str(d['_id'])
            if 'donor_id' in d:
                d['donor_id'] = str(d['donor_id'])
            if 'created_at' in d and hasattr(d['created_at'], 'isoformat'):
                d['created_at'] = d['created_at'].isoformat()
        return jsonify({"success": True, "donations": donations}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/donations/accept/<donation_id>', methods=['POST'])
def accept_donation_by_ngo(donation_id):
    try:
        from bson.objectid import ObjectId
        data = request.json or {}
        ngo_id = data.get('ngo_id')
        ngo_name = data.get('ngo_name', 'NGO')
        ngo_phone = data.get('ngo_phone', '')

        don_id = ObjectId(donation_id) if len(donation_id) == 24 else donation_id
        donation = donations_collection.find_one({"_id": don_id})

        if not donation:
            return jsonify({"success": False, "message": "Donation not found"}), 404

        if donation.get('status') == 'Cancelled':
            return jsonify({"success": False, "message": "Cannot accept a cancelled donation."}), 400

        now = datetime.now(timezone.utc)
        donations_collection.update_one(
            {"_id": don_id},
            {"$set": {
                "status": "Accepted",
                "assigned_ngo": {
                    "id": ngo_id,
                    "name": ngo_name,
                    "phone": ngo_phone,
                    "accepted_at": now.isoformat()
                }
            }}
        )

        return jsonify({
            "success": True,
            "message": f"Donation successfully accepted by {ngo_name}!"
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/donations/reject/<donation_id>', methods=['POST'])
def reject_donation_by_ngo(donation_id):
    try:
        from bson.objectid import ObjectId
        data = request.json or {}
        ngo_id = data.get('ngo_id')
        reason = data.get('reason', 'Passed to next NGO')

        don_id = ObjectId(donation_id) if len(donation_id) == 24 else donation_id
        donation = donations_collection.find_one({"_id": don_id})

        if not donation:
            return jsonify({"success": False, "message": "Donation not found"}), 404

        cascade = donation.get('notification_cascade', {})
        history = cascade.get('history', [])
        history.append({
            "action": "ngo_rejected",
            "ngo_id": ngo_id,
            "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

        current_tier = cascade.get('active_tier', 1)
        next_tier = 2 if current_tier < 2 else 2
        next_radius = "25 km"

        donations_collection.update_one(
            {"_id": don_id},
            {"$set": {
                "notification_cascade.active_tier": next_tier,
                "notification_cascade.active_radius": next_radius,
                "notification_cascade.history": history
            }}
        )

        return jsonify({
            "success": True,
            "message": "Donation passed to the next available tier/NGO."
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/ngos', methods=['GET'])
def get_registered_ngos():
    try:
        ngos = list(users_collection.find({"role": "ngo", "approved": True}))
        for ngo in ngos:
            ngo.pop('password', None)
            ngo['_id'] = str(ngo['_id'])
        return jsonify({
            "success": True,
            "ngos": ngos
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

if __name__ == '__main__':

    app.run(debug=True, port=5000)