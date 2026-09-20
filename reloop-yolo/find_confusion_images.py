from ultralytics import YOLO
from pathlib import Path
import shutil

# -----------------------------
# 1. Load trained model
# -----------------------------
model = YOLO("../runs/detect/train-10/weights/best.pt")

# -----------------------------
# 2. Paths
# -----------------------------
image_dir = Path("dataset/test/images")
label_dir = Path("dataset/test/labels")

output_dir = Path("error_analysis")
output_dir.mkdir(exist_ok=True)

# -----------------------------
# 3. Class names
# -----------------------------
class_names = [
    "Battery",
    "Keyboard",
    "Microwave",
    "Mobile",
    "Mouse",
    "PCB",
    "Player",
    "Printer",
    "Television",
    "Washing Machine"
]

# -----------------------------
# 4. Confusions we want
# -----------------------------
target_confusions = {
    ("Television", "Microwave"),
    ("Player", "Battery"),
    ("Player", "Mouse"),
    ("Printer", "Battery"),
    ("Battery", "Player"),
}

# -----------------------------
# 5. Process every test image
# -----------------------------
for image_path in image_dir.iterdir():

    if image_path.suffix.lower() not in [".jpg", ".jpeg", ".png"]:
        continue

    label_path = label_dir / f"{image_path.stem}.txt"

    if not label_path.exists():
        continue

    # Ground-truth boxes
    ground_truths = []

    with open(label_path, "r") as file:
        for line in file:
            parts = line.strip().split()

            if len(parts) != 5:
                continue

            class_id = int(parts[0])

            x_center = float(parts[1])
            y_center = float(parts[2])
            width = float(parts[3])
            height = float(parts[4])

            ground_truths.append(
                (
                    class_id,
                    x_center,
                    y_center,
                    width,
                    height
                )
            )

    # Run YOLO
    results = model.predict(
        source=str(image_path),
        conf=0.25,
        verbose=False
    )

    result = results[0]

    if result.boxes is None:
        continue

    # -----------------------------
    # 6. Compare predictions
    # -----------------------------
    for gt_class, gt_x, gt_y, gt_w, gt_h in ground_truths:

        gt_name = class_names[gt_class]

        # Convert YOLO format to xyxy
        gt_x1 = gt_x - gt_w / 2
        gt_y1 = gt_y - gt_h / 2
        gt_x2 = gt_x + gt_w / 2
        gt_y2 = gt_y + gt_h / 2

        best_iou = 0
        best_prediction = None

        for box, pred_class, confidence in zip(
            result.boxes.xyxy,
            result.boxes.cls,
            result.boxes.conf
        ):

            pred_class = int(pred_class)

            px1, py1, px2, py2 = box.tolist()

            # Ground truth is normalized.
            # Convert it to pixel coordinates.
            img_width = result.orig_shape[1]
            img_height = result.orig_shape[0]

            gx1 = gt_x1 * img_width
            gy1 = gt_y1 * img_height
            gx2 = gt_x2 * img_width
            gy2 = gt_y2 * img_height

            # Intersection
            ix1 = max(gx1, px1)
            iy1 = max(gy1, py1)
            ix2 = min(gx2, px2)
            iy2 = min(gy2, py2)

            intersection = max(0, ix2 - ix1) * max(0, iy2 - iy1)

            # Areas
            gt_area = max(0, gx2 - gx1) * max(0, gy2 - gy1)
            pred_area = max(0, px2 - px1) * max(0, py2 - py1)

            union = gt_area + pred_area - intersection

            if union == 0:
                continue

            iou = intersection / union

            if iou > best_iou:
                best_iou = iou
                best_prediction = pred_class

        # -----------------------------
        # 7. Check for confusion
        # -----------------------------
        if best_prediction is not None and best_iou >= 0.5:

            predicted_name = class_names[best_prediction]

            pair = (gt_name, predicted_name)

            if pair in target_confusions:

                folder_name = f"{gt_name}_to_{predicted_name}"

                folder = output_dir / folder_name
                folder.mkdir(parents=True, exist_ok=True)

                destination = folder / image_path.name

                shutil.copy2(image_path, destination)

                print(
                    f"{gt_name} -> {predicted_name} | "
                    f"IoU: {best_iou:.2f} | "
                    f"{image_path.name}"
                )

print("\nDone!")
print(f"Check the '{output_dir}' folder.")