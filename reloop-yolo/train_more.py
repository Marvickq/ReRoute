from ultralytics import YOLO

model = YOLO("../runs/detect/train-10/weights/best.pt")

model.train(
    data="dataset/data.yaml",
    epochs=10,
    imgsz=640,
    batch=4,
    device="cpu",
    workers=2
)