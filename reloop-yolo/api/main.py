from fastapi import FastAPI, UploadFile, File
from tempfile import NamedTemporaryFile
import shutil
import os

from api.detector import detect
from api.bedrock import interpret_detections


app = FastAPI(title="ReLoop YOLO API")


@app.get("/")
def health_check():
    return {
        "status": "ok",
        "service": "ReLoop YOLO"
    }


@app.post("/material-analysis")
async def material_analysis(file: UploadFile = File(...)):

    suffix = os.path.splitext(file.filename)[1]

    with NamedTemporaryFile(delete=False, suffix=suffix) as temp:
        shutil.copyfileobj(file.file, temp)
        temp_path = temp.name

    try:

        # -----------------------------------------
        # Step 1: YOLO detection
        # -----------------------------------------

        detections = detect(temp_path)

        # -----------------------------------------
        # Step 2: Bedrock interpretation
        # -----------------------------------------

        material_intelligence = interpret_detections(
            detections
        )

        # -----------------------------------------
        # Step 3: Combined response
        # -----------------------------------------

        return {
            "success": True,
            "filename": file.filename,

            "yolo": {
                "detections": detections
            },

            "bedrock": material_intelligence
        }

    finally:
        os.remove(temp_path)