# Jivahar - Food Redistribution & Donation Platform

Jivahar is a web-based platform designed to bridge the gap between excess food donors (restaurants, events, food manufacturers, individuals) and recipient organisations (NGOs, shelters, volunteers). Featuring intelligent location-based matching, real-time donation cascading, admin verification, and volunteer pickup dispatch, Jivahar ensures timely food delivery and reduces food wastage.

---

## 🚀 Active Execution Status

- **Flask Backend API**: `http://127.0.0.1:5000` (Status: **RUNNING**)
- **Frontend Server**: `http://127.0.0.1:8000` (Status: **RUNNING**)
- **Database**: MongoDB `mongodb://localhost:27017/` (Database: `jivahar`)

---

## ✨ Multi-Role Registration & Approval Workflow

1. **Donor Registration**:
   - Register via `login-donor.html`.
   - Account activated automatically -> access `donor.html`.
2. **NGO Registration & Admin Notification**:
   - Register via `login-ngo.html`.
   - NGO account initialized as `approved: False` (Pending Admin Review).
   - **Admin Notification Alert**: Admin panel (`admin.html`) displays real-time pending NGO registration alert banner and header badge counter.
   - **Admin Approval**: Admin reviews and approves NGO application with 1-click (`/api/admin/ngos/approve/<id>`).
   - Approved NGO logs in successfully and accesses `ngo.html`.
3. **Volunteer Registration**:
   - Register via `login-volunteer.html`.
   - Access `volunteer.html` to manage food collection, pickup routes, and delivery status updates.

---

## 🔄 Step-by-Step Action Execution Sequence

```
[Donor] Registers & Logs in  ➡️  Posts Food Surplus (Status: Pending)
                                         │
                                         ▼
[Admin] Gets NGO Alert      ➡️  Approves Registered NGO Account
                                         │
                                         ▼
[NGO] Logs in               ➡️  Receives Food Alert & Accepts (Status: Accepted)
                                         │
                                         ▼
[Volunteer] Task Board      ➡️  Marks "Start Pickup" (Status: Picked Up)
                                         │
                                         ▼
[Volunteer] Doorstep        ➡️  Marks "Complete Delivery" (Status: Delivered)
```

---

## 📁 Project Structure

```
JIV0102/
├── app.py                      # Flask backend API server (Port 5000)
├── seed_db.py                  # Database seeding script
├── index.html                  # Main landing page
├── donor.html                  # Donor portal & food posting dashboard
├── ngo.html                    # NGO portal for viewing & claiming food donations
├── admin.html                  # Admin management & NGO approval dashboard
├── volunteer.html              # Volunteer task dispatch & delivery hub
├── login-donor.html            # Donor login/register
├── login-ngo.html              # NGO login/register
├── login-admin.html            # Admin login
├── login-volunteer.html        # Volunteer login/register
├── login-manufacturer.html     # Manufacturer login
├── style.css                   # Main application styling
├── dashboard.css               # Portal layout styles
├── js/
│   ├── auth.js                 # Authentication & role routing
│   ├── donor.js                # Donor portal logic
│   ├── ngo.js                  # NGO dashboard & cascade alerts
│   ├── admin.js                # Admin notification & approval logic
│   ├── volunteer.js            # Volunteer pickup & delivery tracking
│   ├── donation.js             # Donation API helper routines
│   └── map-components.js       # Geo-location Leaflet map integrations
└── assets/                     # Visual graphics & assets
```

---

## ⚙️ How to Run & Access Portals

### Access Web Portals
- **Landing Page**: [http://127.0.0.1:8000/index.html](http://127.0.0.1:8000/index.html)
- **Donor Portal**: [http://127.0.0.1:8000/login-donor.html](http://127.0.0.1:8000/login-donor.html)
- **NGO Portal**: [http://127.0.0.1:8000/login-ngo.html](http://127.0.0.1:8000/login-ngo.html)
- **Admin Panel**: [http://127.0.0.1:8000/login-admin.html](http://127.0.0.1:8000/login-admin.html)
- **Volunteer Hub**: [http://127.0.0.1:8000/login-volunteer.html](http://127.0.0.1:8000/login-volunteer.html)

---

## 🔌 Core API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/register` | Register new user (Donor, NGO, Volunteer, Admin) |
| `POST` | `/api/login` | User authentication & approval verification |
| `GET` | `/api/admin/ngos/pending` | Fetch pending NGO applications |
| `POST` | `/api/admin/ngos/approve/<id>` | Approve NGO account (Admin action) |
| `POST` | `/api/donations` | Create food donation (Donor action) |
| `GET` | `/api/donations/all` | Fetch available food donations (NGO/Volunteer action) |
| `POST` | `/api/donations/accept/<id>` | Accept food donation (NGO action) |
| `POST` | `/api/donations/update-status/<id>` | Update status to `Picked Up` or `Delivered` (Volunteer action) |
