import os
import argparse
import cv2
import yaml
from ultralytics import YOLO

# BGR colors for visualization: dosa (blue), idli (green), vada (red)
colors = {
    0: (0, 255, 255),  # Yellow for chutney
    1: (255, 0, 0),    # Blue for dosa
    2: (0, 255, 0),    # Green for idli
    3: (0, 0, 255)     # Red for vada
}

def predict_image(model, img_path, output_dir, conf_thresh, iou_thresh):
    img = cv2.imread(img_path)
    if img is None:
        print(f"Error: Could not read image {img_path}")
        return
        
    h, w, _ = img.shape
    filename = os.path.basename(img_path)
    
    # Run inference
    results = model(img_path, conf=conf_thresh, iou=iou_thresh, verbose=False)
    result = results[0]
    
    print(f"\nDetections for {filename}:")
    print("-" * 30)
    
    boxes = result.boxes
    if len(boxes) == 0:
        print("No food objects detected.")
    else:
        for idx, box in enumerate(boxes, 1):
            class_id = int(box.cls[0])
            conf_val = float(box.conf[0])
            xyxy = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
            class_name = model.names[class_id]
            
            print(f"{idx}. {class_name}")
            print(f"   confidence: {conf_val:.2f}")
            print(f"   box: [{int(xyxy[0])}, {int(xyxy[1])}, {int(xyxy[2])}, {int(xyxy[3])}]")
            
            # Draw bounding box
            color = colors.get(class_id, (0, 255, 255))
            cv2.rectangle(img, (int(xyxy[0]), int(xyxy[1])), (int(xyxy[2]), int(xyxy[3])), color, 2)
            
            # Draw text label
            label_text = f"{class_name} {conf_val:.2f}"
            (text_w, text_h), baseline = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(img, (int(xyxy[0]), int(xyxy[1]) - text_h - 4), (int(xyxy[0]) + text_w, int(xyxy[1])), color, -1)
            cv2.putText(img, label_text, (int(xyxy[0]), int(xyxy[1]) - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)
            
    print("-" * 30)
    
    # Save output image
    out_path = os.path.join(output_dir, f"pred_{filename}")
    cv2.imwrite(out_path, img)
    print(f"Saved prediction visualization to {out_path}")

def main():
    parser = argparse.ArgumentParser(description="YOLO26 Food Object Detection Inference")
    parser.add_argument("--source", type=str, default=r"c:\Users\VAISHNAV\Desktop\PROJECTS\new project major\food_yolo\dataset\images\test", help="Path to single image or folder")
    parser.add_argument("--weights", type=str, default=r"c:\Users\VAISHNAV\Desktop\PROJECTS\new project major\food_yolo\runs\yolo26n_baseline\weights\best.pt", help="Path to model weights")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    parser.add_argument("--iou", type=float, default=0.45, help="Intersection-over-Union threshold for NMS")
    parser.add_argument("--output", type=str, default=r"c:\Users\VAISHNAV\Desktop\PROJECTS\new project major\food_yolo\outputs\predictions", help="Directory to save output visualizations")
    
    args = parser.parse_ok = parser.parse_args()
    
    if not os.path.exists(args.weights):
        print(f"ERROR: Model weights not found at {args.weights}")
        return
        
    print(f"Loading weights from {args.weights}...")
    model = YOLO(args.weights)
    
    os.makedirs(args.output, exist_ok=True)
    
    if os.path.isdir(args.source):
        print(f"Processing folder: {args.source}")
        files = [os.path.join(args.source, f) for f in os.listdir(args.source) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        if not files:
            print("No images found in the source directory.")
            return
        for file in files:
            predict_image(model, file, args.output, args.conf, args.iou)
    else:
        print(f"Processing file: {args.source}")
        predict_image(model, args.source, args.output, args.conf, args.iou)

if __name__ == "__main__":
    main()
