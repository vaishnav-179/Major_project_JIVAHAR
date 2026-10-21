# Jivahar RESTful API Reference Guide

Base URL: `http://127.0.0.1:5000/api`

## 1. Authentication & Users
- `POST /api/register`: Register new user (`name`, `email`, `phone`, `password`, `role`).
- `POST /api/login`: Authenticate user (`email`, `password`, `role`).
- `POST /api/auth/set-location`: Configure physical base coordinates (`user_id`, `lat`, `lng`, `address`).

## 2. AI Vision & Prediction
- `POST /api/ai/detect-food`: Multi-item YOLO food recognition.
- `POST /api/ai/analyze-shelf-life`: Freshness & safe consumption window assessment.
- `POST /api/ai/donation-summary`: Concise AI donation quality overview.
- `POST /api/ai/compost-recommendation`: Optimal compost recipe and C:N balancing.

## 3. Donations & Dispatch Lifecycle
- `POST /api/donations`: Create new surplus food donation.
- `GET /api/donations/all`: Retrieve live feed of donations. Supports `?ngo_id=<id>`.
- `GET /api/donations/<donor_id>`: Retrieve donations submitted by a specific donor.
- `GET /api/donations/stats/<donor_id>`: Metrics (total donations, weight kg, meals served).
- `POST /api/donations/accept/<id>`: NGO accepts donation claim.
- `POST /api/donations/reject/<id>`: NGO rejects/passes donation -> triggers sequential cascade.
- `POST /api/donations/update-status/<id>`: Move claim status (`Picked Up`, `Delivered`).
- `POST /api/donations/cancel/<id>`: Donor cancels active donation.
- `GET /api/ngos`: Retrieve list of all approved NGOs with locations.

## 4. Bio-Fertilizer Manufacturer
- `GET /api/manufacturer/stats`: Production statistics & inventory metrics.
- `GET /api/manufacturer/waste-inflow`: Inbound non-edible food waste consignments.
- `POST /api/manufacturer/waste-inflow/claim`: Claim waste consignment for processing.
- `POST /api/manufacturer/waste-inflow/log`: Manually log organic waste arrival.
- `GET /api/manufacturer/batches`: List composting batches.
- `POST /api/manufacturer/batches`: Create a new composting batch.
- `PUT /api/manufacturer/batches/<id>/stage`: Advance batch production stage.
- `GET /api/manufacturer/inventory`: Packaged fertilizer inventory.
- `POST /api/manufacturer/inventory`: Update stock levels.
- `GET /api/manufacturer/orders`: Farmer and retail fertilizer orders.
- `POST /api/manufacturer/orders`: Create fertilizer order.
- `PUT /api/manufacturer/orders/<id>/status`: Update order fulfillment status.

## 5. Admin Governance & Ollama AI Chatbot
- `GET /api/admin/stats`: Real-time system analytics.
- `GET /api/admin/users`: User management list with individual metrics.
- `GET /api/admin/users/<id>`: User profile details.
- `DELETE /api/admin/users/<id>`: Suspend/remove user account.
- `GET /api/admin/donations`: Global donation audit feed.
- `GET /api/admin/audit-logs`: Immutable log of administrative actions.
- `GET /api/admin/ngos/pending`: List pending NGO applications.
- `POST /api/admin/ngos/approve/<id>`: Approve pending NGO.
- `POST /api/admin/chat`: Local Ollama LLM assistant with live database context.
