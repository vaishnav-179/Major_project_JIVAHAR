import os
import json
import shutil
import random
from PIL import Image

# Set random seed for reproducibility
random.seed(42)

# Paths
src_dir = r"c:\Users\VAISHNAV\Desktop\PROJECTS\new project major\food-export"
src_train_dir = os.path.join(src_dir, "training")
src_bboxes_path = os.path.join(src_train_dir, "bounding_boxes.labels")

dest_dir = r"c:\Users\VAISHNAV\Desktop\PROJECTS\new project major\food_yolo\dataset"
images_dest = os.path.join(dest_dir, "images")
labels_dest = os.path.join(dest_dir, "labels")

# Class mapping (alphabetical order)
class_map = {
    "dosa": 0,
    "idli": 1,
    "vada": 2
}

def setup_dirs():
    for split in ["train", "val", "test"]:
        os.makedirs(os.path.join(images_dest, split), exist_ok=True)
        os.makedirs(os.path.join(labels_dest, split), exist_ok=True)

def main():
    print("Setting up target directories...")
    setup_dirs()

    # Load annotations
    if not os.path.exists(src_bboxes_path):
        print(f"Error: Bounding box labels not found at {src_bboxes_path}")
        return

    with open(src_bboxes_path, 'r') as f:
        data = json.load(f)

    bboxes = data.get("boundingBoxes", {})
    all_files = list(bboxes.keys())
    
    # Shuffle files with seed 42
    random.shuffle(all_files)
    
    # Split: Train (70%, 32), Val (20%, 9), Test (10%, 5)
    num_files = len(all_files)
    num_train = 32
    num_val = 9
    
    train_files = set(all_files[:num_train])
    val_files = set(all_files[num_train:num_train+num_val])
    test_files = set(all_files[num_train+num_val:])
    
    print(f"Dataset split summary:")
    print(f"  Total labeled files: {num_files}")
    print(f"  Train files: {len(train_files)}")
    print(f"  Val files: {len(val_files)}")
    print(f"  Test files: {len(test_files)}")

    for filename in all_files:
        if filename in train_files:
            split = "train"
        elif filename in val_files:
            split = "val"
        else:
            split = "test"
            
        src_img_path = os.path.join(src_train_dir, filename)
        if not os.path.exists(src_img_path):
            print(f"Warning: Image {filename} not found at {src_img_path}, skipping.")
            continue
            
        # Get image dimensions
        with Image.open(src_img_path) as img:
            img_width, img_height = img.size
            
        # Copy image to destination
        dest_img_path = os.path.join(images_dest, split, filename)
        shutil.copy2(src_img_path, dest_img_path)
        
        # Convert and write labels
        label_filename = os.path.splitext(filename)[0] + ".txt"
        dest_label_path = os.path.join(labels_dest, split, label_filename)
        
        boxes = bboxes[filename]
        yolo_lines = []
        for box in boxes:
            label = box.get("label")
            if label not in class_map:
                print(f"Warning: Unknown label '{label}' in {filename}, skipping box.")
                continue
                
            class_id = class_map[label]
            px_x = box.get("x")
            px_y = box.get("y")
            px_w = box.get("width")
            px_h = box.get("height")
            
            # Convert Edge Impulse pixel coordinates (top-left x, y) to YOLO normalized (center x, y)
            x_center = (px_x + px_w / 2.0) / img_width
            y_center = (px_y + px_h / 2.0) / img_height
            w_norm = px_w / img_width
            h_norm = px_h / img_height
            
            # Double check bounds
            x_center = max(0.0, min(1.0, x_center))
            y_center = max(0.0, min(1.0, y_center))
            w_norm = max(0.0, min(1.0, w_norm))
            h_norm = max(0.0, min(1.0, h_norm))
            
            yolo_lines.append(f"{class_id} {x_center:.6f} {y_center:.6f} {w_norm:.6f} {h_norm:.6f}")
            
        with open(dest_label_path, 'w') as lf:
            lf.write("\n".join(yolo_lines) + "\n")
            
    # Generate data.yaml
    data_yaml_content = f"""path: {dest_dir.replace(os.sep, '/')}
train: images/train
val: images/val
test: images/test

names:
  0: dosa
  1: idli
  2: vada
"""
    yaml_path = os.path.join(dest_dir, "data.yaml")
    with open(yaml_path, 'w') as yf:
        yf.write(data_yaml_content)
        
    print(f"Dataset successfully converted and saved to {dest_dir}")
    print(f"YAML configuration written to {yaml_path}")

if __name__ == "__main__":
    main()
