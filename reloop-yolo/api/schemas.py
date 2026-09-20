from pydantic import BaseModel
from typing import List


class Detection(BaseModel):
    class_name: str
    confidence: float
    bbox: List[float]


class DetectionResponse(BaseModel):
    success: bool
    filename: str
    detections: List[Detection]