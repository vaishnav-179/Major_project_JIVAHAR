# Jivahar – Autonomous AI-Powered Zero Food Waste & Bio-Fertilizer Circular Ecosystem

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.3%2B-black.svg?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0%2B-green.svg?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![YOLO](https://img.shields.io/badge/YOLO-v8%2F26n-red.svg?logo=ultralytics&logoColor=white)](https://ultralytics.com/)
[![Ollama](https://img.shields.io/badge/Ollama-Local_LLM-orange.svg?logo=ollama&logoColor=white)](https://ollama.ai/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-brightgreen.svg?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

---

## 📌 Executive Summary

**Jivahar** is an intelligent, full-stack, closed-loop food rescue and organic recycling platform designed to eradicate food waste and combat hunger. By pairing deep learning computer vision (custom YOLO object detection and automated edibility scoring) with intelligent geospatial routing, Jivahar dynamically partitions surplus food at the point of donation:

1. **Edible Surplus Food** &rarr; Dispatched to the **single nearest verified NGO** via a priority proximity cascade. If that NGO passes or rejects, the system sequentially and automatically cascades the notification to the **next nearest NGO**. Upon acceptance, volunteer couriers are dispatched via shortest-route OSRM navigation to deliver meals to community shelters.
2. **Inedible / Expired Food** &rarr; Automatically flagged by AI and directly rerouted to **Bio-Fertilizer Manufacturers**, completely bypassing human consumption to prevent foodborne illness while diverting organic waste from landfills into commercial-grade bio-fertilizer for local agriculture.
3. **Administrator Oversight & Local LLM Assistant** &rarr; Administrators monitor real-time platform statistics, manage users, approve NGOs, and interact with an integrated **local Ollama LLM chatbot** injected with live MongoDB ground truth.

---

## 🏗️ System Architecture & Circular Flow

```
                                      ┌────────────────────────┐
                                      │   FOOD DONOR PORTAL    │
                                      │ (Restaurants/Caterers) │
                                      └───────────┬────────────┘
                                                  │
                                     Uploads Photo + Pickup Pin
                                                  │
                                                  ▼
                                      ┌────────────────────────┐
                                      │   AI ANALYSIS ENGINE   │
                                      │  • YOLO Multi-Item     │
                                      │  • Non-Food Filter     │
                                      │  • Edibility / Expiry  │
                                      └───────────┬────────────┘
                                                  │
                        ┌─────────────────────────┴─────────────────────────┐
                        │                                                   │
                [IS EDIBLE: TRUE]                                  [IS EDIBLE: FALSE]
                        │                                                   │
                        ▼                                                   ▼
         ┌──────────────────────────────┐                   ┌──────────────────────────────┐
         │   GEOSPATIAL DISPATCH HUB    │                   │   BIO-FERTILIZER HUB         │
         │  • Haversine Distance Calc   │                   │ (Organic Recycling Facility) │
         │  • Sort Approved NGOs        │                   └──────────────┬───────────────┘
         └──────────────┬───────────────┘                                  │
                        │                                       Incoming Waste Intake Consignment
             Notifies Nearest NGO Only                                     │
                        │                                                  ▼
                        ▼                                   ┌──────────────────────────────┐
         ┌──────────────────────────────┐                   │ MULTI-STAGE RECYCLING BATCH  │
         │     NEAREST NGO PORTAL       │                   │  1. Waste Intake             │
         │  • Audio Chime & Bell Badge  │                   │  2. Aerobic Composting       │
         │  • Live Radar Map + OSRM     │                   │  3. Curing & Maturation      │
         └───────┬──────────────┬───────┘                   │  4. Granulation & Drying     │
                 │              │                           │  5. Packaging (50kg bags)    │
            [ACCEPTS]       [REJECTS/PASSES]                └──────────────┬───────────────┘
                 │              │                                          │
                 │              ▼                                          ▼
                 │   ┌───────────────────────────┐          ┌──────────────────────────────┐
                 │   │ SEQUENTIAL CASCADE ENGINE │          │ FERTILIZER INVENTORY & ORDERS│
                 │   │ Routes to Next-Nearest NGO│          │  • Local Farmers & Retailers │
                 │   └───────────────────────────┘          │  • Methane & Landfill Offset │
                 │                                          └──────────────────────────────┘
                 ▼
         ┌──────────────────────────────┐
         │    VOLUNTEER PICKUP HUB      │
         │  • Shortest Route Navigation │
         │  • Picked Up -> Delivered    │
         └──────────────┬───────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │      COMMUNITY SHELTERS      │
         │   Verified Meals Delivered   │
         └──────────────────────────────┘
```

---

## 🚀 Key Modules & Functional Capabilities

### 1. 🍽️ Donor Portal (`donor.html` & `js/donor.js`)
- **AI Food Detection & Multi-Item Recognition**: Donors upload photos of surplus food. The backend YOLO model detects bounding boxes, counts multiple distinct food items (e.g., Rice, Curry, Bread), extracts quantities, and rejects non-food images.
- **Automated Edibility & Freshness Assessment**: Assesses cooked food shelf life based on preparation time, food category, and visual freshness. Flags items as safe or non-edible.
- **Interactive GPS Pickup Pinpoint**: Integrated Leaflet.js map with reverse geocoding via OpenStreetMap/Nominatim to accurately lock pickup latitude/longitude.
- **"My Donations" Management Suite**:
  - Live full-text search across item names, claim IDs, and pickup locations.
  - Multi-status filter tabs (`All`, `Pending`, `Accepted`, `Picked Up`, `Delivered`, `Directed to Manufacturer`).
  - Date period filters (`All Time`, `Today`, `Last 7 Days`, `This Month`).
  - Pagination controls (5, 10, 20 items per page).
  - Dynamic KPI recalculation for Total Donations, Rescued Weight (kg), Total Items, and Impacted Lives.
  - One-click CSV audit report export and printable donation statement generation.

---

### 2. 🏢 NGO Command Center (`ngo.html` & `js/ngo.js`)
- **Single Nearest NGO Notification Rule**: When edible food is posted, the system evaluates all approved NGOs and dispatches the alert **exclusively to the nearest NGO**.
- **Sequential Next-Nearest Cascade**: If the nearest NGO passes or rejects due to capacity or logistics, the notification immediately cascades to the next nearest NGO.
- **Audio-Visual Real-Time Alerts**:
  - Web Audio API harmonic two-tone chime (`playNotificationChime()`) triggers on incoming alerts without external audio file dependencies.
  - Animated ringing topbar bell badge (`#incomingBadgeCount`) and responsive dropdown list (`#incomingDropdownList`) with 1-click **Accept** and **Pass** actions.
- **Lifecycle Claims & Delivery Tracking**:
  - Displays claimed pickups in "My Requests".
  - Interactive status transition buttons: `Accepted` &rarr; `Mark Picked Up` &rarr; `Mark Delivered` via `/api/donations/update-status/<id>`.
  - Direct click-to-call donor integration.
- **Interactive Surplus Radar Map**:
  - Fixed NGO Base HQ building marker.
  - Concentric radar rings: Tier 1 Priority Zone (15 km) and Tier 2 Cascade Zone (25 km).
  - Shortest driving route lines with animated courier markers via OSRM.
- **Impact & Verified Audit PDF Reports**:
  - Aggregates rescued meals, rescued weight (kg), landfill CO₂ offset, and active donors.
  - Generates official, printable audit certificates formatted for stakeholder and CSR reporting.

---

### 3. 🏭 Bio-Fertilizer Manufacturer Hub (`manufacturer.html` & `js/manufacturer.js`)
- **Automated Inedible Food Diversion**: Any donor food items classified as inedible or expired by the AI model are automatically directed to manufacturer facilities.
- **Waste Intake Stream**: Real-time intake ledger displaying incoming food waste consignments with source donor details, quantity, moisture level, and shelf-life notes.
- **Multi-Stage Composting Pipeline**:
  - Full batch lifecycle management: `Waste Intake` &rarr; `Active Composting` &rarr; `Curing / Maturation` &rarr; `Granulation & Drying` &rarr; `Quality Packaging` &rarr; `Ready for Dispatch`.
  - Quality metrics tracking: Temperature (°C), Moisture (%), C:N ratio, and pH.
- **Stock Inventory & Farmer Order Processing**:
  - Real-time inventory of 50kg organic fertilizer bags.
  - Order fulfillment workflow for local farmers, nurseries, and retail agricultural buyers.
- **Environmental Impact Analytics**: Methane gas prevention metrics, landfill diversion tonnage, and commercial fertilizer production stats.

---

### 4. 🚴 Volunteer Logistics Hub (`volunteer.html` & `js/volunteer.js`)
- **Active Pickup Dispatch**: Real-time task board displaying accepted donations awaiting physical pickup.
- **Live Route Navigation**: OSRM road driving routing showing turn-by-turn distance and estimated transit time from donor location to NGO center.
- **Status Updates**: Couriers update pickup milestones (`Picked Up`, `In Transit`, `Delivered`).

---

### 5. 🛡️ Admin Command Dashboard & AI Chatbot (`admin.html` & `js/admin.js`)
- **Platform Analytics**: Live overview of total donors, approved NGOs, active volunteers, registered manufacturers, total food rescued (kg), and community meals served.
- **NGO Verification & Approval**: Pending NGO applications review interface with 1-click account verification and approval (`/api/admin/ngos/approve/<id>`).
- **User Governance & Suspension**: Search, filter, inspect individual user activity statistics, and suspend/delete suspicious accounts with audit trail logging.
- **Local Ollama LLM Assistant (`/api/admin/chat`)**:
  - Embedded AI assistant for administrators.
  - Queries local Ollama instance (`http://localhost:11434`) using models such as `llama3` or `mistral`.
  - Injects live MongoDB ground truth directly into the prompt context, allowing the administrator to ask natural language questions such as:
    - *"How many meals were delivered this week?"*
    - *"Which NGO is currently nearest to Ballari center?"*
    - *"List all suspended users and their registered email addresses."*
    - *"What is our total organic bio-fertilizer inventory?"*

---

## 🛠️ Technology Stack

| Domain | Technology / Library | Purpose |
| :--- | :--- | :--- |
| **Backend Server** | Python 3.10+, Flask 2.3+ | RESTful API server, routing, authentication, business logic |
| **Database** | MongoDB 6.0+, PyMongo, BSON | High-performance document database for users, donations, batches |
| **Object Detection** | Ultralytics YOLOv8 / YOLO26n, PyTorch | Multi-item food detection, bounding box extraction, non-food rejection |
| **Local LLM Chatbot**| Ollama REST API (Llama 3 / Mistral) | Administrative conversational intelligence with live database context |
| **Mapping & GIS** | Leaflet.js 1.9.4, OpenStreetMap | Interactive visual maps, custom markers, radar circles |
| **Routing Engine** | OSRM (Open Source Routing Machine) | Driving route computation, route polylines, transit time estimation |
| **Reverse Geocoding**| Nominatim (OSM API) | Reverse geocoding of map coordinates to physical street addresses |
| **Audio Synthesizer**| HTML5 Web Audio API | Harmonic two-tone synthesized alert chimes (zero asset overhead) |
| **Frontend UI** | HTML5, CSS3, ES6+ JavaScript | Responsive layout, glassmorphic styling, Font Awesome 6.4 |

---

## 🗄️ Database Architecture (MongoDB Collections)

The application uses the `jivahar` database in MongoDB with the following collections:

### 1. `users`
```json
{
  "_id": ObjectId("..."),
  "name": "Nithin",
  "email": "nithin@gmail.com",
  "phone": "9876543210",
  "password": "scrypt:32768:8:1$...",
  "role": "ngo", // "donor" | "ngo" | "volunteer" | "manufacturer" | "admin"
  "approved": true,
  "is_location_set": true,
  "lat": 15.1511,
  "lng": 76.9062,
  "address": "Gandhi Nagar, Ballari, Karnataka",
  "location": {
    "address": "Gandhi Nagar, Ballari, Karnataka",
    "latitude": 15.1511,
    "longitude": 76.9062
  }
}
```

### 2. `donations`
```json
{
  "_id": ObjectId("..."),
  "donor_id": ObjectId("..."),
  "items": [
    {
      "name": "Paneer Biryani & Rice",
      "category": "Cooked Food",
      "quantity": 15,
      "unit": "kg",
      "edibility": {
        "is_edible": true,
        "score": 0.95,
        "reason": "Freshly prepared, safe within 6-hour window"
      }
    }
  ],
  "pickup_location": {
    "address": "Patel Nagar, Ballari, Karnataka",
    "latitude": 15.1500,
    "longitude": 76.9050
  },
  "pickup_details": {
    "address": "Patel Nagar, Ballari, Karnataka",
    "lat": 15.1500,
    "lng": 76.9050,
    "contact_name": "Ramesh Kumar",
    "contact_phone": "9876543210"
  },
  "status": "Pending", // "Pending" | "Accepted" | "Picked Up" | "Delivered" | "Cancelled" | "Directed to Manufacturer"
  "assigned_ngo": {
    "id": "6ad7a5466cc6e3af5c1afdd9",
    "name": "Care Relief Foundation",
    "phone": "9876543211",
    "accepted_at": "2026-10-20T17:30:00Z"
  },
  "notification_cascade": {
    "active_tier": 1,
    "active_radius": "0.19 km",
    "ordered_ngos": [
      { "id": "6acbb6769d286a7d661b2475", "name": "Nithin", "distance_km": 0.19 },
      { "id": "6ad7a5466cc6e3af5c1afdd9", "name": "Care Relief Foundation", "distance_km": 1.93 },
      { "id": "6ad7a5466cc6e3af5c1afdda", "name": "Akshaya Seva Samiti", "distance_km": 4.25 }
    ],
    "currently_notified": [
      { "id": "6acbb6769d286a7d661b2475", "name": "Nithin", "distance_km": 0.19 }
    ],
    "history": [
      { "action": "initial_nearest_notification", "tier": 1, "notified_at": "..." },
      { "action": "ngo_rejected", "ngo_id": "6acbb6769d286a7d661b2475", "reason": "Full capacity" },
      { "action": "cascaded_to_next_nearest", "to_ngo": "Care Relief Foundation" }
    ]
  },
  "rejected_by": ["6acbb6769d286a7d661b2475"],
  "created_at": "2026-10-20T17:28:00Z"
}
```

### 3. `waste_intakes`
```json
{
  "_id": ObjectId("..."),
  "source": "Donor Donation #F2A09B",
  "source_type": "Surplus Inedible Food Donation",
  "donation_id": "6ad7a8e46383e9b0074af2a0",
  "donor_id": "67b66d782782d46e2fb95b71",
  "waste_type": "Inedible Spoiled Gravy & Rice",
  "quantity_kg": 35.0,
  "unit": "kg",
  "moisture_level": "Medium (55%)",
  "shelf_life_note": "Exceeded safe consumption shelf life (AI evaluated)",
  "location": "Main Road, Ballari",
  "status": "Available", // "Available" | "Claimed" | "In Composting"
  "created_at": "2026-10-20T17:35:00Z"
}
```

### 4. `manufacturer_batches`
```json
{
  "_id": ObjectId("..."),
  "batch_code": "BIO-BATCH-2026-004",
  "intake_ids": ["6ad7a8e46383e9b0074af2a0"],
  "stage": "Active Composting", // "Waste Intake" | "Active Composting" | "Curing" | "Granulation" | "Packaging" | "Ready"
  "total_waste_kg": 250.0,
  "output_fertilizer_bags": 12,
  "temperature_c": 58.5,
  "moisture_percent": 50,
  "cn_ratio": "28:1",
  "ph_level": 7.2,
  "started_at": "2026-10-18T10:00:00Z",
  "updated_at": "2026-10-20T12:00:00Z"
}
```

### 5. `manufacturer_inventory`, `fertilizer_orders`, `manufacturer_notifications`, `admin_audit_logs`
- Manage fertilizer bag stock, farmer orders, delivery statuses, instant waste arrival notifications, and platform governance logs.

---

## 📡 RESTful API Documentation

### 🤖 1. AI Vision, Detection & Shelf Life
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/ai/detect-food` | Upload image for YOLO multi-item food recognition and non-food validation |
| `POST` | `/api/ai/analyze-shelf-life` | Evaluate food freshness, safe consumption window, and edibility status |
| `POST` | `/api/ai/donation-summary` | Generate natural language nutritional and safety summary of items |
| `POST` | `/api/ai/compost-recommendation`| AI recommendation for optimal compost additives (sawdust, moisture, aeration) |

### 🔐 2. Authentication & Profile
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/register` | Register new user account with role specification |
| `POST` | `/api/login` | Authenticate user credentials and check NGO approval verification |
| `POST` | `/api/auth/set-location` | Set fixed HQ / physical service location coordinates on Leaflet map |

### 🍲 3. Donation Lifecycle & Proximity Dispatch
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/donations` | Create food donation; routes edible food to nearest NGO, inedible to manufacturer |
| `GET` | `/api/donations/all` | Get donations feed with optional `?ngo_id=<id>` exclusion of rejected items |
| `GET` | `/api/donations/<donor_id>` | Get all donations created by a specific donor |
| `GET` | `/api/donations/stats/<donor_id>` | Aggregate donor statistics (total donations, weight in kg, lives impacted) |
| `POST` | `/api/donations/cancel/<id>` | Cancel active donation listing |
| `POST` | `/api/donations/accept/<id>` | Accept donation claim (assigned to current NGO) |
| `POST` | `/api/donations/reject/<id>` | Pass/reject donation &rarr; sequentially forwards to next nearest NGO |
| `POST` | `/api/donations/update-status/<id>` | Update claim status to `Picked Up` or `Delivered` |
| `GET` | `/api/ngos` | Retrieve list of all approved NGOs with geographic coordinates |

### 🏭 4. Manufacturer & Bio-Fertilizer Circular Pipeline
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/manufacturer/stats` | Manufacturing KPIs (waste recycled, batches, bags in stock, CO₂ offset) |
| `GET` | `/api/manufacturer/waste-inflow` | List of non-edible organic food waste consignments available for pickup |
| `POST` | `/api/manufacturer/waste-inflow/claim` | Claim an incoming waste consignment for facility intake |
| `POST` | `/api/manufacturer/waste-inflow/log` | Manually log organic waste arrival |
| `GET` | `/api/manufacturer/batches` | Retrieve all active and completed composting batches |
| `POST` | `/api/manufacturer/batches` | Create a new fertilizer production batch |
| `PUT` | `/api/manufacturer/batches/<id>/stage` | Advance batch production stage (`Composting` &rarr; `Curing` &rarr; `Granulation` &rarr; `Packaging`) |
| `GET` | `/api/manufacturer/inventory` | Retrieve stock levels of packaged fertilizer bags |
| `POST` | `/api/manufacturer/inventory` | Update stock levels and warehouse allocations |
| `GET` | `/api/manufacturer/orders` | Retrieve farmer and retail purchase orders |
| `POST` | `/api/manufacturer/orders` | Create new purchase order for bio-fertilizer bags |
| `PUT` | `/api/manufacturer/orders/<id>/status`| Update order status (`Pending` &rarr; `Dispatched` &rarr; `Delivered`) |
| `GET` | `/api/manufacturer/notifications` | Fetch unread manufacturer waste routing alerts |
| `POST` | `/api/manufacturer/notifications/mark-read` | Mark manufacturer notifications as read |

### 🛡️ 5. Admin Governance & Local LLM Assistant
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/stats` | Comprehensive platform-wide metrics and KPIs |
| `GET` | `/api/admin/users` | List all registered users across all roles with individual activity stats |
| `GET` | `/api/admin/users/<id>` | Deep-dive profile for a specific user |
| `DELETE` | `/api/admin/users/<id>` | Suspend or remove suspicious user accounts |
| `GET` | `/api/admin/donations` | Global feed of all platform donations |
| `GET` | `/api/admin/audit-logs` | Immutable audit trail of administrative actions |
| `GET` | `/api/admin/ngos/pending` | Fetch pending NGO verification applications |
| `POST` | `/api/admin/ngos/approve/<id>` | Approve pending NGO application |
| `POST` | `/api/admin/chat` | Query local Ollama LLM with live ground-truth database context |

---

## 💻 Installation & Setup Guide

### 1. Prerequisites
- **Python**: Version `3.10` or higher installed.
- **MongoDB Community Server**: Version `6.0` or higher running on `localhost:27017`.
- **Ollama**: Installed from [ollama.ai](https://ollama.ai/) with your preferred local model pulled (e.g. `ollama pull llama3` or `ollama pull mistral`).

---

### 2. Environment Setup & Python Dependencies
Navigate to the project root and create a virtual environment:
```bash
# Clone or navigate into directory
cd "c:\Users\VAISHNAV\Desktop\PROJECTS\MAJOR PROJECT UI\JIV0102 (2)\JIV0102"

# Create virtual environment (optional but recommended)
python -m venv venv
venv\Scripts\activate

# Install required Python packages
pip install flask flask-cors pymongo werkzeug ultralytics torch torchvision pillow requests
```

---

### 3. Start MongoDB
Ensure MongoDB is running locally:
```bash
# Windows service check / start
net start MongoDB
# Or run manually:
mongod --dbpath "C:\data\db"
```

---

### 4. Start Ollama (for Admin Local LLM Chatbot)
Ensure Ollama is running and has the model pulled:
```bash
# In a terminal window:
ollama run llama3
```
*Note: If Ollama is offline, the Admin Chatbot returns a graceful offline message while all other administrative and platform features continue operating normally.*

---

### 5. Verify YOLO Model Weights
Ensure the YOLO weights exist at the designated path:
```
models/best.pt
```
*The Flask application automatically detects and initializes the model upon startup.*

---

### 6. Initialize & Seed Database
Run the seeding script to create default administrator accounts and clean up any legacy mock records:
```bash
python seed_db.py
```

---

### 7. Run Flask Application
Start the Flask backend server on port `5000`:
```bash
python app.py
```
Expected output:
```
Connected to MongoDB successfully at mongodb://localhost:27017/
YOLO food detection model loaded successfully from .../best.pt
 * Serving Flask app 'app'
 * Running on http://127.0.0.1:5000
```

---

## 👥 Pre-Configured Test Accounts

All roles are seeded and verified with location coordinates in Ballari, Karnataka for immediate testing:

| Role | Name | Email | Password | Location / Coordinates |
| :--- | :--- | :--- | :--- | :--- |
| **Administrator** | Platform Administrator | `admin@jivahar.com` | `admin123` | Platform HQ |
| **Food Donor** | Puneeth | `puneeth@gmail.com` | `123456` | Patel Nagar (`15.1500, 76.9050`) |
| **NGO #1 (Nearest)** | Nithin | `nithin@gmail.com` | `123456` | Ballari Center (`15.1511, 76.9062` ~0.11 km) |
| **NGO #2 (Cascade 1)**| Care Relief Foundation | `care@jivahar.org` | `123456` | Car Street (`15.1620, 76.9180` ~1.85 km) |
| **NGO #3 (Cascade 2)**| Akshaya Seva Samiti | `seva@jivahar.org` | `123456` | Cantonment (`15.1780, 76.9320` ~4.25 km) |
| **Volunteer** | Obedulla | `obedulla@gmail.com` | `123456` | Ballari Logistics Hub |
| **Manufacturer** | Vaishnav | `vaishnav@gmail.com` | `123456` | Bio-Fertilizer Plant (`15.1400, 76.8900`) |

---

## 🌐 Web Application Portals

Open your browser and access the respective portals:

- 🏠 **Landing Page**: [`http://127.0.0.1:5000/index.html`](http://127.0.0.1:5000/index.html)
- 🍲 **Donor Portal**: [`http://127.0.0.1:5000/donor.html`](http://127.0.0.1:5000/donor.html) *(Login: [`login-donor.html`](http://127.0.0.1:5000/login-donor.html))*
- 🏢 **NGO Command Center**: [`http://127.0.0.1:5000/ngo.html`](http://127.0.0.1:5000/ngo.html) *(Login: [`login-ngo.html`](http://127.0.0.1:5000/login-ngo.html))*
- 🏭 **Manufacturer Facility**: [`http://127.0.0.1:5000/manufacturer.html`](http://127.0.0.1:5000/manufacturer.html) *(Login: [`login-manufacturer.html`](http://127.0.0.1:5000/login-manufacturer.html))*
- 🚴 **Volunteer Dispatch**: [`http://127.0.0.1:5000/volunteer.html`](http://127.0.0.1:5000/volunteer.html) *(Login: [`login-volunteer.html`](http://127.0.0.1:5000/login-volunteer.html))*
- 🛡️ **Admin Dashboard**: [`http://127.0.0.1:5000/admin.html`](http://127.0.0.1:5000/admin.html) *(Login: [`login-admin.html`](http://127.0.0.1:5000/login-admin.html))*

---

## 🧪 Step-by-Step Verification Scenarios

### Scenario A: Edible Food Donation & Sequential Cascade
1. Log in as Donor (`puneeth@gmail.com`).
2. Post a donation with cooked edible items (e.g., 20 kg Rice). Set pickup location in Ballari.
3. System calculates proximity: **NGO #1 (Nithin)** is 0.11 km away (nearest).
4. Log in as NGO #1 (`nithin@gmail.com`). The audio chime sounds, the topbar bell badge pulses red (`1`), and the donation appears under **Urgent Incoming Offers**.
5. NGO #1 clicks **Pass / Reject** (Reason: "Out of capacity").
6. The card immediately disappears from NGO #1's dashboard.
7. Backend sequentially routes the offer to **NGO #2 (Care Relief Foundation)** (1.85 km away).
8. Log in as NGO #2 (`care@jivahar.org`). The donation appears with notification badge and chime.
9. NGO #2 clicks **Accept Donation**.
10. The donation moves to **My Pickup Requests**. NGO #2 clicks **Mark Picked Up**, then **Mark Delivered**.

---

### Scenario B: Inedible Food & Automated Manufacturer Recycling
1. Log in as Donor (`puneeth@gmail.com`).
2. Post food flagged by AI as expired or inedible.
3. Backend sets status to `"Directed to Manufacturer (Inedible Food Waste)"` and creates records in `waste_intakes` and `manufacturer_notifications`.
4. Log in as Manufacturer (`vaishnav@gmail.com`).
5. Real-time notification sounds and waste consignment appears under **Incoming Waste Intakes**.
6. Manufacturer claims the intake, logs it into a new composting batch, advances batch through stages (`Composting` &rarr; `Curing` &rarr; `Granulation` &rarr; `Packaging`), and packages it into inventory bags.

---

### Scenario C: Admin Governance & Local LLM Assistant
1. Log in as Admin (`admin@jivahar.com` / `admin123`).
2. View real-time database cards: Total Donors, Approved NGOs, Active Pickups, Total Rescued kg.
3. Open the **Admin AI Chatbot** drawer in the bottom right corner.
4. Type: *"Give me a summary of our current platform statistics and active NGOs."*
5. The local Ollama LLM reads live database context and returns an accurate, natural language summary.

---

## 📂 Project Directory Structure

```
JIV0102/
├── app.py                      # Core Flask API server, routes, AI model loader, Ollama bridge
├── requirements.txt            # Python dependencies (Flask, PyMongo, Ultralytics, Torch, etc.)
├── seed_db.py                  # Database initialization entrypoint wrapper
├── README.md                   # Complete A-Z project documentation
├── .gitignore                  # Git tracking exclusion rules
│
├── css/                        # Global and portal stylesheets
│   ├── style.css               # Landing page, auth forms, responsive grid, animations
│   └── dashboard.css           # Portal dashboard layouts, sidebar, tables, status badges
│
├── js/                         # Frontend client logic and module controllers
│   ├── admin.js                # Admin analytics, user governance, audit logs, Ollama AI chat
│   ├── auth.js                 # Role-based authentication, real-time input validation, redirects
│   ├── donation.js             # Shared donation API client methods and helpers
│   ├── donor.js                # AI upload, YOLO multi-item recognition, search/filters, CSV export
│   ├── manufacturer.js         # Waste intake claims, composting batch progression, orders
│   ├── map-components.js       # Leaflet pin markers, geocoding & route drawing utilities
│   ├── ngo.js                  # Nearest NGO cascade, audio chime, radar maps, claims lifecycle
│   ├── script.js               # Landing page & API client helper
│   └── volunteer.js            # Courier task dispatch, OSRM shortest-path routing
│
├── assets/                     # UI graphics, illustrations, brand logos, icons
│
├── models/                     # AI & Machine Learning models
│   ├── best.pt                 # Fine-tuned YOLO food detection model weights (14 classes)
│   └── yolo26n.pt              # Base YOLO model weights
│
├── scripts/                    # Database seeding and migration utilities
│   └── seed_db.py              # MongoDB seeder script
│
├── docs/                       # Project documentation & architectural specs
│   ├── ARCHITECTURE.md         # Deep-dive system architecture, vision pipeline & data flow
│   └── API_REFERENCE.md        # Comprehensive RESTful API endpoint specifications
│
├── training/                   # Model training datasets, annotations & scripts
│   ├── dataset/                # Train and test image sets with YOLO format annotations (data.yaml)
│   ├── scripts/                # train.py, evaluate.py, predict.py, validate_dataset.py
│   ├── requirements.txt        # Training dependencies
│   └── README.md               # Training documentation
│
├── index.html                  # Public landing page with portal directory
├── donor.html                  # Donor food listing portal & "My Donations" dashboard
├── ngo.html                    # NGO Command Center with radar map & cascade alerts
├── manufacturer.html           # Bio-Fertilizer recycling facility & batch management
├── volunteer.html              # Volunteer courier routing & task dispatch board
├── admin.html                  # Admin governance dashboard & local LLM chatbot
│
├── login-donor.html            # Donor login & multi-step registration interface
├── login-ngo.html              # NGO login & registration interface (with admin approval check)
├── login-manufacturer.html     # Manufacturer login & registration interface
├── login-volunteer.html        # Volunteer login & registration interface
└── login-admin.html            # Administrator login interface
```

---

## ❓ Frequently Asked Questions (FAQ) & Troubleshooting

#### 1. Why is the NGO not receiving notifications?
- Ensure the NGO account is approved (`approved: true` in MongoDB). Pending NGOs must be approved by the Admin in `admin.html`.
- Verify the NGO has set its headquarters base location. An initial location setup modal prompts if `is_location_set` is `false`.
- Ensure the food item is marked as edible. Inedible food items are automatically routed to the **Manufacturer**, not to NGOs.
- Verify whether another NGO was closer to the donor. The system strictly notifies the **single nearest NGO** first.

#### 2. What if Ollama is not installed or running?
- The platform functions completely without Ollama. If Ollama is offline, the Admin AI chat drawer displays a clean notification: *"Ollama service is currently offline. Please ensure Ollama is running on port 11434."* All database analytics, user management, and approval workflows operate independently.

#### 3. How are non-food images rejected?
- The YOLO model confidence score threshold coupled with classification heuristics in `detect_food_yolo()` rejects images with no identifiable food classes or confidence below 0.35, prompting the donor to upload a clear image of edible food.

---

## 📜 License & Acknowledgments

This project is licensed under the **MIT License**.

- **OpenStreetMap** & **Nominatim** for map tile services and geocoding.
- **Project OSRM** for open-source road network routing.
- **Ultralytics** for YOLO deep learning vision frameworks.
- **Ollama Project** for local open-weights language model execution.
