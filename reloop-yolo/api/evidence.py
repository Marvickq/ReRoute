"""OpenCV visual-evidence extraction: annotated frames and object crops from real detections."""
import hashlib
from typing import Any, Dict, List, Tuple

import cv2
import numpy as np

ANNOTATED_MAX_SIDE = 1280
CROP_MAX_SIDE = 480


def _color_for(label: str) -> Tuple[int, int, int]:
    h = hashlib.md5(label.encode()).digest()
    return int(h[0]) % 200 + 40, int(h[1]) % 200 + 40, int(h[2]) % 200 + 40


def _clamp_box(bbox: List[float], w: int, h: int) -> Tuple[int, int, int, int]:
    x1, y1, x2, y2 = bbox
    return (max(0, int(x1)), max(0, int(y1)), min(w, int(round(x2))), min(h, int(round(y2))))


def annotate_detections(img: np.ndarray, detections: List[Dict[str, Any]]) -> np.ndarray:
    """Draw boxes+labels on a *copy*. Detections below-threshold flagged by crop_confirmed are dashed-free
    but labelled '?' so a reviewer can see which boxes the system itself considers uncertain."""
    out = img.copy()
    h, w = out.shape[:2]
    thick = max(2, round(max(h, w) / 400))
    scale = max(0.5, max(h, w) / 1400)
    for d in detections:
        x1, y1, x2, y2 = _clamp_box(d["bbox"], w, h)
        color = _color_for(d["class_name"])
        label = f"{d['class_name']} {d['confidence']:.2f}"
        if d.get("uncertain"):
            label += " ?"
        cv2.rectangle(out, (x1, y1), (x2, y2), color, thick)
        (tw, th), base = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, scale, max(1, thick - 1))
        ty = max(th + base, y1)
        cv2.rectangle(out, (x1, ty - th - base), (x1 + tw + 4, ty), color, -1)
        cv2.putText(out, label, (x1 + 2, ty - base), cv2.FONT_HERSHEY_SIMPLEX, scale,
                    (255, 255, 255), max(1, thick - 1), cv2.LINE_AA)
    return out


def crop_detection(img: np.ndarray, bbox: List[float], pad: float = 0.08) -> np.ndarray:
    h, w = img.shape[:2]
    x1, y1, x2, y2 = bbox
    px, py = (x2 - x1) * pad, (y2 - y1) * pad
    cx1, cy1, cx2, cy2 = _clamp_box([x1 - px, y1 - py, x2 + px, y2 + py], w, h)
    return img[cy1:cy2, cx1:cx2].copy()


def encode_jpeg(img: np.ndarray, max_side: int, quality: int = 88) -> bytes:
    h, w = img.shape[:2]
    if max(h, w) > max_side:
        s = max_side / max(h, w)
        img = cv2.resize(img, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("JPEG encoding failed")
    return buf.tobytes()


def build_visual_evidence(
    img: np.ndarray, detections: List[Dict[str, Any]], max_crops: int = 5
) -> Dict[str, Any]:
    """Return {annotated_jpeg, crops:[{detection_index, class_name, confidence, bbox, jpeg}]}.

    Crops are taken from the original image, highest-confidence first, skipping degenerate boxes.
    """
    annotated = encode_jpeg(annotate_detections(img, detections), ANNOTATED_MAX_SIDE)
    order = sorted(range(len(detections)), key=lambda i: -detections[i]["confidence"])
    crops = []
    for i in order:
        if len(crops) >= max_crops:
            break
        d = detections[i]
        crop = crop_detection(img, d["bbox"])
        if crop.shape[0] < 8 or crop.shape[1] < 8:
            continue
        crops.append({
            "detection_index": i,
            "class_name": d["class_name"],
            "confidence": d["confidence"],
            "bbox": d["bbox"],
            "jpeg": encode_jpeg(crop, CROP_MAX_SIDE),
        })
    return {"annotated_jpeg": annotated, "crops": crops}
