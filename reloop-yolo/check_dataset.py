from ultralytics import YOLO

model = YOLO("../runs/detect/train-10/weights/best.pt")

metrics = model.val(
    data="dataset/data.yaml",
    split="test",
    imgsz=640,
    batch=4,
    device="cpu"
)