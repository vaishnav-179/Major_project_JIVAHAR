import os
import random
import cv2
import yaml

dataset_dir = r"c:\Users\VAISHNAV\Desktop\PROJECTS\new project major\food_yolo\dataset"
output_dir = r"c:\Users\VAISHNAV\Desktop\PROJECTS\new project major\food_yolo\outputs\visualizations"
os.makedirs(output_dir, exist_ok=True)

# Load class names
yaml_path = os.path.join(dataset_dir, "data.yaml")
with open(yaml_path, 'r') as f:
    config = yaml.safe_load(f)
class_names = config.get("names", {})

COLOR_PALETTE = [
    (0, 255, 255),   # 0: bananna (Yellow)
    (42, 42, 165),   # 1: chapathi (Brown)
    (0, 0, 255),     # 2: chilli (Red)
    (0, 200, 0),     # 3: chutney (Green)
    (0, 165, 255),   # 4: colored rice (Orange)
    (255, 0, 0),     # 5: dosa (Blue)
    (180, 105, 255), # 6: holige (Pink)
    (200, 200, 200), # 7: idli (Silver)
    (0, 215, 255),   # 8: laddu (Gold)
    (34, 139, 34),   # 9: puri (Forest Green)
    (255, 255, 255), # 10: rice (White)
    (128, 0, 128),   # 11: upma (Purple)
    (0, 69, 255),    # 12: vada (Orange-Red)
    (230, 216, 173)  # 13: vermicelli upma (Light Cyan/Blue)
]

def get_color(class_id):
    return COLOR_PALETTE[class_id % len(COLOR_PALETTE)]

def main():
    train_img_dir = os.path.join(dataset_dir, "images", "train")
    train_lbl_dir = os.path.join(dataset_dir, "labels", "train")
    
    images = [f for f in os.listdir(train_img_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    if not images:
        print("No training images found!")
        return
        
    # Select 20 random images, or all if less than 20
    num_to_viz = min(20, len(images))
    random.seed(42)
    selected_images = random.sample(images, num_to_viz)
    
    print(f"Generating label visualizations for {num_to_viz} random training images...")
    
    for img_name in selected_images:
        img_path = os.path.join(train_img_dir, img_name)
        label_name = os.path.splitext(img_name)[0] + ".txt"
        lbl_path = os.path.join(train_lbl_dir, label_name)
        
        img = cv2.imread(img_path)
        if img is None:
            print(f"Warning: Could not read image {img_name}")
            continue
            
        h, w, _ = img.shape
        
        if os.path.exists(lbl_path):
            with open(lbl_path, 'r') as f:
                lines = f.readlines()
                
            for line in lines:
                parts = line.strip().split()
                if len(parts) != 5:
                    continue
                    
                class_id = int(parts[0])
                x_center = float(parts[1])
                y_center = float(parts[2])
                box_w = float(parts[3])
                box_h = float(parts[4])
                
                # Convert back to pixel values
                x1 = int((x_center - box_w / 2.0) * w)
                y1 = int((y_center - box_h / 2.0) * h)
                x2 = int((x_center + box_w / 2.0) * w)
                y2 = int((y_center + box_h / 2.0) * h)
                
                # Draw box
                color = get_color(class_id)
                cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
                
                # Draw text background and text
                label_text = f"{class_names.get(class_id, 'unknown')} (ID:{class_id})"
                (text_w, text_h), baseline = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                cv2.rectangle(img, (x1, y1 - text_h - 4), (x1 + text_w, y1), color, -1)
                cv2.putText(img, label_text, (x1, y1 - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)
                
        out_path = os.path.join(output_dir, f"viz_{img_name}")
        cv2.imwrite(out_path, img)
        
    print(f"Visualizations saved to {output_dir}")

if __name__ == "__main__":
    main()
