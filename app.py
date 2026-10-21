from flask import Flask, jsonify, request, send_from_directory
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

# ============================================
# YOLO Food Detection Model Initialization
# ============================================
yolo_food_model = None
try:
    from ultralytics import YOLO
    from PIL import Image
    import io
    import base64

    # Priority 1: Trained food classification model (best.pt) in 'models'
    custom_weights = os.path.join(os.path.dirname(__file__), 'models', 'best.pt')
    coco_weights = os.path.join(os.path.dirname(__file__), 'models', 'yolo26n.pt')

    if os.path.exists(custom_weights):
        yolo_food_model = YOLO(custom_weights)
        print(f"YOLO food detection model loaded successfully from {custom_weights}")
    elif os.path.exists(coco_weights):
        yolo_food_model = YOLO(coco_weights)
        print(f"YOLO base model loaded from {coco_weights}")
except Exception as e:
    print(f"Warning: Could not initialize YOLO model on startup: {e}")

@app.route('/')
def home():
    if os.path.exists('index.html'):
        return send_from_directory('.', 'index.html')
    return "Jivahar Flask API is running!"

@app.route('/<path:path>')
def send_static(path):
    if not path.startswith('api/'):
        # 1. Direct path check (root or specified)
        if os.path.exists(path):
            return send_from_directory('.', path)
        # 2. CSS folder fallback
        css_path = os.path.join('css', path)
        if os.path.exists(css_path):
            return send_from_directory('css', path)
        # 3. JS folder fallback
        js_path = os.path.join('js', path)
        if os.path.exists(js_path):
            return send_from_directory('js', path)
        # 4. Assets folder fallback
        assets_path = os.path.join('assets', path)
        if os.path.exists(assets_path):
            return send_from_directory('assets', path)
    return jsonify({"success": False, "message": "Not Found"}), 404

@app.route('/api/ai/detect-food', methods=['POST'])
def detect_food():
    try:
        global yolo_food_model
        image_bytes = None
        hint_filename = ""
        
        # 1. Read image from multipart form upload or JSON base64
        if 'image' in request.files:
            hint_filename = request.files['image'].filename or ""
            image_bytes = request.files['image'].read()
        elif request.json and 'image' in request.json:
            import base64
            b64_data = request.json['image']
            if ',' in b64_data:
                b64_data = b64_data.split(',', 1)[1]
            image_bytes = base64.b64decode(b64_data)
        
        if not image_bytes:
            return jsonify({"success": False, "message": "No food image provided for detection"}), 400

        # 2. Ensure model is loaded
        if yolo_food_model is None:
            from ultralytics import YOLO
            custom_weights = os.path.join(os.path.dirname(__file__), 'models', 'best.pt')
            coco_weights = os.path.join(os.path.dirname(__file__), 'models', 'yolo26n.pt')
            target_weights = custom_weights if os.path.exists(custom_weights) else coco_weights
            if os.path.exists(target_weights):
                yolo_food_model = YOLO(target_weights)

        if yolo_food_model is None:
            return jsonify({"success": False, "message": "YOLO model weights not found in 'models'"}), 500

        # 3. Load image into PIL
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(image_bytes)).convert('RGB')

        # 4. Multi-threshold detection stage on trained food classes (dosa, idli, vada, chutney)
        detections = []
        for conf_lvl in [0.25, 0.20]:
            results = yolo_food_model(img, conf=conf_lvl, verbose=False)
            res_boxes = results[0].boxes
            if len(res_boxes) > 0:
                for box in res_boxes:
                    cls_id = int(box.cls[0])
                    conf_val = float(box.conf[0])
                    cls_name = yolo_food_model.names[cls_id]
                    xyxy = [round(float(coord), 1) for coord in box.xyxy[0].tolist()]
                    detections.append({
                        "class": cls_name,
                        "confidence": round(conf_val, 2),
                        "box": xyxy
                    })
                break

        # Fallback check on COCO model ONLY if custom model weights are not loaded or returned no boxes
        if len(detections) == 0:
            coco_weights = os.path.join(os.path.dirname(__file__), 'models', 'yolo26n.pt')
            if os.path.exists(coco_weights):
                try:
                    from ultralytics import YOLO
                    coco_model = YOLO(coco_weights)
                    coco_res = coco_model(img, conf=0.25, verbose=False)[0]
                    food_coco_classes = {'banana', 'apple', 'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake'}
                    for box in coco_res.boxes:
                        cls_name = coco_model.names[int(box.cls[0])]
                        if cls_name.lower() in food_coco_classes:
                            detections.append({
                                "class": cls_name,
                                "confidence": round(float(box.conf[0]), 2),
                                "box": [round(float(c), 1) for c in box.xyxy[0].tolist()]
                            })
                except Exception as coco_err:
                    print("COCO fallback error:", coco_err)

        # 5. Build clean classification response
        if not detections:
            # NO FOOD DETECTED in image: Do NOT force Dosa or any default food item
            return jsonify({
                "success": True,
                "food_detected": False,
                "food_name": None,
                "food_items": [],
                "detections": [],
                "detected_count": 0,
                "message": "No food items detected in the uploaded image. Please upload a clear photo of food."
            }), 200

        # Sort detections by confidence descending
        detections.sort(key=lambda d: d['confidence'], reverse=True)

        # Group detections by class to accurately handle single vs multiple distinct food items
        class_groups = {}
        for d in detections:
            c_name = d['class'].capitalize()
            if c_name not in class_groups:
                class_groups[c_name] = {
                    "name": c_name,
                    "count": 0,
                    "max_confidence": d['confidence'],
                    "boxes": []
                }
            class_groups[c_name]["count"] += 1
            class_groups[c_name]["boxes"].append(d['box'])

        food_items = []
        for c_name, grp in class_groups.items():
            unit = "pieces" if c_name.lower() in ["idli", "vada", "puri", "chapathi", "holige", "laddu", "bananna", "banana"] else "plates"
            food_items.append({
                "name": c_name,
                "count": grp["count"],
                "confidence": round(float(grp["max_confidence"]), 2),
                "default_unit": unit
            })

        all_names = [fi["name"] for fi in food_items]
        summary_name = " & ".join(all_names)
        primary_conf = food_items[0]["confidence"]

        return jsonify({
            "success": True,
            "food_detected": True,
            "food_name": summary_name,
            "primary_name": food_items[0]["name"],
            "primary_confidence": primary_conf,
            "multiple_items": len(food_items) > 1,
            "food_items": food_items,
            "detections": detections,
            "detected_count": len(detections)
        })
    except Exception as e:
        print("Error in detect_food:", e)
        return jsonify({"success": False, "message": str(e)}), 500

# ==============================================================================
# LOCAL OLLAMA LLM INTEGRATION (Food Shelf Life, Edibility & Donation Summary)
# ==============================================================================
OLLAMA_HOST = os.environ.get('OLLAMA_HOST', 'http://localhost:11434')
OLLAMA_MODEL = os.environ.get('OLLAMA_MODEL', 'llama3.2:1b')

