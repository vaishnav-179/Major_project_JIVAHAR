import os
import yaml
from ultralytics import YOLO

def main():
    # Paths
    dataset_yaml = r"c:\Users\VAISHNAV\Desktop\PROJECTS\new project major\food_yolo\dataset\data.yaml"
    best_model_path = r"c:\Users\VAISHNAV\Desktop\PROJECTS\new project major\food_yolo\runs\yolo26n_baseline\weights\best.pt"
    
    if not os.path.exists(best_model_path):
        print(f"ERROR: Best model checkpoint not found at {best_model_path}")
        print("Please ensure the training completes successfully first.")
        return

    print(f"Loading best model from {best_model_path}...")
    model = YOLO(best_model_path)
    
    print("\nEvaluating model on the TEST split...")
    # Run evaluation on the test split
    results = model.val(
        data=dataset_yaml,
        split='test',
        device='cpu',
        workers=0
    )
    
    # Extract overall metrics
    metrics_dict = results.results_dict
    overall_precision = metrics_dict.get('metrics/precision(B)', 0.0)
    overall_recall = metrics_dict.get('metrics/recall(B)', 0.0)
    overall_map50 = metrics_dict.get('metrics/mAP50(B)', 0.0)
    overall_map95 = metrics_dict.get('metrics/mAP50-95(B)', 0.0)
    
    print("\n" + "="*50)
    print("OVERALL METRICS ON TEST DATASET")
    print("="*50)
    print(f"Precision:   {overall_precision:.4f}")
    print(f"Recall:      {overall_recall:.4f}")
    print(f"mAP50:       {overall_map50:.4f}")
    print(f"mAP50-95:    {overall_map95:.4f}")
    print("="*50)
    
    # Class names map
    class_names = model.names
    
    # Extract per-class metrics
    print("\nPER-CLASS PERFORMANCE")
    print("-" * 65)
    print(f"{'Class':<15} | {'Precision':<10} | {'Recall':<10} | {'AP50':<10} | {'AP50-95':<10}")
    print("-" * 65)
    
    # results.box contains class-specific metric lists
    # results.ap_class_index lists the class IDs present in the evaluation split
    ap_class_index = results.ap_class_index.tolist() if hasattr(results, 'ap_class_index') else []
    class_to_metric_idx = {class_id: idx for idx, class_id in enumerate(ap_class_index)}
    
    ap50_list = results.box.ap50
    ap95_list = results.box.ap
    p_list = results.box.p
    r_list = list(results.box.r) if hasattr(results.box, 'r') else []
    
    for class_id in sorted(class_names.keys()):
        class_name = class_names[class_id]
        
        if class_id in class_to_metric_idx:
            metric_idx = class_to_metric_idx[class_id]
            p = p_list[metric_idx] if metric_idx < len(p_list) else 0.0
            r = r_list[metric_idx] if metric_idx < len(r_list) else 0.0
            ap50 = ap50_list[metric_idx] if metric_idx < len(ap50_list) else 0.0
            ap95 = ap95_list[metric_idx] if metric_idx < len(ap95_list) else 0.0
        else:
            p = r = ap50 = ap95 = 0.0
            
        print(f"{class_name:<15} | {p:<10.4f} | {r:<10.4f} | {ap50:<10.4f} | {ap95:<10.4f}")
        
    print("-" * 65)

if __name__ == "__main__":
    main()
