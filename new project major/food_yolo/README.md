# YOLO26 Multi-Food Object Detection Pipeline

This repository contains a complete, modular, and reproducible YOLO26-based object detection pipeline for food images (Chutney, Dosa, Idli, and Vada) using an Edge Impulse exported dataset.

The model is built to detect multiple food items in a single image, draw bounding boxes, classify each item, and report the confidence score.

---

## 1. Project Directory Structure

```text
food_yolo/
├── dataset/                  # Processed dataset in standard YOLO format
│   ├── images/               # Folders with images (.jpg)
│   │   ├── train/            # 90% (86 images)
│   │   └── test/             # 10% (10 images)
│   ├── labels/               # Folders with normalized labels (.txt)
│   │   ├── train/
│   │   └── test/
│   └── data.yaml             # YOLO dataset configuration
│
├── scripts/
│   ├── convert_dataset_2.py  # Split dataset (90/10) & convert coordinates from pixels to YOLO
│   ├── validate_dataset.py   # Sanity checks on labels and images
│   ├── visualize_labels.py   # Visualizes training bounding boxes
│   ├── train.py              # Finetuning pretrained YOLO26n
│   ├── evaluate.py           # Evaluate best model on test set
│   └── predict.py            # Clean inference script for single/folder predictions
│
├── runs/                     # Log directory for training (weights, loss plots)
├── outputs/
│   ├── visualizations/       # Overlay of ground truth training labels
│   └── predictions/          # Model inference visual outputs
│
├── requirements.txt          # Python dependencies
└── README.md                 # Project documentation
```

---

## 2. Setup and Installation

### Prerequisites
- Python 3.8+ (Tested on Python 3.11)
- PyTorch (CPU or GPU supported)

Install dependencies using pip:
```bash
pip install -r requirements.txt
```

---

## 3. Running the Pipeline

### Step 1: Dataset Preprocessing and Split
Edge Impulse coordinates are exported as pixel values `(top-left x, top-left y, width, height)`. We convert these to YOLO normalized coordinates `(center_x, center_y, width, height)` and split the dataset into Train (90%, 86 images) and Test (10%, 10 images).

Run the conversion script:
```bash
python scripts/convert_dataset_2.py
```

### Step 2: Dataset Integrity Validation
Verify that bounding boxes are normalized inside the `[0,1]` range, check for corrupted images, ensure files match, and detect empty annotations.
```bash
python scripts/validate_dataset.py
```

### Step 3: Visual Inspection of Ground Truth Labels
Overlays the class names and bounding boxes on 20 random training images. Verify that the annotations are aligned correctly.
```bash
python scripts/visualize_labels.py
```
*Visualizations will be saved under `outputs/visualizations/` with colors: Chutney = Yellow, Dosa = Blue, Idli = Green, Vada = Red.*

### Step 4: Fine-Tuning YOLO26n Model
Trains the model using the state-of-the-art `yolo26n.pt` weights. If a GPU (CUDA) is present, it will fine-tune using the GPU. Otherwise, it runs safely on CPU.
```bash
python scripts/train.py
```
*Outputs are saved under `runs/yolo26n_baseline/`.*

### Step 5: Model Evaluation on Unseen Test Dataset
Evaluates the best checkpoint (`runs/yolo26n_baseline/weights/best.pt`) on the test split and outputs a detailed per-class Precision, Recall, and mAP table. It automatically maps indices using `results.ap_class_index` to handle missing classes in the evaluation split.
```bash
python scripts/evaluate.py
```

### Step 6: Inference Pipeline (Predictions)
Run prediction on a single image or a directory of images:
```bash
# Run inference on all test images
python scripts/predict.py --source dataset/images/test --conf 0.25

# Run on a custom image path
python scripts/predict.py --source path/to/image.jpg --conf 0.30
```
*Outputs are saved under `outputs/predictions/`.*

---

## 4. Key Methodology Explanations

### Conversion Formulation
For each bounding box in pixels:
- `x_center = (x_min + box_width / 2.0) / image_width`
- `y_center = (y_min + box_height / 2.0) / image_height`
- `normalized_width = box_width / image_width`
- `normalized_height = box_height / image_height`

### Transfer Learning vs Training From Scratch
- **Transfer Learning (Fine-tuning)**: We load pre-trained weights (`yolo26n.pt`) trained on millions of images (COCO). The model has already learned basic features (edges, textures, shapes). We fine-tune this model on our food images, allowing high accuracy even with a small dataset.
- **Training from Scratch**: Training starting with random weight initialization. This requires massive datasets (tens of thousands of labeled images) to prevent severe overfitting.

---

## 5. Model Class Mapping
- **0**: chutney
- **1**: dosa
- **2**: idli
- **3**: vada
