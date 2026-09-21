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
from fastapi import FastAPI, UploadFile, File, Header
from typing import Optional
from tempfile import NamedTemporaryFile
import shutil

from api.detector import detect
from api.bedrock import interpret_detections, generate_fallback_intelligence

app = FastAPI(title="ReLoop YOLO API")

@app.get("/")
def health_check():
    return {
        "status": "ok",
        "service": "ReLoop YOLO"
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
        # Step 1: YOLO detection (with exception guard)
        detections = []
        try:
            detections = detect(temp_path)
        except Exception as det_err:
            print(f"[YOLO API Warning] Detection failed: {det_err}")

        # Step 2: Bedrock interpretation (with detection-based fallback)
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

        # Step 3: Combined response
        return {
            "success": True,
            "filename": file.filename,
            "yolo": {
                "detections": detections
            },
            "bedrock": material_intelligence
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