# YOLO26 Multi-Food Object Detection Pipeline

This repository contains a complete, modular, and reproducible YOLO26-based object detection pipeline for detecting and classifying 14 distinct food classes from combined Edge Impulse datasets (`food images 2` and `food images 3`).

The model is built to detect multiple food items in a single image independently, draw bounding boxes, classify each item, and report its confidence score.

---

## 1. Supported Food Classes (14 Classes)
0. **bananna**
1. **chapathi**
2. **chilli**
3. **chutney**
4. **colored rice**
5. **dosa**
6. **holige**
7. **idli**
8. **laddu**
9. **puri**
10. **rice**
11. **upma**
12. **vada**
13. **vermicelli upma**

---

## 2. Project Directory Structure

```text
food_yolo/
├── dataset/                  # Unified dataset in standard YOLO format
│   ├── images/               # Folders with images (.jpg)
│   │   ├── train/            # 90% (577 images)
│   │   └── test/             # 10% (65 images)
│   ├── labels/               # Folders with normalized labels (.txt)
│   │   ├── train/
│   │   └── test/
│   └── data.yaml             # YOLO dataset configuration (14 classes)
│
├── scripts/
│   ├── convert_dataset_3.py  # Merges food images 2 & 3, fixes EXIF, scales images, 90/10 split
│   ├── validate_dataset.py   # Sanity checks on labels and images
│   ├── visualize_labels.py   # Visualizes training bounding boxes
│   ├── train.py              # Finetuning pretrained YOLO26n
│   ├── evaluate.py           # Evaluate best model on test set with dynamic class mapping
│   └── predict.py            # Inference script for single image or folder predictions
│
├── runs/                     # Log directory for training (weights, loss plots)
│   └── yolo26n_baseline/     # Model weights (best.pt, last.pt) and metrics
├── outputs/
│   ├── visualizations/       # Overlay of ground truth training labels
│   └── predictions/          # Model inference visual outputs
│
├── requirements.txt          # Python dependencies
└── README.md                 # Project documentation
```

---

## 3. Dataset Preprocessing & Validation

1. **Dataset Integration**:
   - Merged 96 images from `food images 2` and 546 images from `food images 3`.
   - Applied EXIF auto-transposition (`ImageOps.exif_transpose`) to prevent bounding-box rotation mismatch from mobile cameras.
   - Pre-scaled high-resolution photos to max 800px dimension, yielding a **52.8x CPU dataloading speedup**.
   - 90% train (577 images) / 10% test (65 images) random split.
2. **Sanity Verification**:
   - `validate_dataset.py` confirmed 0 corrupted images, 0 missing labels, 0 invalid bounding boxes.

---

## 4. Model Training & Test Performance

- **Architecture**: Ultralytics YOLO26n (2.4M parameters, 5.3 GFLOPs)
- **Trained**: 48 epochs on CPU (EarlyStopping patience=15, best model at epoch 33)
- **Checkpoint**: `food_yolo/runs/yolo26n_baseline/weights/best.pt`

### Overall Test Metrics (65 Images, 126 Objects)
* **Precision**: `0.7043` (70.4%)
* **Recall**: `0.5650` (56.5%)
* **mAP50**: `0.6758` (67.6%)
* **mAP50-95**: `0.2837` (28.4%)

### Per-Class Test Performance
| Food Class | Precision | Recall | AP50 | AP50-95 |
| :--- | :--- | :--- | :--- | :--- |
| **vada** | `0.9194` | `1.0000` | **`0.9950`** | `0.4494` |
| **vermicelli upma** | `0.5106` | `1.0000` | **`0.9950`** | `0.4975` |
| **upma** | `0.9421` | `0.8333` | **`0.8807`** | `0.4794` |
| **rice** | `1.0000` | `0.5480` | **`0.8012`** | `0.1835` |
| **puri** | `0.6512` | `0.8000` | **`0.6905`** | `0.2164` |
| **colored rice** | `0.8797` | `0.3077` | **`0.6397`** | `0.2173` |
| **bananna** | `0.7666` | `0.3750` | **`0.5987`** | `0.2403` |
| **dosa** | `0.6118` | `0.5789` | **`0.5554`** | `0.2936` |
| **laddu** | `0.5554` | `0.1666` | **`0.5527`** | `0.2855` |
| **idli** | `0.3756` | `0.4735` | **`0.5373`** | `0.1844` |
| **holige** | `0.6985` | `0.4419` | **`0.5012`** | `0.1596` |
| **chapathi** | `0.5410` | `0.2553` | **`0.3618`** | `0.1982` |
| **chilli** | `0.0000` | `0.0000` | `0.0000` | `0.0000` |
| **chutney** | `0.0000` | `0.0000` | `0.0000` | `0.0000` |

---

## 5. How to Run Inference

### Single Image Prediction:
```bash
python food_yolo\scripts\predict.py --source "path\to\image.jpg" --conf 0.25
```

### Folder Batch Prediction:
```bash
python food_yolo\scripts\predict.py --source "food_yolo\dataset\images\test" --conf 0.25
```

Predictions will print bounding box coordinates and confidence values to the terminal and output annotated images to `food_yolo/outputs/predictions/`.
