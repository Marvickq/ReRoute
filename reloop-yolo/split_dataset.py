import os
import random
import shutil

random.seed(42)

dataset = "dataset"

source_images = os.path.join(dataset, "train", "images")
source_labels = os.path.join(dataset, "train", "labels")

splits = {
    "train": 0.70,
    "valid": 0.20,
    "test": 0.10
}

# Create folders
for split in splits:
    os.makedirs(os.path.join(dataset, split, "images"), exist_ok=True)
    os.makedirs(os.path.join(dataset, split, "labels"), exist_ok=True)

# Get images
images = [
    f for f in os.listdir(source_images)
    if f.lower().endswith((".jpg", ".jpeg", ".png"))
]

random.shuffle(images)

total = len(images)

train_end = int(total * 0.70)
valid_end = train_end + int(total * 0.20)

train_images = images[:train_end]
valid_images = images[train_end:valid_end]
test_images = images[valid_end:]

split_data = {
    "train": train_images,
    "valid": valid_images,
    "test": test_images
}

# Move images and matching labels
for split, image_list in split_data.items():

    for image_name in image_list:

        image_source = os.path.join(source_images, image_name)
        image_destination = os.path.join(
            dataset, split, "images", image_name
        )

        label_name = os.path.splitext(image_name)[0] + ".txt"

        label_source = os.path.join(source_labels, label_name)
        label_destination = os.path.join(
            dataset, split, "labels", label_name
        )

        shutil.move(image_source, image_destination)

        if os.path.exists(label_source):
            shutil.move(label_source, label_destination)

print("Dataset split completed!")

print(f"Total images: {total}")
print(f"Train: {len(train_images)}")
print(f"Valid: {len(valid_images)}")
print(f"Test: {len(test_images)}")