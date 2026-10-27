"""End-to-end through the FastAPI app with the REAL YOLO model and real photos (no AWS credentials ->
Bedrock step uses the existing detection-based fallback, which the response labels honestly)."""
import base64
import os

import cv2
import pytest

pytest.importorskip("ultralytics")
pytest.importorskip("fastapi")
pytest.importorskip("multipart")
from fastapi.testclient import TestClient  # noqa: E402

from tests.conftest import SAMPLES, degrade  # noqa: E402


@pytest.fixture(scope="module")
def client(monkeypatch_module):
    for k in ("MY_AWS_ACCESS_KEY_ID", "REROUTE_AWS_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID"):
        monkeypatch_module.delenv(k, raising=False)
    from api.main import app
    return TestClient(app)


@pytest.fixture(scope="module")
def monkeypatch_module():
    from _pytest.monkeypatch import MonkeyPatch
    mp = MonkeyPatch()
    yield mp
    mp.undo()


def post(client, img_bytes, name="x.jpg"):
    return client.post("/material-analysis", files={"file": (name, img_bytes, "image/jpeg")}).json()


def test_health_reports_opencv_5(client):
    assert client.get("/").json()["opencv_version"].startswith("5.")


def test_good_photo_returns_inspection_and_visual_evidence(client):
    with open(os.path.join(SAMPLES, "smartphone_blackview.jpg"), "rb") as f:
        data = post(client, f.read())
    insp = data["inspection"]
    assert insp["quality"]["status"] == "ACCEPT" and insp["opencv_version"].startswith("5.")
    assert insp["outcome"] == "READY_FOR_HUMAN_VERIFICATION" and insp["human_verification_required"]
    assert [s["action"] for s in insp["steps"]][-1] == "proceed_to_human_verification"
    assert data["yolo"]["detections"] and data["bedrock"]["source"] == "detection-fallback"
    ev = data["visual_evidence"]
    ann = cv2.imdecode(__import__("numpy").frombuffer(base64.b64decode(ev["annotated_jpeg_b64"]), "uint8"), 1)
    assert ann is not None and ev["crops"] and ev["crops"][0]["class_name"] == data["yolo"]["detections"][0]["class_name"]


def test_blurry_photo_is_rejected_without_detection_or_invented_items(client):
    img = cv2.imread(os.path.join(SAMPLES, "smartphone_blackview.jpg"))
    ok, buf = cv2.imencode(".jpg", degrade(img, "blur"))
    data = post(client, buf.tobytes())
    assert data["inspection"]["outcome"] == "RETAKE_REQUIRED" and data["inspection"]["routing_blocked"]
    assert data["yolo"]["detections"] == [] and data["bedrock"]["items"] == []
    assert data["visual_evidence"] is None


def test_photo_with_no_detections_invents_no_items_and_blocks(client):
    with open(os.path.join(SAMPLES, "junk_separation_2.jpg"), "rb") as f:
        data = post(client, f.read())
    assert data["inspection"]["outcome"] == "HUMAN_REVIEW_REQUIRED" and data["inspection"]["routing_blocked"]
    assert data["bedrock"]["items"] == []


def test_undecodable_upload_requires_retake(client):
    data = post(client, b"not an image")
    assert data["inspection"]["outcome"] == "RETAKE_REQUIRED"
