import cv2
import numpy as np

from api.evidence import annotate_detections, build_visual_evidence, crop_detection


def test_annotation_draws_on_copy_only(clear_img):
    before = clear_img.copy()
    dets = [{"class_name": "cell phone", "confidence": 0.9, "bbox": [50, 60, 400, 500]}]
    out = annotate_detections(clear_img, dets)
    assert np.array_equal(clear_img, before)
    assert not np.array_equal(out, clear_img)


def test_crop_matches_bbox_and_clamps_to_image(clear_img):
    h, w = clear_img.shape[:2]
    assert crop_detection(clear_img, [-50, -50, 200, 200], pad=0.0).shape[:2] == (200, 200)
    assert crop_detection(clear_img, [w - 100, h - 100, w + 500, h + 500], pad=0.0).shape[:2] == (100, 100)


def test_visual_evidence_bundle(clear_img):
    dets = [{"class_name": "a", "confidence": 0.9, "bbox": [10, 10, 300, 300]},
            {"class_name": "b", "confidence": 0.4, "bbox": [20, 20, 22, 22]}]  # degenerate -> skipped
    ev = build_visual_evidence(clear_img, dets)
    assert cv2.imdecode(np.frombuffer(ev["annotated_jpeg"], np.uint8), 1) is not None
    assert [c["class_name"] for c in ev["crops"]] == ["a"]
    assert ev["crops"][0]["detection_index"] == 0
