from ultralytics import YOLO


MODEL_PATH = "runs/detect/train-11/weights/best.pt"

model = YOLO(MODEL_PATH)


def detect(image_path: str):
    results = model(image_path)

    detections = []

    for result in results:
        for box in result.boxes:
            class_id = int(box.cls[0])

            detections.append({
                "class_name": result.names[class_id],
                "confidence": round(float(box.conf[0]), 4),
                "bbox": [round(x, 2) for x in box.xyxy[0].tolist()]
            })

    return detections


if __name__ == "__main__":

    image_path = "dataset/test/images/Mobile_20_jpg.rf.4275e73271acae0aa6f3a600283a91dc.jpg"

    print("Loading YOLO...")
    print("Testing image:", image_path)

    detections = detect(image_path)

    print("\nDetections:")

    if not detections:
        print("No objects detected.")
    else:
        for detection in detections:
            print(detection)