from ultralytics import YOLO
from collections import Counter
import os

# Load trained model
model = YOLO("../runs/detect/train-6/weights/best.pt")

# Class names
class_names = model.names

# Test images
image_dir = "dataset/test/images"

# Ground-truth class counts
ground_truth = Counter()

# Prediction confusion candidates
confusion_cases = []

for image_name in os.listdir(image_dir):

    if not image_name.lower().endswith((".jpg", ".jpeg", ".png")):
        continue

    image_path = os.path.join(image_dir, image_name)

    # Corresponding label
    label_name = os.path.splitext(image_name)[0] + ".txt"
    label_path = os.path.join("dataset/test/labels", label_name)

    if not os.path.exists(label_path):
        continue

    # Read ground-truth labels
    true_classes = []

    with open(label_path, "r") as f:
        for line in f:
            parts = line.strip().split()

            if len(parts) >= 5:
                class_id = int(parts[0])
                true_classes.append(class_id)
                ground_truth[class_id] += 1

    # Run prediction
    results = model.predict(
        image_path,
        conf=0.25,
        verbose=False
    )

    predicted_classes = []

    for result in results:
        if result.boxes is not None:
            for cls in result.boxes.cls:
                predicted_classes.append(int(cls))

    # Check Player -> Mouse
    player_id = None
    mouse_id = None

    for class_id, name in class_names.items():

        if name.lower() == "player":
            player_id = class_id

        if name.lower() == "mouse":
            mouse_id = class_id

    if player_id in true_classes and mouse_id in predicted_classes:

        confusion_cases.append(image_name)


print("\nGROUND TRUTH DISTRIBUTION")
print("--------------------------------")

for class_id, count in sorted(ground_truth.items()):
    print(f"{class_names[class_id]:20} {count}")

print("\nPLAYER → MOUSE CANDIDATES")
print("--------------------------------")

print(f"Found: {len(confusion_cases)} images")

for image in confusion_cases:
    print(image)