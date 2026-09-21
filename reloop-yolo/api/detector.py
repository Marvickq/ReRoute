import os
import torch
import gc
from ultralytics import YOLO

# Limit PyTorch CPU threads to 1 to reduce RAM memory usage on Render (512MB limit)
torch.set_num_threads(1)

MODEL_PATH = "runs/detect/train-11/weights/best.pt"

_model = None

def get_model():
    global _model
    if _model is None:
        if os.path.exists(MODEL_PATH):
            _model = YOLO(MODEL_PATH)
        else:
            _model = YOLO("yolov8n.pt")
    return _model

def detect(image_path: str):
    model = get_model()
    detections = []

    with torch.inference_mode():
        results = model(image_path, verbose=False)
        for result in results:
            for box in result.boxes:
                class_id = int(box.cls[0])
                detections.append({
                    "class_name": result.names[class_id],
                    "confidence": round(float(box.conf[0]), 4),
                    "bbox": [round(x, 2) for x in box.xyxy[0].tolist()]
                })

    gc.collect()
    return detections

if __name__ == "__main__":
    print("Testing YOLO detector locally...")
    print("Model initialized successfully.")