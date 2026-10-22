import os
import json
import shutil
import random
from PIL import Image, ImageOps

random.seed(42)

dir2 = r"c:\Users\VAISHNAV\Desktop\PROJECTS\new project major\food_yolo\food images 2\training"
dir3 = r"c:\Users\VAISHNAV\Desktop\PROJECTS\new project major\food_yolo\food images 3\training"

dest_dir = r"c:\Users\VAISHNAV\Desktop\PROJECTS\new project major\food_yolo\dataset"
images_dest = os.path.join(dest_dir, "images")
labels_dest = os.path.join(dest_dir, "labels")

class_map = {
    "bananna": 0,
    "chapathi": 1,
    "chilli": 2,
    "chutney": 3,
    "colored rice": 4,
    "dosa": 5,
    "holige": 6,
    "idli": 7,
    "laddu": 8,
    "puri": 9,
    "rice": 10,
    "upma": 11,
    "vada": 12,
    "vermicelli upma": 13
}

def setup_dirs():
    if os.path.exists(dest_dir):
        shutil.rmtree(dest_dir)
    for split in ["train", "test"]:
        os.makedirs(os.path.join(images_dest, split), exist_ok=True)
        os.makedirs(os.path.join(labels_dest, split), exist_ok=True)

def main():
    print("Setting up target dataset directories...")
    setup_dirs()

    # Read dataset 2
    with open(os.path.join(dir2, "bounding_boxes.labels"), "r") as f:
        d2 = json.load(f)["boundingBoxes"]

    # Read dataset 3
    with open(os.path.join(dir3, "bounding_boxes.labels"), "r") as f:
        d3 = json.load(f)["boundingBoxes"]

    records = []
    for fn, boxes in d2.items():
        records.append((fn, dir2, boxes))
    for fn, boxes in d3.items():
        records.append((fn, dir3, boxes))

    random.shuffle(records)
    n_total = len(records)
    n_train = int(n_total * 0.90)

    train_set = set(r[0] for r in records[:n_train])
    test_set = set(r[0] for r in records[n_train:])

    print(f"Total labeled records: {n_total}")
    print(f"Train split (90%): {len(train_set)}")
    print(f"Test split (10%): {len(test_set)}")

    processed_count = 0
    total_boxes_written = 0

    for filename, src_dir, boxes in records:
        split = "train" if filename in train_set else "test"
        src_img_path = os.path.join(src_dir, filename)

        if not os.path.exists(src_img_path):
            print(f"Warning: Image {filename} not found in {src_dir}, skipping.")
            continue

        try:
            with Image.open(src_img_path) as img:
                # Transpose according to EXIF orientation so pixel layout matches Edge Impulse coordinates
                transposed_img = ImageOps.exif_transpose(img)
                w, h = transposed_img.size

                # Normalize box coordinates against the original annotated pixel space
                yolo_lines = []
                for box in boxes:
                    label = box.get("label")
                    if label not in class_map:
                        print(f"Warning: Unknown label '{label}' in {filename}, skipping box.")
                        continue

                    class_id = class_map[label]
                    px_x = float(box.get("x"))
                    px_y = float(box.get("y"))
                    px_w = float(box.get("width"))
                    px_h = float(box.get("height"))

                    x_center = (px_x + px_w / 2.0) / w
                    y_center = (px_y + px_h / 2.0) / h
                    w_norm = px_w / w
                    h_norm = px_h / h

                    x_center = max(0.0, min(1.0, x_center))
                    y_center = max(0.0, min(1.0, y_center))
                    w_norm = max(0.0, min(1.0, w_norm))
                    h_norm = max(0.0, min(1.0, h_norm))

                    yolo_lines.append(f"{class_id} {x_center:.6f} {y_center:.6f} {w_norm:.6f} {h_norm:.6f}")
                    total_boxes_written += 1

                # Resize to max 800px for 50x faster CPU dataloading during YOLO training
                if max(w, h) > 800:
                    transposed_img.thumbnail((800, 800), Image.Resampling.LANCZOS)
                
                # Save optimized image
                dest_img_path = os.path.join(images_dest, split, filename)
                if transposed_img.mode in ("RGBA", "P"):
                    transposed_img = transposed_img.convert("RGB")
                transposed_img.save(dest_img_path, quality=92, optimize=True)

        except Exception as e:
            print(f"Error processing image {filename}: {e}, skipping.")
            continue

        label_filename = os.path.splitext(filename)[0] + ".txt"
        dest_label_path = os.path.join(labels_dest, split, label_filename)

        with open(dest_label_path, "w") as lf:
            lf.write("\n".join(yolo_lines) + "\n")

        processed_count += 1

    # Write data.yaml
    names_yaml = "\n".join([f"  {cid}: {cname}" for cname, cid in sorted(class_map.items(), key=lambda x: x[1])])
    data_yaml_content = f"""path: {dest_dir.replace(os.sep, '/')}
train: images/train
val: images/test
test: images/test

names:
{names_yaml}
"""
    yaml_path = os.path.join(dest_dir, "data.yaml")
    with open(yaml_path, "w") as yf:
        yf.write(data_yaml_content)

    print(f"\nProcessing complete!")
    print(f"Successfully processed {processed_count} images.")
    print(f"Total bounding boxes written: {total_boxes_written}")
    print(f"Configuration written to {yaml_path}")

if __name__ == "__main__":
    main()
