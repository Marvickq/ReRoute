from ultralytics import YOLO

model = YOLO("runs/detect/train-11/weights/best.pt")

results = model.predict(
    source="dataset/test/images",
    conf=0.50,
    save=True
)

print("Prediction completed!")