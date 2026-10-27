"""Measured evaluation on the real sample photos with the real YOLO model (no mocks, no ground truth).

Run from the reloop-yolo directory:   python -m tests.eval_real
Writes tests/eval_results.json. Reports outcomes, latency and raw detections only - there are no labelled
ground-truth boxes for these photos, so NO precision/recall/mAP is computed or claimed.
"""
import glob
import json
import os
import statistics
import sys
import time

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from api.detector import detect, model_name  # noqa: E402
from api.inspection import run_inspection  # noqa: E402
from api.quality import assess_image_quality, enhance_contrast  # noqa: E402
from tests.conftest import degrade  # noqa: E402


def dim(img):
    return np.clip(img.astype(np.float32) * 0.45, 0, 255).astype(np.uint8)


VARIANTS = {
    "original": lambda i: i,
    "synthetic_blur": lambda i: degrade(i, "blur"),
    "synthetic_dark": lambda i: degrade(i, "dark"),
    "synthetic_dim": dim,
    "synthetic_lowres": lambda i: degrade(i, "lowres"),
}


def main():
    detect(np.zeros((64, 64, 3), np.uint8))  # warm-up (model load) so latency below excludes it
    rows = []
    for path in sorted(glob.glob(os.path.join(ROOT, "tests", "samples", "*.jpg"))):
        base = cv2.imread(path)
        for vname, fn in VARIANTS.items():
            img = fn(base)
            t = time.perf_counter()
            res = run_inspection(img, lambda a, c=None: detect(a, c))
            wall = (time.perf_counter() - t) * 1000
            rows.append({
                "image": os.path.basename(path), "variant": vname,
                "quality_status": res["quality"]["status"], "quality_reasons": res["quality"]["reasons"],
                "outcome": res["outcome"], "routing_blocked": res["routing_blocked"],
                "actions": [s["action"] for s in res["steps"]],
                "detections": [(d["class_name"], d["confidence"]) for d in res["detections"]],
                "latency_ms": round(wall, 1),
            })

    # Does CLAHE change detections? measured on the same real photos, raw detector only.
    enh = []
    for path in sorted(glob.glob(os.path.join(ROOT, "tests", "samples", "*.jpg"))):
        base = cv2.imread(path)
        for vname in ("original", "synthetic_dim", "synthetic_dark"):
            img = VARIANTS[vname](base)
            a, b = detect(img), detect(enhance_contrast(img))
            enh.append({"image": os.path.basename(path), "variant": vname,
                        "raw": sorted(d["class_name"] for d in a), "clahe": sorted(d["class_name"] for d in b)})

    lat = [r["latency_ms"] for r in rows if r["outcome"] != "RETAKE_REQUIRED"]
    lat_retake = [r["latency_ms"] for r in rows if r["outcome"] == "RETAKE_REQUIRED"]
    out = {
        "opencv": cv2.__version__, "detector": model_name(), "cases": len(rows), "rows": rows,
        "clahe_comparison": enh,
        "latency_ms_full_loop_with_detection": {
            "n": len(lat), "median": round(statistics.median(lat), 1), "max": max(lat)} if lat else None,
        "latency_ms_retake_short_circuit": {
            "n": len(lat_retake), "median": round(statistics.median(lat_retake), 1)} if lat_retake else None,
        "note": "CPU, single thread, no ground truth: counts/outcomes only; no accuracy claimed.",
    }
    with open(os.path.join(ROOT, "tests", "eval_results.json"), "w") as f:
        json.dump(out, f, indent=2)

    print(f"OpenCV {out['opencv']} | detector {out['detector']}")
    for r in rows:
        print(f"{r['image'][:24]:24} {r['variant']:16} Q={r['quality_status']:15} -> {r['outcome']:30} "
              f"blocked={str(r['routing_blocked']):5} {r['latency_ms']:8.1f}ms  {r['actions']} {r['detections']}")
    print("CLAHE vs raw detections:")
    for e in enh:
        print(f"  {e['image'][:24]:24} {e['variant']:16} raw={e['raw']} clahe={e['clahe']}")
    print("latency", out["latency_ms_full_loop_with_detection"], out["latency_ms_retake_short_circuit"])


if __name__ == "__main__":
    main()
