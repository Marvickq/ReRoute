from ultralytics import YOLO
from collections import Counter

model = YOLO("../runs/detect/train-10/weights/best.pt")

class_names = model.names

IOU_THRESHOLD = 0.5
CONF_THRESHOLD = 0.25

confusion = Counter()
missed = Counter()
correct = Counter()


def calculate_iou(box1, box2):
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    intersection_width = max(0, x2 - x1)
    intersection_height = max(0, y2 - y1)

    intersection = intersection_width * intersection_height

    area1 = max(0, box1[2] - box1[0]) * max(0, box1[3] - box1[1])
    area2 = max(0, box2[2] - box2[0]) * max(0, box2[3] - box2[1])

    union = area1 + area2 - intersection

    if union == 0:
        return 0

    return intersection / union


# Run validation and get predictions
results = model.predict(
    source="dataset/test/images",
    conf=CONF_THRESHOLD,
    verbose=False
)

for result in results:

    image_width = result.orig_shape[1]
    image_height = result.orig_shape[0]

    image_name = result.path.split("\\")[-1]

    label_path = (
        "dataset/test/labels/"
        + image_name.rsplit(".", 1)[0]
        + ".txt"
    )

    # Read ground truth
    ground_truth = []

    with open(label_path, "r") as f:

        for line in f:

            parts = line.strip().split()

            if len(parts) != 5:
                continue

            class_id = int(parts[0])

            x_center = float(parts[1]) * image_width
            y_center = float(parts[2]) * image_height
            width = float(parts[3]) * image_width
            height = float(parts[4]) * image_height

            x1 = x_center - width / 2
            y1 = y_center - height / 2
            x2 = x_center + width / 2
            y2 = y_center + height / 2

            ground_truth.append(
                {
                    "class": class_id,
                    "box": [x1, y1, x2, y2],
                    "matched": False
                }
            )

    # Predictions
    predictions = []

    if result.boxes is not None:

        for box, cls, conf in zip(
            result.boxes.xyxy,
            result.boxes.cls,
            result.boxes.conf
        ):

            predictions.append(
                {
                    "class": int(cls),
                    "box": box.cpu().tolist(),
                    "confidence": float(conf)
                }
            )

    # Match each ground-truth object
    for gt in ground_truth:

        best_iou = 0
        best_prediction = None

        for pred in predictions:

            if pred.get("matched", False):
                continue

            iou = calculate_iou(
                gt["box"],
                pred["box"]
            )

            if iou > best_iou:
                best_iou = iou
                best_prediction = pred

        true_name = class_names[gt["class"]]

        if best_prediction is None or best_iou < IOU_THRESHOLD:

            missed[true_name] += 1

        else:

            predicted_name = class_names[
                best_prediction["class"]
            ]

            best_prediction["matched"] = True

            if gt["class"] == best_prediction["class"]:

                correct[true_name] += 1

            else:

                confusion[
                    (true_name, predicted_name)
                ] += 1


print("\n==============================")
print("CORRECT DETECTIONS")
print("==============================")

for name, count in correct.most_common():

    print(f"{name:20} {count}")


print("\n==============================")
print("MISSED OBJECTS")
print("==============================")

for name, count in missed.most_common():

    print(f"{name:20} {count}")


print("\n==============================")
print("CLASS CONFUSIONS")
print("==============================")

if not confusion:

    print("No class confusions found.")

else:

    for (true_name, predicted_name), count in confusion.most_common():

        print(
            f"{true_name:20} → {predicted_name:20} {count}"
        )