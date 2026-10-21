# Jivahar Architecture & Technical Design

## 1. High-Level Architectural Overview

Jivahar is built as a modular, event-driven web application with a Flask REST API backend, MongoDB document store, deep learning vision models, local LLM integrations, and modern responsive frontend clients.

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT LAYER                                      |
|  - Donor Portal (donor.html + donor.js)                                           |
|  - NGO Command Center (ngo.html + ngo.js)                                         |
|  - Manufacturer Hub (manufacturer.html + manufacturer.js)                         |
|  - Volunteer Logistics (volunteer.html + volunteer.js)                            |
|  - Admin Dashboard (admin.html + admin.js)                                        |
+-----------------------------------------------------------------------------------+
                                        |  RESTful JSON & Static Assets
                                        v
+-----------------------------------------------------------------------------------+
|                                BACKEND API LAYER                                  |
|  - Flask Application Server (app.py)                                              |
|  - Authentication & Role Gatekeeper (Werkzeug Security)                           |
|  - Proximity Geo-Dispatch & Sequential Cascade Engine                             |
|  - Status Lifecycle Controller (Pending -> Accepted -> Picked Up -> Delivered)    |
|  - Composting Batch & Inventory Processor                                         |
+-----------------------------------------------------------------------------------+
             |                                       |
             v                                       v
+-----------------------------+     +-----------------------------------------------+
|       AI & ML ENGINES       |     |                 STORAGE LAYER                 |
| - YOLOv8 Food Recognition   |     | - MongoDB ('jivahar' database)                |
| - Automated Freshness/Shelf |     |   * users                                     |
| - Local Ollama LLM Chatbot  |     |   * donations                                 |
| - AI Compost Formulation    |     |   * waste_intakes                             |
+-----------------------------+     |   * manufacturer_batches                      |
                                    |   * manufacturer_inventory                    |
                                    |   * fertilizer_orders                         |
                                    |   * manufacturer_notifications                |
                                    |   * admin_audit_logs                          |
                                    +-----------------------------------------------+
```

---

## 2. Deep Learning Vision Pipeline

1. **Image Ingestion**: Donor captures or uploads food image (`multipart/form-data` or base64 JSON).
2. **YOLO Model Execution**: Fine-tuned weights (`models/best.pt`) run inference on image tensor.
3. **Multi-Item Bounding Boxes**: Detects multiple distinct foods in one photo (e.g. Rice + Dal + Roti).
4. **Non-Food Filter**: Validates class identities and confidence thresholds (>= 0.35). Non-food images are flagged and rejected.
5. **Freshness & Shelf-Life Heuristics**: Analyzes visual quality and safe consumption hours based on food classification. Flags item as edible or non-edible.

---

## 3. Geospatial Dispatch & Proximity Cascade

1. **Distance Calculation**: Donor pickup coordinates are evaluated against all approved NGOs using the Haversine formula:
   $$\text{dist} = 2 R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta \text{lon}}{2}\right)}\right)$$
2. **Sorting**: Approved NGOs are sorted ascending by proximity.
3. **Single Nearest Notification**: The nearest NGO is notified exclusively. The rest remain in queue.
4. **Sequential Cascade**: If the nearest NGO passes or rejects, the next nearest NGO in `ordered_ngos` receives the urgent notification.
5. **Manufacturer Rerouting**: If food is non-edible, it completely bypasses NGOs and is routed straight to `waste_intakes` for bio-fertilizer manufacturing.
