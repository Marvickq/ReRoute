import os
# Restrict multi-threading BEFORE importing torch/ultralytics to keep RAM < 250MB on Render
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"
os.environ["TORCH_NUM_THREADS"] = "1"
os.environ["YOLO_VERBOSE"] = "False"

import gc
import base64
import time
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Header
from typing import Optional
from tempfile import NamedTemporaryFile
import shutil

from api.detector import detect, model_name
from api.inspection import run_inspection, RETAKE
from api.evidence import build_visual_evidence
from api.bedrock import interpret_detections, generate_fallback_intelligence

app = FastAPI(title="ReLoop YOLO API")

@app.get("/")
def health_check():
    return {
        "status": "ok",
        "service": "ReLoop YOLO",
        "opencv_version": cv2.__version__,
    }

@app.post("/material-analysis")
async def material_analysis(
    file: UploadFile = File(...),
    x_aws_access_key_id: Optional[str] = Header(None),
    x_aws_secret_access_key: Optional[str] = Header(None),
    x_aws_region: Optional[str] = Header(None)
):
    suffix = os.path.splitext(file.filename or "image.jpg")[1]
    if not suffix:
        suffix = ".jpg"

    with NamedTemporaryFile(delete=False, suffix=suffix) as temp:
        shutil.copyfileobj(file.file, temp)
        temp_path = temp.name

    try:
        # Step 0: decode with OpenCV (the uploaded file itself is never modified)
        img = cv2.imread(temp_path, cv2.IMREAD_COLOR)

        # Step 1: quality gate + bounded inspection loop around the existing YOLO detect()
        t_start = time.perf_counter()
        detections = []
        inspection = None
        try:
            inspection = run_inspection(img, lambda arr, conf=None: detect(arr, conf))
            detections = inspection["detections"]
        except Exception as det_err:
            print(f"[YOLO API Warning] Detection failed: {det_err}")

        # Step 2: Bedrock interpretation (with detection-based fallback).
        # Skipped when a retake is required or nothing was detected, so no items are invented.
        material_intelligence = {"items": [], "hazard_signals": []}
        if detections:
            try:
                material_intelligence = interpret_detections(
                    detections,
                    aws_access_key=x_aws_access_key_id,
                    aws_secret_key=x_aws_secret_access_key,
                    aws_region=x_aws_region
                )
            except Exception as err:
                print(f"[YOLO API Error] Error interpreting detections: {err}")
                material_intelligence = generate_fallback_intelligence(detections)

        # Step 2b: OpenCV visual evidence from the real detections (original image, not the enhanced copy)
        visual = None
        if inspection is not None and img is not None and inspection["outcome"] != RETAKE:
            ev = build_visual_evidence(img, detections)
            visual = {
                "annotated_jpeg_b64": base64.b64encode(ev["annotated_jpeg"]).decode(),
                "crops": [{**{k: v for k, v in c.items() if k != "jpeg"},
                           "jpeg_b64": base64.b64encode(c["jpeg"]).decode()} for c in ev["crops"]],
            }
        if inspection is not None:
            inspection = {k: v for k, v in inspection.items() if k != "working_image"}
            inspection["timings_ms"]["request_total"] = round((time.perf_counter() - t_start) * 1000, 1)
            inspection["opencv_version"] = cv2.__version__
            inspection["detector"] = model_name()

        # Step 3: Combined response
        return {
            "success": True,
            "filename": file.filename,
            "yolo": {
                "detections": detections
            },
            "bedrock": material_intelligence,
            "inspection": inspection,
            "visual_evidence": visual,
        }
    except Exception as fatal_err:
        print(f"[YOLO API Fatal Error] {fatal_err}")
        return {
            "success": True,
            "filename": file.filename,
            "yolo": { "detections": [] },
            "bedrock": generate_fallback_intelligence([])
        }
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        gc.collect()