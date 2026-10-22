import os
import sys
import torch
import psutil
from ultralytics import YOLO

def print_env_report():
    print("="*40)
    print("ENVIRONMENT REPORT")
    print("="*40)
    print(f"Python Version: {sys.version.split()[0]}")
    print(f"PyTorch Version: {torch.__version__}")
    
    # GPU / CUDA Info
    cuda_available = torch.cuda.is_available()
    print(f"CUDA Available: {cuda_available}")
    if cuda_available:
        gpu_name = torch.cuda.get_device_name(0)
        vram_bytes = torch.cuda.get_device_properties(0).total_memory
        vram_gb = vram_bytes / (1024 ** 3)
        print(f"GPU: {gpu_name}")
        print(f"VRAM: {vram_gb:.2f} GB")
        device = 0
        batch_size = 16
    else:
        print("GPU: None")
        print("CUDA: None")
        print("VRAM: None")
        device = "cpu"
        batch_size = 16
        
    # CPU / RAM Info
    cpu_count = psutil.cpu_count(logical=False)
    logical_cpu_count = psutil.cpu_count(logical=True)
    ram_gb = psutil.virtual_memory().total / (1024 ** 3)
    print(f"CPU Physical Cores: {cpu_count}")
    print(f"CPU Logical Cores: {logical_cpu_count}")
    print(f"System RAM: {ram_gb:.2f} GB")
    print("="*40)
    
    return device, batch_size

def main():
    device, batch_size = print_env_report()
    
    # Paths
    dataset_yaml = r"c:\Users\VAISHNAV\Desktop\PROJECTS\new project major\food_yolo\dataset\data.yaml"
    project_dir = r"c:\Users\VAISHNAV\Desktop\PROJECTS\new project major\food_yolo\runs"
    
    # Verify dataset YAML exists
    if not os.path.exists(dataset_yaml):
        print(f"ERROR: Dataset YAML not found at {dataset_yaml}")
        return
        
    print("\nLoading pretrained YOLO26n model...")
    # Load YOLO26n model
    model = YOLO("yolo26n.pt")
    
    print("\nStarting fine-tuning...")
    # Fine-tune the model
    results = model.train(
        data=dataset_yaml,
        epochs=50,
        imgsz=640,
        batch=batch_size,
        device=device,
        patience=15,
        project=project_dir,
        name="yolo26n_baseline",
        exist_ok=True,
        seed=42,
        workers=0 if device == "cpu" else 4 # Set workers=0 on CPU to prevent Windows multiprocessing issues
    )
    
    print("\nTraining completed successfully!")
    print(f"Best model saved at: {os.path.join(project_dir, 'yolo26n_baseline', 'weights', 'best.pt')}")
    print(f"Last model saved at: {os.path.join(project_dir, 'yolo26n_baseline', 'weights', 'last.pt')}")

if __name__ == "__main__":
    main()