def call_ollama_llm(prompt, format_json=False, timeout=10, max_tokens=100):
    """Query local Ollama instance with timeout and fallback support"""
    import urllib.request
    import json
    try:
        payload = {
            'model': OLLAMA_MODEL,
            'prompt': prompt,
            'stream': False,
            'options': {
                'num_predict': max_tokens,
                'temperature': 0.2
            }
        }
        if format_json:
            payload['format'] = 'json'

        req = urllib.request.Request(
            f"{OLLAMA_HOST}/api/generate",
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('response', '')
    except Exception as err:
        print(f"Ollama call notice: {err}")
        return None

@app.route('/api/ai/analyze-shelf-life', methods=['POST'])
def analyze_shelf_life():
    """
    Compare shelf life of food against time elapsed (current system time - prepared time)
    and storage condition to determine if food is Edible or Not Edible using local Ollama LLM.
    """
    try:
        data = request.json or {}
        food_name = (data.get('food_name') or 'Cooked Food').strip()
        prep_time_str = data.get('prep_time', '')
        storage_condition = (data.get('storage_condition') or 'Room Temperature').strip()
        
        # 1. Automatically retrieve current system time
        now = datetime.now()
        
        # 2. Parse prepared time
        prep_time = None
        if prep_time_str:
            try:
                prep_time = datetime.fromisoformat(prep_time_str)
            except Exception:
                try:
                    prep_time = datetime.strptime(prep_time_str, "%Y-%m-%dT%H:%M")
                except Exception:
                    prep_time = now
        else:
            prep_time = now
            
        # 3. Calculate difference in hours
        diff_seconds = (now - prep_time).total_seconds()
        hours_elapsed = max(0.0, round(diff_seconds / 3600.0, 1))
        
        # 4. Standard Food Safety Shelf Life baseline (hours)
        fn_lower = food_name.lower()
        storage_lower = storage_condition.lower()
        
        if any(w in fn_lower for w in ['chutney', 'sauce', 'dip']):
            base_shelf = 3.5
        elif any(w in fn_lower for w in ['dosa', 'idli', 'vada', 'roti', 'chapati', 'bread']):
            base_shelf = 5.0
        elif any(w in fn_lower for w in ['rice', 'biryani', 'pulao', 'dal', 'sambar', 'curry']):
            base_shelf = 4.5
        elif any(w in fn_lower for w in ['milk', 'curd', 'paneer', 'sweet', 'dairy']):
            base_shelf = 3.0
        elif any(w in fn_lower for w in ['fruit', 'salad']):
            base_shelf = 6.0
        else:
            base_shelf = 4.5
            
        # Adjust shelf life based on storage condition
        if 'refrigerat' in storage_lower or 'cold' in storage_lower:
            shelf_life_hours = round(base_shelf * 6.0, 1) # ~24-30 hrs
        elif 'frozen' in storage_lower:
            shelf_life_hours = round(base_shelf * 24.0, 1) # ~5-7 days
        elif 'hot' in storage_lower or 'warm' in storage_lower:
            shelf_life_hours = min(6.0, round(base_shelf * 1.1, 1))
        else: # Room Temperature
            shelf_life_hours = base_shelf
            
        remaining_hours = round(shelf_life_hours - hours_elapsed, 1)
        is_edible = bool(hours_elapsed <= shelf_life_hours)
        status = "Edible" if is_edible else "Not Edible"
        
        # 5. Query Local Ollama LLM for expert food safety assessment
        llm_reason = ""
        prompt = (
            f"You are a Food Safety Expert AI. A donation of '{food_name}' was prepared {hours_elapsed} hours ago "
            f"and stored at '{storage_condition}'. The typical safe shelf life is ~{shelf_life_hours} hours. "
            f"The food is {'Edible (safe to consume)' if is_edible else 'Not Edible (spoiled/unsafe)'}. "
            f"In one concise sentence, explain why based on bacterial safety, freshness window, and storage."
        )
        raw_response = call_ollama_llm(prompt, format_json=False, timeout=8, max_tokens=70)
        if raw_response and len(raw_response.strip()) > 8:
            llm_reason = raw_response.strip().replace('"', '')
            
        if not llm_reason:
            if is_edible:
                llm_reason = (
                    f"Fresh and safe to consume. Prepared {hours_elapsed}h ago under {storage_condition} "
                    f"with ~{remaining_hours}h of safe consumption window remaining."
                )
            else:
                llm_reason = (
                    f"Exceeded safe shelf life ({shelf_life_hours}h limit). Prepared {hours_elapsed}h ago under {storage_condition}; "
                    f"risk of bacterial growth makes it unsafe."
                )

        return jsonify({
            "success": True,
            "food_name": food_name,
            "current_time": now.strftime("%Y-%m-%d %H:%M:%S"),
            "prepared_time": prep_time.strftime("%Y-%m-%d %H:%M:%S"),
            "hours_elapsed": hours_elapsed,
            "shelf_life_hours": shelf_life_hours,
            "remaining_hours": remaining_hours,
            "storage_condition": storage_condition,
            "is_edible": is_edible,
            "status": status,
            "reason": llm_reason,
            "model_used": OLLAMA_MODEL
        }), 200
    except Exception as e:
        print("Shelf life analysis error:", e)
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/ai/donation-summary', methods=['POST'])
def donation_summary():
    """
    Generate an AI-powered comprehensive donation summary using local Ollama LLM.
    """
    try:
        data = request.json or {}
        items = data.get('items', [])
        
        if not items:
            return jsonify({
                "success": True,
                "summary_headline": "No Food Items",
                "summary_text": "Add at least one food item to generate a donation summary.",
                "all_edible": True,
                "edible_count": 0,
                "total_items": 0,
                "handling_advice": "No items to analyze."
            }), 200
            
        now = datetime.now()
        total_items = len(items)
        edible_count = 0
        items_summary_list = []
        
        for item in items:
            name = item.get('name', 'Food Item')
            qty = item.get('quantity', 1)
            unit = item.get('unit', 'plates')
            storage = item.get('storageCondition', 'Room Temperature')
            is_edible = True
            if 'edibility' in item and isinstance(item['edibility'], dict):
                is_edible = item['edibility'].get('is_edible', True)
            if is_edible:
                edible_count += 1
            status_text = "Edible" if is_edible else "Not Edible"
            items_summary_list.append(f"{qty} {unit} of {name} ({storage}, {status_text})")
            
        all_edible = (edible_count == total_items)
        items_str = ", ".join(items_summary_list)
        
        # Query Ollama LLM for donation summary
        llm_summary = ""
        llm_advice = ""
        prompt = (
            f"You are Jivahar Food Rescue AI. Summarize this surplus food donation:\n"
            f"Food items: {items_str}.\n"
            f"Current time: {now.strftime('%Y-%m-%d %H:%M')}.\n"
            f"Edibility: {edible_count}/{total_items} items safe for consumption.\n"
            f"Return JSON with: 'summary' (2 concise sentences summarizing the donation quality and contents) "
            f"and 'advice' (1 sentence of handling/logistics advice for volunteers/NGOs)."
        )
        raw = call_ollama_llm(prompt, format_json=True, timeout=10, max_tokens=120)
        if raw:
            try:
                import json
                parsed = json.loads(raw)
                llm_summary = parsed.get('summary', '')
                llm_advice = parsed.get('advice', '')
            except Exception:
                pass
                
        if not llm_summary:
            if all_edible:
                llm_summary = (
                    f"Donation contains {total_items} verified edible food item(s) including {items_str}. "
                    f"All items are currently within safe shelf life and suitable for immediate distribution."
                )
                llm_advice = "Distribute promptly while food remains at peak freshness."
            else:
                llm_summary = (
                    f"Donation contains {total_items} item(s): {edible_count} verified edible and "
                    f"{total_items - edible_count} flagged as exceeding safe shelf life limits."
                )
                llm_advice = "Please segregate any inedible items and distribute only safe food."
                
        return jsonify({
            "success": True,
            "summary_headline": "All Items Verified Edible & Fresh" if all_edible else "Quality Review Notice",
            "summary_text": llm_summary,
            "handling_advice": llm_advice or "Maintain appropriate storage temperatures during transit.",
            "all_edible": all_edible,
            "edible_count": edible_count,
            "total_items": total_items,
            "model_used": OLLAMA_MODEL
        }), 200
    except Exception as e:
        print("Donation summary error:", e)
        return jsonify({"success": False, "message": str(e)}), 500

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
    """Safely preserves notification cascade status."""
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
        
        all_ngos = []
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
                    ngo_lat = 15.1511 + (idx * 0.005)
                    ngo_lng = 76.9062 + (idx * 0.005)

            dist_km = calculate_distance_km(donor_lat or 15.1511, donor_lng or 76.9062, ngo_lat, ngo_lng)
            
            ngo_info = {
                "id": str(ngo.get('_id')),
                "name": ngo.get('name', 'Registered NGO'),
                "email": ngo.get('email', ''),
                "phone": ngo.get('phone', ''),
                "distance_km": round(dist_km, 2)
            }
            all_ngos.append(ngo_info)

            if dist_km <= 15.0:
                tier1_ngos.append(ngo_info)
            elif dist_km <= 25.0:
                tier2_ngos.append(ngo_info)

        # Sort all NGOs strictly by proximity ascending (nearest NGO first)
        all_ngos_sorted = sorted(all_ngos, key=lambda x: x['distance_km'])

        # Only the SINGLE nearest NGO is notified initially!
        notified_initial = [all_ngos_sorted[0]] if len(all_ngos_sorted) > 0 else []
        nearest_ngo = all_ngos_sorted[0] if len(all_ngos_sorted) > 0 else None
        
        active_tier = 1 if (nearest_ngo and nearest_ngo['distance_km'] <= 15.0) else 2
        active_radius = f"{nearest_ngo['distance_km']} km" if nearest_ngo else "15 km"

        notification_cascade = {
            "active_tier": active_tier,
            "active_radius": active_radius,
            "ordered_ngos": all_ngos_sorted,
            "tier1_ngos": tier1_ngos,
            "tier2_ngos": tier2_ngos,
            "currently_notified": notified_initial,
            "history": [
                {
                    "action": "initial_nearest_notification",
                    "tier": active_tier,
                    "radius": active_radius,
                    "notified_at": datetime.now(timezone.utc).isoformat(),
                    "ngo": nearest_ngo
                }
            ] if nearest_ngo else []
        }
            
        donor_obj_id = ObjectId(str(donor_id)) if (len(str(donor_id)) == 24 and ObjectId.is_valid(str(donor_id))) else str(donor_id)

        # Check for non-edible vs edible items
        non_edible_items = []
        edible_items = []
        for item in items:
            edibility = item.get('edibility')
            is_edible = True
            if isinstance(edibility, dict):
                is_edible = edibility.get('is_edible', True)
            elif edibility is False:
                is_edible = False
            
            if not is_edible:
                non_edible_items.append(item)
            else:
                edible_items.append(item)

        initial_status = "Pending"
        if non_edible_items and len(edible_items) == 0:
            initial_status = "Directed to Manufacturer (Inedible Food Waste)"

        donation = {
            "donor_id": donor_obj_id,
            "items": items,
            "pickup_location": pickup_location,
            "pickup_details": pickup_details,
            "status": initial_status,
            "notification_cascade": notification_cascade if len(edible_items) > 0 else {"active_tier": 0, "active_radius": "0 km", "currently_notified": []},
            "created_at": datetime.now(timezone.utc)
        }
        
        result = donations_collection.insert_one(donation)
        don_id_str = str(result.inserted_id)
        donation['_id'] = don_id_str
        donation['donor_id'] = str(donation['donor_id'])
        donation['created_at'] = donation['created_at'].isoformat()

        # If non-edible items exist, automatically direct to Manufacturer and trigger real-time notification
        if non_edible_items:
            addr = pickup_location.get('address') or pickup_details.get('address') or "Bengaluru Central"
            total_non_edible_qty = sum(float(it.get('quantity', 0)) for it in non_edible_items)
            unit = non_edible_items[0].get('unit', 'kg') if non_edible_items else 'kg'
            item_names = [it.get('name', 'Cooked Food') for it in non_edible_items]
            reasons = "; ".join([it.get('edibility', {}).get('reason', '') for it in non_edible_items if isinstance(it.get('edibility'), dict) and it.get('edibility', {}).get('reason')])
            
            waste_doc = {
                "source": f"Donor Donation #{don_id_str[-6:].upper()}",
                "source_type": "Surplus Inedible Food Donation",
                "donation_id": don_id_str,
                "donor_id": str(donor_obj_id),
                "waste_type": f"Inedible {', '.join(item_names)}",
                "quantity_kg": total_non_edible_qty,
                "unit": unit,
                "moisture_level": "Medium (55%)",
                "shelf_life_note": reasons or "Exceeded safe consumption shelf life (AI evaluated)",
                "location": addr,
                "status": "Available",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            waste_intake_col.insert_one(waste_doc)

            # Insert real-time notification for manufacturer
            mfg_notifications_col.insert_one({
                "title": "New Inedible Food Consignment Directed",
                "message": f"{total_non_edible_qty} {unit} of {', '.join(item_names)} flagged as inedible and directed to your bio-fertilizer facility for recycling.",
                "source": waste_doc['source'],
                "location": addr,
                "waste_type": waste_doc['waste_type'],
                "quantity_kg": total_non_edible_qty,
                "donation_id": don_id_str,
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })

        if len(edible_items) == 0:
            msg = f"Food items were identified as non-edible (expired shelf life) and have been directly routed to Jivahar Fertilizer Manufacturers for organic recycling."
        elif non_edible_items:
            msg = f"Donation created! Edible items notified to {len(notified_initial)} NGO(s). {total_non_edible_qty} {unit} of non-edible items directed to Fertilizer Manufacturer."
        else:
            msg = f"Donation created! Notified {len(notified_initial)} registered NGO(s) within {active_radius} priority radius."
            if active_tier == 1 and len(tier2_ngos) > 0:
                msg += f" Auto-unlock to 25 km (in {TIER2_UNLOCK_MINUTES}m) scheduled."

        return jsonify({
            "success": True, 
            "message": msg, 
            "donation": donation,
            "has_non_edible": bool(non_edible_items),
            "notification_summary": {
                "active_tier": active_tier if len(edible_items) > 0 else 0,
                "active_radius": active_radius if len(edible_items) > 0 else "0 km",
                "tier1_count": len(tier1_ngos) if len(edible_items) > 0 else 0,
                "tier2_count": len(tier2_ngos) if len(edible_items) > 0 else 0,
                "notified_count": len(notified_initial) if len(edible_items) > 0 else 0,
                "directed_to_manufacturer": bool(non_edible_items)
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
        q_or = [{"donor_id": query_id}, {"donor_id": str(donor_id)}]
        donations = list(donations_collection.find({"$or": q_or}).sort("created_at", -1))
        
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
        q_or = [{"donor_id": query_id}, {"donor_id": str(donor_id)}]
        donations = list(donations_collection.find({"$or": q_or}))
        
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


# ==========================================================
# --- Admin Platform Management, Analytics & User Control ---
# ==========================================================
admin_audit_logs = db['admin_audit_logs']

@app.route('/api/admin/stats', methods=['GET'])
def get_admin_stats():
    """
    Real-time statistics & analytics for the Admin Command Center:
    Total users, role breakdown, donation metrics, meals saved, waste diverted, and recent activities.
    """
    try:
        from bson.objectid import ObjectId

        # 1. User stats
        total_users = users_collection.count_documents({})
        donors_count = users_collection.count_documents({"role": "donor"})
        ngos_count = users_collection.count_documents({"role": "ngo"})
        pending_ngos_count = users_collection.count_documents({"role": "ngo", "approved": False})
        approved_ngos_count = users_collection.count_documents({"role": "ngo", "approved": True})
        volunteers_count = users_collection.count_documents({"role": "volunteer"})
        manufacturers_count = users_collection.count_documents({"role": "manufacturer"})
        admins_count = users_collection.count_documents({"role": "admin"})

        # 2. Donation stats
        total_donations = donations_collection.count_documents({})
        active_donations = donations_collection.count_documents({
            "status": {"$in": ["Pending", "Accepted", "Assigned", "In Transit"]}
        })
        delivered_donations = donations_collection.count_documents({"status": "Delivered"})
        recycled_donations = donations_collection.count_documents({
            "status": {"$in": ["Directed to Manufacturer (Inedible Food Waste)", "Recycled / Manufacturer Intake"]}
        })
        cancelled_donations = donations_collection.count_documents({
            "status": {"$regex": "Cancelled", "$options": "i"}
        })

        # 3. Meals saved calculation (from delivered edible donations)
        meals_saved = 0
        delivered_docs = list(donations_collection.find({"status": "Delivered"}))
        for doc in delivered_docs:
            for item in doc.get('items', []):
                qty = float(item.get('quantity') or 0)
                unit = str(item.get('unit') or '').lower()
                if unit in ['servings', 'plates', 'meals', 'boxes', 'packets', 'people', 'persons']:
                    meals_saved += qty
                elif unit in ['kg', 'kgs', 'kilogram', 'kilograms']:
                    meals_saved += qty * 2.5
                else:
                    meals_saved += qty
        meals_saved = int(meals_saved)
        if meals_saved == 0 and delivered_donations > 0:
            meals_saved = delivered_donations * 25

        # 4. Waste intake stats (diverted from landfills into bio-fertilizer)
        total_waste_recycled_kg = 0.0
        intake_cursor = waste_intake_col.find({})
        for w in intake_cursor:
            total_waste_recycled_kg += float(w.get('quantity_kg') or 0)

        # 5. Recent System Activities (aggregated live from users and donations)
        recent_activities = []

        # Latest donations
        recent_donations = list(donations_collection.find().sort("created_at", -1).limit(6))
        for d in recent_donations:
            don_id = str(d['_id'])
            donor_id = d.get('donor_id')
            donor_name = "Donor"
            if donor_id:
                try:
                    q_id = ObjectId(donor_id) if (isinstance(donor_id, str) and ObjectId.is_valid(donor_id)) else donor_id
                    u = users_collection.find_one({"_id": q_id})
                    if u:
                        donor_name = u.get('name', 'Donor')
                except Exception:
                    pass
            
            items_str = ", ".join([f"{it.get('name', 'Food')} ({it.get('quantity', 1)} {it.get('unit', '')})" for it in d.get('items', [])]) or "Food Consignment"
            status = d.get('status', 'Pending')
            
            created_at = d.get('created_at')
            created_str = created_at.isoformat() if isinstance(created_at, datetime) else str(created_at or '')

            badge_color = "blue"
            if status == "Delivered":
                badge_color = "green"
            elif "Manufacturer" in status:
                badge_color = "purple"
            elif "Cancelled" in status:
                badge_color = "red"

            recent_activities.append({
                "type": "donation",
                "title": f"Donation #{don_id[-6:].upper()}",
                "description": f"{donor_name}: {items_str}",
                "status": status,
                "timestamp": created_str,
                "badge_class": badge_color
            })

        # Latest user registrations
        recent_users = list(users_collection.find().sort("_id", -1).limit(6))
        for u in recent_users:
            gen_time = u['_id'].generation_time if hasattr(u['_id'], 'generation_time') else datetime.now(timezone.utc)
            recent_activities.append({
                "type": "user_registration",
                "title": f"User Joined: {u.get('name', 'New User')}",
                "description": f"Role: {u.get('role', 'user').upper()} • {u.get('email', '')}",
                "status": "Approved" if u.get('approved', True) else "Pending Review",
                "timestamp": gen_time.isoformat(),
                "badge_class": "orange" if not u.get('approved', True) else "green"
            })

        # Sort combined activities by timestamp desc
        recent_activities.sort(key=lambda x: str(x.get('timestamp') or ''), reverse=True)
        recent_activities = recent_activities[:8]

        return jsonify({
            "success": True,
            "stats": {
                "total_users": total_users,
                "donors_count": donors_count,
                "ngos_count": ngos_count,
                "pending_ngos_count": pending_ngos_count,
                "approved_ngos_count": approved_ngos_count,
                "volunteers_count": volunteers_count,
                "manufacturers_count": manufacturers_count,
                "admins_count": admins_count,
                "total_donations": total_donations,
                "active_donations": active_donations,
                "delivered_donations": delivered_donations,
                "recycled_donations": recycled_donations,
                "cancelled_donations": cancelled_donations,
                "meals_saved": meals_saved,
                "total_waste_recycled_kg": round(total_waste_recycled_kg, 1),
                "recent_activities": recent_activities,
                "analytics": {
                    "role_distribution": {
                        "Donors": donors_count,
                        "NGO Partners": ngos_count,
                        "Volunteers": volunteers_count,
                        "Manufacturers": manufacturers_count
                    },
                    "donation_distribution": {
                        "Active / In Progress": active_donations,
                        "Delivered (Fed)": delivered_donations,
                        "Bio-Fertilizer Recycled": recycled_donations,
                        "Cancelled": cancelled_donations
                    }
                }
            }
        }), 200
    except Exception as e:
        print("Admin stats error:", e)
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/admin/users', methods=['GET'])
def get_admin_users():
    """
    List all platform users with role filters and real-time individual activity counts.
    """
    try:
        from bson.objectid import ObjectId
        role_filter = request.args.get('role', '').strip().lower()
        search_query = request.args.get('search', '').strip().lower()

        query = {}
        if role_filter and role_filter != 'all':
            query['role'] = role_filter

        users = list(users_collection.find(query, {"password": 0}).sort("_id", -1))
        
        user_list = []
        for u in users:
            u_id = str(u['_id'])
            u_role = u.get('role', 'user')
            u_name = u.get('name', 'User')
            u_email = u.get('email', '')
            u_phone = u.get('phone', '')

            # Search filtering
            if search_query:
                if (search_query not in u_name.lower() and 
                    search_query not in u_email.lower() and 
                    search_query not in u_phone.lower()):
                    continue

            # Calculate individual summary activity metric
            activity_metric = "Active Member"
            activity_count = 0
            if u_role == 'donor':
                q_or = [{"donor_id": u['_id']}, {"donor_id": u_id}]
                activity_count = donations_collection.count_documents({"$or": q_or})
                activity_metric = f"{activity_count} Donation(s)"
            elif u_role == 'ngo':
                q_or = [{"assigned_ngo.id": u_id}, {"assigned_ngo.name": u_name}]
                activity_count = donations_collection.count_documents({"$or": q_or})
                status_text = "Approved" if u.get('approved', False) else "Pending Review"
                activity_metric = f"{activity_count} Distributed • {status_text}"
            elif u_role == 'volunteer':
                q_or = [{"volunteer": u_name}, {"volunteer_phone": u_phone}]
                activity_count = donations_collection.count_documents({"$or": q_or})
                activity_metric = f"{activity_count} Delivery Task(s)"
            elif u_role == 'manufacturer':
                claimed_count = waste_intake_col.count_documents({"$or": [{"donor_id": u_id}, {"status": "Claimed for Processing"}]})
                activity_metric = f"{claimed_count} Waste Stream(s)"
            elif u_role == 'admin':
                activity_metric = "Platform Super Admin"

            created_at_str = u.get('created_at')
            if not created_at_str and hasattr(u['_id'], 'generation_time'):
                created_at_str = u['_id'].generation_time.strftime("%b %d, %Y")

            user_item = {
                "_id": u_id,
                "name": u_name,
                "email": u_email,
                "phone": u_phone or "Not provided",
                "role": u_role,
                "approved": u.get('approved', True),
                "is_location_set": u.get('is_location_set', False),
                "address": u.get('address') or (u.get('location', {}).get('address', 'Local Region')),
                "activity_metric": activity_metric,
                "activity_count": activity_count,
                "created_at": created_at_str or "Recent"
            }
            user_list.append(user_item)

        return jsonify({
            "success": True,
            "users": user_list,
            "total_count": len(user_list)
        }), 200
    except Exception as e:
        print("Admin get users error:", e)
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/admin/users/<user_id>', methods=['GET'])
def get_individual_user_details(user_id):
    """
    Get comprehensive individual data for a specific user, including role-specific activity records.
    """
    try:
        from bson.objectid import ObjectId
        query_id = ObjectId(user_id) if (len(str(user_id)) == 24 and ObjectId.is_valid(str(user_id))) else str(user_id)
        user = users_collection.find_one({"_id": query_id}, {"password": 0})
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404

        user['_id'] = str(user['_id'])
        user_role = user.get('role', 'user')
        user_name = user.get('name', 'User')
        user_phone = user.get('phone', '')

        activity_records = []
        kpis = {}

        if user_role == 'donor':
            q_or = [{"donor_id": query_id}, {"donor_id": str(query_id)}]
            donations = list(donations_collection.find({"$or": q_or}).sort("created_at", -1))
            total_items = 0
            edible_count = 0
            inedible_count = 0
            total_qty = 0.0
            for d in donations:
                d['_id'] = str(d['_id'])
                d['donor_id'] = str(d.get('donor_id', ''))
                if isinstance(d.get('created_at'), datetime):
                    d['created_at'] = d['created_at'].isoformat()
                
                for it in d.get('items', []):
                    total_items += 1
                    total_qty += float(it.get('quantity', 0))
                    ed = it.get('edibility')
                    if isinstance(ed, dict) and ed.get('is_edible') is False:
                        inedible_count += 1
                    else:
                        edible_count += 1
                activity_records.append(d)

            kpis = {
                "total_donations": len(donations),
                "total_food_items": total_items,
                "total_quantity": round(total_qty, 1),
                "edible_items_donated": edible_count,
                "inedible_items_recycled": inedible_count,
                "status_overview": "Healthy Contributor" if inedible_count <= edible_count else "High Inedible Ratio"
            }

        elif user_role == 'ngo':
            q_or = [{"assigned_ngo.id": str(query_id)}, {"assigned_ngo.name": user_name}]
            claimed = list(donations_collection.find({"$or": q_or}).sort("created_at", -1))
            delivered_count = 0
            for c in claimed:
                c['_id'] = str(c['_id'])
                if isinstance(c.get('created_at'), datetime):
                    c['created_at'] = c['created_at'].isoformat()
                if c.get('status') == 'Delivered':
                    delivered_count += 1
                activity_records.append(c)

            kpis = {
                "total_claimed": len(claimed),
                "total_delivered": delivered_count,
                "in_progress": len(claimed) - delivered_count,
                "approval_status": "Approved Partner" if user.get('approved', False) else "Pending Verification"
            }

        elif user_role == 'volunteer':
            q_or = [{"volunteer": user_name}, {"volunteer_phone": user_phone}]
            tasks = list(donations_collection.find({"$or": q_or}).sort("created_at", -1))
            completed = 0
            for t in tasks:
                t['_id'] = str(t['_id'])
                if isinstance(t.get('created_at'), datetime):
                    t['created_at'] = t['created_at'].isoformat()
                if t.get('status') == 'Delivered':
                    completed += 1
                activity_records.append(t)

            kpis = {
                "assigned_pickups": len(tasks),
                "completed_deliveries": completed,
                "active_tasks": len(tasks) - completed
            }

        elif user_role == 'manufacturer':
            intakes = list(waste_intake_col.find().sort("created_at", -1))
            total_claimed_kg = 0.0
            for w in intakes:
                w['_id'] = str(w['_id'])
                if w.get('status') == 'Claimed for Processing':
                    total_claimed_kg += float(w.get('quantity_kg') or 0)
                activity_records.append(w)

            batches_count = mfg_batches_col.count_documents({})
            inventory_count = mfg_inventory_col.count_documents({})

            kpis = {
                "waste_consignments": len(intakes),
                "total_claimed_kg": round(total_claimed_kg, 1),
                "active_batches": batches_count,
                "inventory_products": inventory_count
            }

        elif user_role == 'admin':
            kpis = {
                "privilege": "Full Platform Master Control",
                "security_level": "Super Administrator"
            }

        return jsonify({
            "success": True,
            "user": user,
            "kpis": kpis,
            "activity_records": activity_records
        }), 200
    except Exception as e:
        print("Admin get individual user error:", e)
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/admin/users/<user_id>', methods=['DELETE'])
def remove_suspicious_user(user_id):
    """
    Remove a suspicious user from the platform database with security checks and audit logging.
    """
    try:
        from bson.objectid import ObjectId
        query_id = ObjectId(user_id) if (len(str(user_id)) == 24 and ObjectId.is_valid(str(user_id))) else str(user_id)
        
        user = users_collection.find_one({"_id": query_id})
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404

        # Security check: Never allow deleting an admin
        if user.get('role') == 'admin' or user.get('email') == 'admin@jivahar.com':
            return jsonify({"success": False, "message": "Security Alert: Platform Administrator accounts cannot be deleted."}), 403

        user_name = user.get('name', 'User')
        user_email = user.get('email', '')
        user_role = user.get('role', 'user')

        # Record audit log
        admin_audit_logs.insert_one({
            "action": "USER_REMOVAL",
            "target_user_id": str(query_id),
            "target_name": user_name,
            "target_email": user_email,
            "target_role": user_role,
            "reason": "Administrative suspension / suspicious activity removal",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

        # Remove user
        users_collection.delete_one({"_id": query_id})

        # If donor, cancel any pending donations
        if user_role == 'donor':
            donations_collection.update_many(
                {"$or": [{"donor_id": query_id}, {"donor_id": str(query_id)}], "status": "Pending"},
                {"$set": {"status": "Cancelled (Donor Account Removed)"}}
            )

        return jsonify({
            "success": True,
            "message": f"Suspicious user '{user_name}' ({user_email}) has been permanently removed from the system."
        }), 200
    except Exception as e:
        print("Admin delete user error:", e)
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/admin/donations', methods=['GET'])
def get_all_donations_for_admin():
    """List all platform donations for admin oversight"""
    try:
        donations = list(donations_collection.find().sort("created_at", -1))
        for d in donations:
            d['_id'] = str(d['_id'])
            d['donor_id'] = str(d.get('donor_id', ''))
            if isinstance(d.get('created_at'), datetime):
                d['created_at'] = d['created_at'].isoformat()
        return jsonify({"success": True, "donations": donations}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/admin/audit-logs', methods=['GET'])
def get_admin_audit_logs():
    """Retrieve platform administrative security & audit logs"""
    try:
        logs = list(admin_audit_logs.find().sort("timestamp", -1).limit(50))
        for l in logs:
            l['_id'] = str(l['_id'])
        return jsonify({"success": True, "logs": logs}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

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
            ngo_doc = users_collection.find_one({"_id": query_id})
            admin_audit_logs.insert_one({
                "action": "NGO_APPROVAL",
                "target_user_id": str(query_id),
                "target_name": ngo_doc.get('name', 'NGO') if ngo_doc else 'NGO',
                "target_email": ngo_doc.get('email', '') if ngo_doc else '',
                "target_role": "ngo",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            return jsonify({"success": True, "message": "NGO approved successfully! Account is now active."}), 200
        else:
            return jsonify({"success": False, "message": "NGO not found or already approved."}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400

@app.route('/api/admin/chat', methods=['POST'])
def admin_chat_ai():
    """
    Local Ollama LLM Admin Assistant Chatbot.
    Answers administrator queries regarding live database platform statistics,
    user profiles, donation histories, food edibility, and recycling streams.
    """
    try:
        data = request.json or {}
        user_message = (data.get('message') or data.get('question') or '').strip()
        if not user_message:
            return jsonify({"success": False, "message": "No query message provided."}), 400

        # 1. Fetch live ground-truth data from MongoDB
        users = list(users_collection.find({}, {'password': 0}))
        donations = list(donations_collection.find())
        
        # 2. Compute aggregated metrics
        donors = [u for u in users if u.get('role') == 'donor']
        ngos = [u for u in users if u.get('role') == 'ngo']
        pending_ngos = [u for u in users if u.get('role') == 'ngo' and not u.get('approved', False)]
        volunteers = [u for u in users if u.get('role') == 'volunteer']
        manufacturers = [u for u in users if u.get('role') == 'manufacturer']
        admins = [u for u in users if u.get('role') == 'admin']

        total_donations = len(donations)
        active_donations = len([d for d in donations if d.get('status') in ['Pending', 'Accepted', 'Assigned', 'In Transit']])
        delivered_donations = len([d for d in donations if d.get('status') == 'Delivered'])
        recycled_donations = len([d for d in donations if 'Recycled' in str(d.get('status')) or 'Manufacturer' in str(d.get('status'))])
        cancelled_donations = len([d for d in donations if d.get('status') == 'Cancelled'])

        meals_saved = 0
        total_waste_recycled_kg = 0.0

        for d in donations:
            status = d.get('status', '')
            items = d.get('items', [])
            for it in items:
                try:
                    qty = float(it.get('quantity', 0))
                except (ValueError, TypeError):
                    qty = 0.0
                edibility = it.get('edibility') or {}
                is_edible = edibility.get('is_edible', True)
                if status == 'Delivered' and is_edible:
                    meals_saved += int(qty)
                elif 'Recycled' in status or 'Manufacturer' in status or not is_edible:
                    total_waste_recycled_kg += qty

        # User summary lines
        user_lines = []
        for u in users:
            role = (u.get('role') or 'user').capitalize()
            uid_str = str(u['_id'])
            u_donations = [d for d in donations if str(d.get('donor_id')) == uid_str]
            is_approved = u.get('approved', True)
            approval_status = "Approved & Verified" if is_approved else "Pending Admin Approval"
            activity_str = ""
            if role == "Donor":
                activity_str = f" | {len(u_donations)} donations initiated"
            elif role == "Ngo":
                activity_str = f" | Verification: {approval_status}"
            elif role == "Volunteer":
                activity_str = " | Verification: Verified Field Delivery Volunteer"
            elif role == "Manufacturer":
                activity_str = " | Verification: Verified Waste Processing Partner"
            
            user_lines.append(
                f"- Name: {u.get('name', 'User')} | Role: {role} | Email: {u.get('email', '')} | Phone: {u.get('phone', 'N/A')}{activity_str}"
            )

        # Recent donations summary lines (up to 5)
        recent_don_lines = []
        for d in sorted(donations, key=lambda x: str(x.get('created_at', '')), reverse=True)[:5]:
            d_id = str(d.get('_id', ''))[-6:]
            donor_user = next((u for u in users if str(u['_id']) == str(d.get('donor_id'))), None)
            d_name = donor_user.get('name', 'Donor') if donor_user else 'Donor'
            item_names = [it.get('name', 'Item') for it in d.get('items', [])]
            items_str = ", ".join(item_names) if item_names else "Food"
            recent_don_lines.append(f"- #{d_id}: by {d_name} ({items_str}) - Status: {d.get('status', 'Pending')}")

        pending_ngo_text = f"{len(pending_ngos)} pending verification" if len(pending_ngos) > 0 else "None (0 pending; all registered NGOs are verified)"

        context_str = f"""=== LIVE PLATFORM STATISTICS ===
- Total Users: {len(users)} (Donors: {len(donors)}, NGOs: {len(ngos)}, Volunteers: {len(volunteers)}, Manufacturers: {len(manufacturers)}, Admins: {len(admins)})
- Pending NGO Verifications: {pending_ngo_text}
- Total Donations: {total_donations}
  * Active/Pending: {active_donations}
  * Delivered (Meals Saved): {delivered_donations} ({meals_saved} meals saved)
  * Recycled to Bio-Fertilizer: {recycled_donations} ({total_waste_recycled_kg} kg recycled)
  * Cancelled: {cancelled_donations}

=== REGISTERED USERS LIST ===
{chr(10).join(user_lines)}

=== RECENT DONATION ACTIVITIES ===
{chr(10).join(recent_don_lines)}
"""

        prompt = f"""You are the Jivahar Internal Admin Dashboard Assistant. You help the system administrator analyze platform operations, food donations, waste recycling metrics, and partner accounts based on the database summary below:

{context_str}

ADMIN QUESTION: {user_message}

INSTRUCTIONS:
- Answer accurately and concisely based on the metrics and accounts in the directory above.
- Mention role, platform status, and donation/recycling activity when asked about an account.
- Use clear bullet points and bold text. Keep your answer under 3-4 sentences."""

        reply = None
        try:
            # Query Ollama with 25s timeout and concise 140 tokens limit
            raw_reply = call_ollama_llm(prompt, format_json=False, timeout=25, max_tokens=140)
            if raw_reply and raw_reply.strip():
                clean_raw = raw_reply.strip()
                # Check for refusal heuristics
                if not any(r in clean_raw.lower() for r in ["i can't help", "i cannot help", "i'm sorry, but i can't"]):
                    reply = clean_raw
        except Exception as o_err:
            print("Ollama admin chatbot exception:", o_err)

        # Fallback intelligent rule-based generation if Ollama is slow/offline
        if not reply:
            q_lower = user_message.lower()
            if any(k in q_lower for k in ['stat', 'overview', 'summary', 'total', 'count', 'metric']):
                reply = (
                    f"**Platform Overview Statistics:**\n\n"
                    f"- **Total Registered Users:** {len(users)} ({len(donors)} Donors, {len(ngos)} NGOs, {len(volunteers)} Volunteers, {len(manufacturers)} Manufacturers, {len(admins)} Admin)\n"
                    f"- **Total Donations:** {total_donations} ({active_donations} Active, {delivered_donations} Delivered, {recycled_donations} Recycled, {cancelled_donations} Cancelled)\n"
                    f"- **Community Impact:** {meals_saved} meals saved for hungry communities\n"
                    f"- **Waste Diverted:** {total_waste_recycled_kg} kg organic waste sent for bio-fertilizer conversion\n"
                    f"- **Pending NGO Verifications:** {len(pending_ngos)}"
                )
            elif any(k in q_lower for k in ['donor', 'puneeth']):
                donor_names = ", ".join([f"**{d.get('name')}** ({d.get('email')}, {d.get('phone')})" for d in donors]) or "None"
                reply = (
                    f"**Donors Information:**\n\n"
                    f"- There are currently **{len(donors)} registered donor(s)**: {donor_names}.\n"
                    f"- Donors have initiated **{total_donations} donations** across the platform."
                )
            elif any(k in q_lower for k in ['ngo', 'nithin', 'pending']):
                pending_names = ", ".join([n.get('name') for n in pending_ngos]) or "None"
                reply = (
                    f"**NGO Partners Information:**\n\n"
                    f"- **Total Registered NGOs:** {len(ngos)}\n"
                    f"- **Pending Approvals:** {len(pending_ngos)} ({pending_names})\n"
                    f"- Verified NGOs can claim and distribute edible surplus food locally."
                )
            elif any(k in q_lower for k in ['recycle', 'waste', 'manufacturer', 'vaishnav', 'fertilizer']):
                reply = (
                    f"**Recycling & Manufacturer Information:**\n\n"
                    f"- **Recycled Food Waste:** **{total_waste_recycled_kg} kg** diverted from landfills.\n"
                    f"- **Recycled Consignments:** {recycled_donations} batches claimed by certified bio-fertilizer manufacturers.\n"
                    f"- **Active Manufacturers:** {len(manufacturers)} (e.g., Vaishnav - vaishnav@gmail.com)."
                )
            elif any(k in q_lower for k in ['volunteer', 'obedulla', 'delivery']):
                v_names = ", ".join([f"**{v.get('name')}** ({v.get('email')}, {v.get('phone')})" for v in volunteers]) or "None"
                reply = (
                    f"**Volunteer Delivery Network:**\n\n"
                    f"- **Total Volunteers:** {len(volunteers)} ({v_names})\n"
                    f"- Volunteers assist in transporting surplus edible food from donors to NGOs."
                )
            else:
                matched_user = None
                for u in users:
                    if u.get('name', '').lower() in q_lower or u.get('email', '').lower() in q_lower:
                        matched_user = u
                        break
                if matched_user:
                    reply = (
                        f"**User Record: {matched_user.get('name')}**\n\n"
                        f"- **Role:** {matched_user.get('role', 'user').upper()}\n"
                        f"- **Email:** {matched_user.get('email', 'N/A')}\n"
                        f"- **Phone:** {matched_user.get('phone', 'N/A')}\n"
                        f"- **Status:** {'Verified / Approved' if matched_user.get('approved', True) else 'Pending Verification'}"
                    )
                else:
                    reply = (
                        f"I have reviewed the live platform database. We currently have **{len(users)} registered users** "
                        f"and **{total_donations} donations** recorded. Let me know if you would like details on specific donors, "
                        f"NGO partners, recycling metrics, or individual user records."
                    )

        return jsonify({
            "success": True,
            "reply": reply,
            "model": OLLAMA_MODEL
        }), 200

    except Exception as e:
        print("Error in admin_chat_ai:", e)
        return jsonify({"success": False, "message": str(e)}), 500

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
        ngo_id_filter = request.args.get('ngo_id')
        donations = list(donations_collection.find().sort("created_at", -1))
        filtered_donations = []
        for d in donations:
            evaluate_cascade_status(d)
            d['_id'] = str(d['_id'])
            if 'donor_id' in d:
                d['donor_id'] = str(d['donor_id'])
            if 'created_at' in d and hasattr(d['created_at'], 'isoformat'):
                d['created_at'] = d['created_at'].isoformat()
            
            # Ensure rejected_by is cleanly populated as string array
            rejected_by = [str(r) for r in d.get('rejected_by', [])]
            d['rejected_by'] = rejected_by

            # If an NGO ID is specified, filter out donations that this NGO has passed or rejected
            if ngo_id_filter and (str(ngo_id_filter) in rejected_by or any(h.get('action') == 'ngo_rejected' and str(h.get('ngo_id')) == str(ngo_id_filter) for h in d.get('notification_cascade', {}).get('history', []))):
                continue
            
            filtered_donations.append(d)

        return jsonify({"success": True, "donations": filtered_donations}), 200
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

        don_id = ObjectId(donation_id) if (len(str(donation_id)) == 24 and ObjectId.is_valid(str(donation_id))) else str(donation_id)
        donation = donations_collection.find_one({"_id": don_id})

        if not donation:
            return jsonify({"success": False, "message": "Donation not found"}), 404

        cascade = donation.get('notification_cascade', {})
        ordered_ngos = cascade.get('ordered_ngos', [])

        # If ordered_ngos is missing, construct from approved NGOs
        if not ordered_ngos:
            donor_lat = donation.get('pickup_location', {}).get('latitude') or donation.get('pickup_details', {}).get('lat')
            donor_lng = donation.get('pickup_location', {}).get('longitude') or donation.get('pickup_details', {}).get('lng')
            approved_ngos = list(users_collection.find({"role": "ngo", "approved": True}))
            idx = 0
            for ngo in approved_ngos:
                idx += 1
                n_lat = ngo.get('lat') or ngo.get('location', {}).get('latitude') or (15.1511 + idx * 0.005)
                n_lng = ngo.get('lng') or ngo.get('location', {}).get('longitude') or (76.9062 + idx * 0.005)
                d_km = calculate_distance_km(donor_lat or 15.1511, donor_lng or 76.9062, n_lat, n_lng)
                ordered_ngos.append({
                    "id": str(ngo.get('_id')),
                    "name": ngo.get('name', 'Registered NGO'),
                    "email": ngo.get('email', ''),
                    "phone": ngo.get('phone', ''),
                    "distance_km": round(d_km, 2)
                })
            ordered_ngos.sort(key=lambda x: x['distance_km'])

        rejected_by = [str(r) for r in donation.get('rejected_by', [])]
        if ngo_id and str(ngo_id) not in rejected_by:
            rejected_by.append(str(ngo_id))

        # Find the next nearest NGO from ordered_ngos that has NOT rejected
        next_ngo = None
        for cand in ordered_ngos:
            if str(cand.get('id')) not in rejected_by:
                next_ngo = cand
                break

        now_str = datetime.now(timezone.utc).isoformat()
        history = cascade.get('history', [])
        history.append({
            "action": "ngo_rejected",
            "ngo_id": str(ngo_id) if ngo_id else '',
            "reason": reason,
            "timestamp": now_str
        })

        if next_ngo:
            currently_notified = [next_ngo]
            next_tier = 1 if next_ngo['distance_km'] <= 15.0 else 2
            next_radius = f"{next_ngo['distance_km']} km"
            history.append({
                "action": "cascaded_to_next_nearest",
                "notified_at": now_str,
                "ngo": next_ngo,
                "reason": f"Sequentially cascaded after rejection by previous NGO ({reason})"
            })
            msg = f"Donation passed and sequentially routed to next nearest NGO: {next_ngo['name']} ({next_ngo['distance_km']} km away)."
        else:
            currently_notified = []
            next_tier = 2
            next_radius = "All NGOs Passed"
            history.append({
                "action": "all_ngos_rejected",
                "timestamp": now_str,
                "reason": "All registered NGOs within proximity have reviewed and passed on this donation."
            })
            msg = "Donation passed. All registered NGOs in proximity have reviewed this donation."

        update_ops = {
            "$set": {
                "notification_cascade.ordered_ngos": ordered_ngos,
                "notification_cascade.currently_notified": currently_notified,
                "notification_cascade.active_tier": next_tier,
                "notification_cascade.active_radius": next_radius,
                "notification_cascade.history": history,
                "rejected_by": rejected_by
            }
        }

        donations_collection.update_one({"_id": don_id}, update_ops)

        return jsonify({
            "success": True,
            "message": msg,
            "next_ngo": next_ngo,
            "currently_notified": currently_notified
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

# ==========================================================
# Manufacturer & Fertilizer Recycling Collections & APIs
# ==========================================================
mfg_batches_col = db['manufacturer_batches']
mfg_inventory_col = db['manufacturer_inventory']
waste_intake_col = db['waste_intakes']
fertilizer_orders_col = db['fertilizer_orders']
mfg_notifications_col = db['manufacturer_notifications']

def sync_existing_non_edible_donations():
    """Sync any existing non-edible donations into waste intake and notify manufacturer in real-time"""
    try:
        donations = list(donations_collection.find())
        for d in donations:
            don_id_str = str(d['_id'])
            items = d.get('items', [])
            non_edible_items = []
            for item in items:
                edibility = item.get('edibility')
                is_edible = True
                if isinstance(edibility, dict):
                    is_edible = edibility.get('is_edible', True)
                elif edibility is False:
                    is_edible = False
                if not is_edible:
                    non_edible_items.append(item)
                    
            if non_edible_items:
                existing = waste_intake_col.find_one({"donation_id": don_id_str})
                if not existing:
                    total_qty = sum(float(it.get('quantity', 0)) for it in non_edible_items)
                    names = [it.get('name', 'Cooked Food') for it in non_edible_items]
                    reasons = "; ".join([it.get('edibility', {}).get('reason', '') for it in non_edible_items if isinstance(it.get('edibility'), dict) and it.get('edibility', {}).get('reason')])
                    unit = non_edible_items[0].get('unit', 'kg')
                    loc = d.get('pickup_location', {}).get('address') or d.get('pickup_details', {}).get('address') or 'Bengaluru Central'
                    
                    created_at_val = d.get('created_at')
                    if isinstance(created_at_val, datetime):
                        created_at_str = created_at_val.isoformat()
                    else:
                        created_at_str = str(created_at_val or datetime.now(timezone.utc).isoformat())

                    waste_doc = {
                        "source": f"Donor Donation #{don_id_str[-6:].upper()}",
                        "source_type": "Surplus Inedible Food Donation",
                        "donation_id": don_id_str,
                        "donor_id": str(d.get('donor_id', '')),
                        "waste_type": f"Inedible {', '.join(names)}",
                        "quantity_kg": total_qty,
                        "unit": unit,
                        "moisture_level": "Medium (55%)",
                        "shelf_life_note": reasons or "Exceeded safe consumption shelf life (AI evaluated)",
                        "location": loc,
                        "status": "Available",
                        "created_at": created_at_str
                    }
                    waste_intake_col.insert_one(waste_doc)

                    # Create Notification
                    mfg_notifications_col.insert_one({
                        "title": "New Inedible Food Consignment Directed",
                        "message": f"{total_qty} {unit} of {', '.join(names)} flagged as inedible and directed to your bio-fertilizer facility for recycling.",
                        "source": waste_doc['source'],
                        "location": loc,
                        "waste_type": waste_doc['waste_type'],
                        "quantity_kg": total_qty,
                        "donation_id": don_id_str,
                        "read": False,
                        "created_at": created_at_str
                    })
    except Exception as e:
        print("Notice syncing non-edible donations:", e)

# One-time sync of any un-routed non-edible donations
sync_existing_non_edible_donations()

@app.route('/api/manufacturer/stats', methods=['GET'])
def get_manufacturer_stats():
    """Retrieve real-time operational KPIs for the Fertilizer Manufacturer"""
    try:
        total_waste = 0
        for w in waste_intake_col.find():
            total_waste += float(w.get('quantity_kg', 0))
            
        active_batches = mfg_batches_col.count_documents({"stage": {"$ne": "Completed"}})
        
        total_fertilizer = 0
        for p in mfg_inventory_col.find():
            total_fertilizer += float(p.get('stock_kg', 0))
            
        carbon_offset = round(total_waste * 1.5, 1) # ~1.5 kg CO2e saved per kg waste diverted from landfill
        
        return jsonify({
            "success": True,
            "total_waste_kg": round(total_waste, 1),
            "active_batches": active_batches,
            "ready_fertilizer_kg": round(total_fertilizer, 1),
            "carbon_offset_kg": carbon_offset
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/manufacturer/waste-inflow', methods=['GET'])
def get_waste_inflow():
    """List real-time incoming organic waste streams"""
    try:
        streams = list(waste_intake_col.find().sort("created_at", -1))
        for s in streams:
            s['_id'] = str(s['_id'])
        return jsonify({"success": True, "waste_streams": streams}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/manufacturer/notifications', methods=['GET'])
def get_manufacturer_notifications():
    """Get real-time notification alerts for manufacturer"""
    try:
        notifs = list(mfg_notifications_col.find().sort("created_at", -1))
        unread_count = 0
        for n in notifs:
            n['_id'] = str(n['_id'])
            if not n.get('read', False):
                unread_count += 1
        return jsonify({
            "success": True,
            "notifications": notifs,
            "unread_count": unread_count
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/manufacturer/notifications/mark-read', methods=['POST'])
def mark_manufacturer_notifications_read():
    """Mark all manufacturer notifications as read"""
    try:
        mfg_notifications_col.update_many({}, {"$set": {"read": True}})
        return jsonify({"success": True, "message": "All notifications marked as read"}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/manufacturer/waste-inflow/claim', methods=['POST'])
def claim_waste_stream():
    """Claim an organic waste stream for composting intake"""
    try:
        data = request.json or {}
        stream_id = data.get('stream_id')
        if not stream_id:
            return jsonify({"success": False, "message": "Missing stream_id"}), 400
            
        intake = waste_intake_col.find_one({"_id": ObjectId(stream_id)})
        if not intake:
            return jsonify({"success": False, "message": "Consignment not found"}), 404

        waste_intake_col.update_one(
            {"_id": ObjectId(stream_id)},
            {"$set": {"status": "Claimed for Processing"}}
        )

        don_id = intake.get('donation_id')
        if don_id:
            try:
                donations_collection.update_one(
                    {"_id": ObjectId(don_id)},
                    {"$set": {"status": "Recycled / Manufacturer Intake"}}
                )
            except Exception:
                pass
            
        return jsonify({"success": True, "message": "Waste consignment successfully claimed!"}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/manufacturer/waste-inflow/log', methods=['POST'])
def log_waste_intake():
    """Manually log a newly arrived organic waste delivery"""
    try:
        data = request.json or {}
        source = (data.get('source') or 'Local Vendor').strip()
        waste_type = (data.get('waste_type') or 'Mixed Organic Waste').strip()
        quantity_kg = float(data.get('quantity_kg') or 100)
        moisture = data.get('moisture_level', 'Medium (55%)')
        location = (data.get('location') or 'Facility Gate').strip()
        note = (data.get('shelf_life_note') or 'Organic leftovers diverted for bio-fertilizer production').strip()
        
        doc = {
            "source": source,
            "source_type": "Direct Consignment",
            "waste_type": waste_type,
            "quantity_kg": quantity_kg,
            "moisture_level": moisture,
            "shelf_life_note": note,
            "location": location,
            "status": "Available",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        res = waste_intake_col.insert_one(doc)
        doc['_id'] = str(res.inserted_id)
        return jsonify({"success": True, "message": "Consignment logged successfully!", "consignment": doc}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/manufacturer/batches', methods=['GET', 'POST'])
def handle_batches():
    """Retrieve or create composting / bio-fermentation batches"""
    try:
        if request.method == 'POST':
            data = request.json or {}
            product_name = (data.get('product_name') or 'Enriched Bio-Compost').strip()
            input_waste = (data.get('input_waste') or 'Mixed Organic Food Waste').strip()
            weight_kg = float(data.get('weight_kg') or 500)
            inoculant = (data.get('inoculant') or 'Trichoderma & EM Consortium').strip()
            total_days = int(data.get('day_total') or 28)
            
            # Generate batch code
            count = mfg_batches_col.count_documents({}) + 101
            batch_code = f"BATCH-JIV-{count}"
            
            new_batch = {
                "batch_code": batch_code,
                "product_name": product_name,
                "input_waste": input_waste,
                "weight_kg": weight_kg,
                "stage": "Shredding",
                "day_current": 1,
                "day_total": total_days,
                "temperature_c": 30,
                "moisture_pct": 55,
                "inoculant": inoculant,
                "status": "In Progress",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            res = mfg_batches_col.insert_one(new_batch)
            new_batch['_id'] = str(res.inserted_id)
            return jsonify({"success": True, "message": "New composting batch initiated!", "batch": new_batch}), 201
            
        batches = list(mfg_batches_col.find().sort("created_at", -1))
        for b in batches:
            b['_id'] = str(b['_id'])
        return jsonify({"success": True, "batches": batches}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/manufacturer/batches/<batch_id>/stage', methods=['PUT'])
def update_batch_stage(batch_id):
    """Advance or update the composting stage of a batch"""
    try:
        data = request.json or {}
        new_stage = data.get('stage')
        if not new_stage:
            return jsonify({"success": False, "message": "Missing stage"}), 400
            
        update_fields = {"stage": new_stage}
        if new_stage == "Active Composting":
            update_fields["temperature_c"] = 55
            update_fields["day_current"] = 12
        elif new_stage == "Curing":
            update_fields["temperature_c"] = 38
            update_fields["day_current"] = 22
        elif new_stage == "Completed":
            update_fields["temperature_c"] = 26
            update_fields["day_current"] = 28
            update_fields["status"] = "Completed"
            update_fields["lab_cert"] = f"FCO-CERT-{batch_id[-4:].upper()}"
            update_fields["npk_ratio"] = "3.6 - 2.1 - 2.4"
            
        mfg_batches_col.update_one({"_id": ObjectId(batch_id)}, {"$set": update_fields})
        return jsonify({"success": True, "message": f"Batch moved to {new_stage}!"}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/manufacturer/inventory', methods=['GET', 'POST'])
def handle_inventory():
    """Retrieve or add finished bio-fertilizer inventory"""
    try:
        if request.method == 'POST':
            data = request.json or {}
            name = (data.get('name') or 'Bio-Compost').strip()
            cat = (data.get('category') or 'Solid Fertilizer').strip()
            stock_kg = float(data.get('stock_kg') or 500)
            packaging = (data.get('packaging') or '50 kg Bags').strip()
            price = float(data.get('price_inr') or 400)
            npk = (data.get('npk_ratio') or '3.5 - 2.0 - 2.2').strip()
            
            prod = {
                "name": name,
                "category": cat,
                "stock_kg": stock_kg,
                "packaging": packaging,
                "price_inr": price,
                "unit": "per bag",
                "npk_ratio": npk,
                "ph_level": 7.1,
                "moisture_pct": 20,
                "lab_status": "FCO Certified Grade A",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            res = mfg_inventory_col.insert_one(prod)
            prod['_id'] = str(res.inserted_id)
            return jsonify({"success": True, "message": "Product added to inventory!", "product": prod}), 201
            
        prods = list(mfg_inventory_col.find())
        for p in prods:
            p['_id'] = str(p['_id'])
        return jsonify({"success": True, "inventory": prods}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/manufacturer/orders', methods=['GET', 'POST'])
def handle_orders():
    """Retrieve or create farmer orders for bio-fertilizer"""
    try:
        if request.method == 'POST':
            data = request.json or {}
            buyer = (data.get('buyer_name') or 'Farmer').strip()
            phone = (data.get('contact_phone') or '+91 98000 00000').strip()
            loc = (data.get('location') or 'Local Farm').strip()
            item = (data.get('item_name') or 'Bio-Compost').strip()
            qty = (data.get('quantity') or '500 kg').strip()
            amt = float(data.get('amount_inr') or 4500)
            
            order_id = f"ORD-AGRI-{fertilizer_orders_col.count_documents({}) + 804}"
            order = {
                "order_id": order_id,
                "buyer_name": buyer,
                "contact_phone": phone,
                "location": loc,
                "item_name": item,
                "quantity": qty,
                "amount_inr": amt,
                "status": "Approved",
                "date": datetime.now(timezone.utc).strftime("%d %b %Y")
            }
            res = fertilizer_orders_col.insert_one(order)
            order['_id'] = str(res.inserted_id)
            return jsonify({"success": True, "message": "Order created successfully!", "order": order}), 201
            
        orders = list(fertilizer_orders_col.find().sort("date", -1))
        for o in orders:
            o['_id'] = str(o['_id'])
        return jsonify({"success": True, "orders": orders}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/manufacturer/orders/<order_id>/status', methods=['PUT'])
def update_order_status(order_id):
    """Update order fulfillment status (Approved -> Dispatched -> Delivered)"""
    try:
        data = request.json or {}
        new_status = data.get('status')
        if not new_status:
            return jsonify({"success": False, "message": "Missing status"}), 400
            
        fertilizer_orders_col.update_one({"_id": ObjectId(order_id)}, {"$set": {"status": new_status}})
        return jsonify({"success": True, "message": f"Order status updated to {new_status}!"}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/ai/compost-recommendation', methods=['POST'])
def ai_compost_recommendation():
    """
    Ollama AI Composting Specialist formulation recommendation
    given organic waste mix, quantity, and moisture level.
    """
    try:
        data = request.json or {}
        waste_type = (data.get('waste_type') or 'Cooked Food & Vegetable Scraps').strip()
        weight_kg = float(data.get('weight_kg') or 500)
        moisture = data.get('moisture_level', 'Medium (55%)')
        
        prompt = (
            f"You are Jivahar Organic Fertilizer Specialist AI. A manufacturer is composting {weight_kg}kg of "
            f"'{waste_type}' with moisture level '{moisture}'. "
            f"Return a clean JSON object with keys: "
            f"'c_n_balance' (one sentence on what brown carbon materials like dry leaves or sawdust are needed to balance C:N ratio), "
            f"'inoculant' (recommended microbial culture like Trichoderma, Azotobacter, or EM solution), "
            f"'days_required' (integer between 21 and 35), "
            f"'expected_npk' (estimated NPK ratio string like '3.5 - 2.0 - 2.2'), "
            f"'recipe_summary' (two sentences describing the ideal composting procedure and aeration schedule)."
        )
        
        raw_res = call_ollama_llm(prompt, format_json=True, timeout=7, max_tokens=90)
        rec = None
        if raw_res:
            try:
                import json
                rec = json.loads(raw_res)
            except Exception:
                pass
                
        if not rec:
            # Fallback formulation
            rec = {
                "c_n_balance": f"Add ~{round(weight_kg * 0.4)}kg of dry carbon materials (sawdust, crushed dry leaves, or shredded bagasse) to achieve an optimal C:N ratio of 30:1.",
                "inoculant": "Trichoderma Viride & Effective Microorganisms (EM-1) Solution",
                "days_required": 28,
                "expected_npk": "3.5 - 2.2 - 2.5 (Enriched Bio-Compost)",
                "recipe_summary": "Pre-shred food waste, mix with carbon bulking agent, and maintain pile moisture at 55%. Turn windrow every 4 days to ensure aerobic conditions and sustain thermophilic temperatures above 55°C."
            }
            
        return jsonify({
            "success": True,
            "waste_type": waste_type,
            "weight_kg": weight_kg,
            "recommendation": rec,
            "model_used": OLLAMA_MODEL
        }), 200
    except Exception as e:
        print("Compost recommendation error:", e)
        return jsonify({"success": False, "message": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)