from bedrock import interpret_detections


detections = [
    {
        "class_name": "Mobile",
        "confidence": 0.4418,
        "bbox": [18.65, 18.65, 315.2, 357.11]
    }
]


result = interpret_detections(detections)

print("\nBedrock Material Intelligence:")
print(result)