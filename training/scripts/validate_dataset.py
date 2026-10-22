import os
import yaml
from PIL import Image

dataset_dir = r"c:\Users\VAISHNAV\Desktop\PROJECTS\new project major\food_yolo\dataset"
yaml_path = os.path.join(dataset_dir, "data.yaml")

def load_yaml():
    if not os.path.exists(yaml_path):
        return None
    with open(yaml_path, 'r') as f:
        return yaml.safe_load(f)

def validate():
    config = load_yaml()
    if not config:
        print("ERROR: data.yaml not found!")
        return

    num_classes = len(config.get("names", {}))
    class_names = config.get("names", {})
    
    splits = ["train", "test"]
    
    total_images = 0
    total_labels = 0
    total_objects = 0
    
    invalid_labels = 0
    missing_labels = 0
    corrupted_images = 0
    duplicate_boxes = 0
    empty_labels = 0
    out_of_bounds = 0
    
    detected_classes = set()

    for split in splits:
        img_dir = os.path.join(dataset_dir, "images", split)
        lbl_dir = os.path.join(dataset_dir, "labels", split)
        
        if not os.path.exists(img_dir):
            print(f"ERROR: Image directory for {split} not found at {img_dir}")
            continue
            
        images = [f for f in os.listdir(img_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        total_images += len(images)
        
        for img_name in images:
            img_path = os.path.join(img_dir, img_name)
            
            # Check for corrupted images
            is_corrupted = False
            try:
                with Image.open(img_path) as img:
                    img.verify()
            except Exception:
                corrupted_images += 1
                is_corrupted = True
                print(f"Warning: Corrupted image file found: {img_path}")
                
            label_name = os.path.splitext(img_name)[0] + ".txt"
            lbl_path = os.path.join(lbl_dir, label_name)
            
            if not os.path.exists(lbl_path):
                missing_labels += 1
                print(f"Warning: Missing label file for image: {img_name}")
                continue
                
            total_labels += 1
            
            # Read and validate label file
            with open(lbl_path, 'r') as f:
                lines = f.readlines()
                
            if not lines or len("".join(lines).strip()) == 0:
                empty_labels += 1
                continue
                
            seen_boxes = set()
            for line in lines:
                parts = line.strip().split()
                if len(parts) != 5:
                    invalid_labels += 1
                    print(f"Warning: Invalid label format (length {len(parts)} != 5) in {label_name}: '{line.strip()}'")
                    continue
                    
                try:
                    class_id = int(parts[0])
                    x_center = float(parts[1])
                    y_center = float(parts[2])
                    width = float(parts[3])
                    height = float(parts[4])
                except ValueError:
                    invalid_labels += 1
                    print(f"Warning: Non-numeric values in label in {label_name}: '{line.strip()}'")
                    continue
                    
                # Validate class ID
                if class_id < 0 or class_id >= num_classes:
                    invalid_labels += 1
                    print(f"Warning: Invalid class ID {class_id} in {label_name}")
                else:
                    detected_classes.add(class_id)
                    
                # Validate coordinates range
                if not (0.0 <= x_center <= 1.0 and 0.0 <= y_center <= 1.0 and 0.0 <= width <= 1.0 and 0.0 <= height <= 1.0):
                    invalid_labels += 1
                    print(f"Warning: Coordinates out of range [0, 1] in {label_name}: '{line.strip()}'")
                elif width <= 0 or height <= 0:
                    invalid_labels += 1
                    print(f"Warning: Bounding box dimension <= 0 in {label_name}: '{line.strip()}'")
                else:
                    # Check if box extends out of image boundaries significantly
                    x_min = x_center - width / 2.0
                    y_min = y_center - height / 2.0
                    x_max = x_center + width / 2.0
                    y_max = y_center + height / 2.0
                    if x_min < -0.01 or y_min < -0.01 or x_max > 1.01 or y_max > 1.01:
                        out_of_bounds += 1
                        print(f"Warning: Bounding box out of image bounds in {label_name}")
                        
                # Check for duplicate annotations for same object
                box_key = (class_id, round(x_center, 4), round(y_center, 4), round(width, 4), round(height, 4))
                if box_key in seen_boxes:
                    duplicate_boxes += 1
                    print(f"Warning: Duplicate bounding box annotation in {label_name}: '{line.strip()}'")
                else:
                    seen_boxes.add(box_key)
                    total_objects += 1

    # Check if number of classes matches yaml configuration
    # Note: It's okay if not all classes are present in a small test dataset, 
    # but we should flag if classes in annotations exceed the config class count.
    
    print("\nDATASET VALIDATION REPORT")
    print("-------------------------")
    print(f"Images:              {total_images}")
    print(f"Labels:              {total_labels}")
    print(f"Objects:             {total_objects}")
    print(f"Classes (YAML):      {num_classes} ({', '.join(class_names.values())})")
    print(f"Classes (Annotated): {len(detected_classes)}")
    print(f"Invalid labels:      {invalid_labels}")
    print(f"Missing labels:      {missing_labels}")
    print(f"Corrupted images:    {corrupted_images}")
    print(f"Duplicate boxes:     {duplicate_boxes}")
    print(f"Empty label files:   {empty_labels}")
    print(f"Out of bounds boxes: {out_of_bounds}")
    
    status = "PASSED"
    if invalid_labels > 0 or missing_labels > 0 or corrupted_images > 0 or duplicate_boxes > 0:
        status = "NEEDS CLEANUP"
        
    print(f"\nStatus: {status}")
    print("-------------------------")

if __name__ == "__main__":
    validate()
