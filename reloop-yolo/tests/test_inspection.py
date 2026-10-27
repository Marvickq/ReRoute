"""Loop-logic tests.

`Scripted` is a TEST DOUBLE returning pre-set detections so every branch of the loop can be exercised
deterministically on real photos. Real-YOLO behaviour is measured in tests/eval_real.py and test_real_yolo.py.
"""
import numpy as np

from api.inspection import HUMAN_REVIEW, READY, RETAKE, InspectionConfig, run_inspection
from api.quality import QualityConfig
from tests.conftest import degrade


def det(name, conf, bbox=(100, 100, 500, 500)):
    return {"class_name": name, "confidence": conf, "bbox": list(bbox)}


class Scripted:
    """Returns responses in order and records every call (image shape, conf floor)."""

    def __init__(self, *responses):
        self.responses, self.calls = list(responses), []

    def __call__(self, arr, conf=None):
        self.calls.append((arr.shape, conf))
        r = self.responses.pop(0) if self.responses else []
        return [dict(d) for d in r]


def actions(res):
    return [s["action"] for s in res["steps"]]


def dim(img):
    return np.clip(img.astype(np.float32) * 0.45, 0, 255).astype(np.uint8)  # mean ~44


DIM_Q = QualityConfig(dark_retake=20.0, dark_review=40.0)  # lets the dim image past the retake gate


def test_clear_image_confident_detection_is_ready_for_human_verification(clear_img):
    res = run_inspection(clear_img, Scripted([det("cell phone", 0.91)]))
    assert res["outcome"] == READY and not res["routing_blocked"]
    assert actions(res) == ["run_detection", "proceed_to_human_verification"]
    assert res["human_verification_required"] is True
    assert res["quality"]["status"] == "ACCEPT"


def test_blurry_image_requests_retake_and_never_runs_detector(clear_img):
    d = Scripted([det("laptop", 0.9)])
    res = run_inspection(degrade(clear_img, "blur"), d)
    assert res["outcome"] == RETAKE and res["routing_blocked"]
    assert d.calls == [] and actions(res) == ["request_retake"]


def test_dark_image_requests_retake(clear_img):
    res = run_inspection(degrade(clear_img, "dark"), Scripted())
    assert res["outcome"] == RETAKE


def test_no_detections_on_bright_image_goes_to_human_review_without_enhancement(clear_img):
    res = run_inspection(clear_img, Scripted([]))
    assert actions(res) == ["run_detection", "request_human_review"]
    assert res["outcome"] == HUMAN_REVIEW and res["routing_blocked"]


def test_no_detections_on_dim_image_tries_enhancement_then_reviews(clear_img):
    d = Scripted([], [])
    res = run_inspection(dim(clear_img), d, quality_config=DIM_Q)
    assert actions(res) == ["run_detection", "enhance_and_redetect", "request_human_review"]
    assert len(d.calls) == 2 and res["enhancement_used"]
    assert res["outcome"] == HUMAN_REVIEW


def test_detection_found_only_after_enhancement_requires_human_review(clear_img):
    res = run_inspection(dim(clear_img), Scripted([], [det("laptop", 0.9)]), quality_config=DIM_Q)
    assert actions(res)[-1] == "request_human_review"
    assert res["outcome"] == HUMAN_REVIEW
    assert res["detections"][0]["found_after_enhancement"]


def test_uncertain_detection_confirmed_by_crop_proceeds(clear_img):
    d = Scripted([det("laptop", 0.31)], [det("laptop", 0.72)])
    res = run_inspection(clear_img, d)
    assert actions(res) == ["run_detection", "inspect_crop", "proceed_to_human_verification"]
    assert res["detections"][0]["crop_confirmed"] and res["outcome"] == READY
    assert d.calls[1][1] == InspectionConfig().crop_conf_floor  # crop re-detection used the lower floor
    assert min(d.calls[1][0][:2]) >= InspectionConfig().min_crop_side  # crop was upscaled


def test_uncertain_detection_not_confirmed_blocks_routing(clear_img):
    res = run_inspection(clear_img, Scripted([det("laptop", 0.31)], [det("keyboard", 0.9)]))
    assert actions(res) == ["run_detection", "inspect_crop", "request_human_review"]
    assert res["outcome"] == HUMAN_REVIEW and res["routing_blocked"]
    assert res["detections"][0]["uncertain"]


def test_unresolved_safety_critical_finding_blocks_routing(clear_img):
    res = run_inspection(clear_img, Scripted([det("battery", 0.3)], []))
    assert res["routing_blocked"]
    assert any("safety-critical" in r.lower() for r in res["blocking_reasons"])


def test_confident_safety_critical_detection_is_flagged_not_certified(clear_img):
    res = run_inspection(clear_img, Scripted([det("battery", 0.95)]))
    assert res["outcome"] == READY and not res["routing_blocked"]
    assert any("not a safety certification" in r for r in res["reasons"])
    assert res["human_verification_required"]


def test_iteration_budget_is_enforced(clear_img):
    res = run_inspection(clear_img, Scripted([det("laptop", 0.9)]), config=InspectionConfig(max_iterations=1))
    assert res["outcome"] == HUMAN_REVIEW and "budget" in res["reasons"][0]
    assert len([s for s in res["steps"] if s["action"] == "run_detection"]) == 1


def test_loop_follows_different_paths_for_different_inputs(clear_img):
    paths = {
        tuple(actions(run_inspection(clear_img, Scripted([det("laptop", 0.9)])))),
        tuple(actions(run_inspection(clear_img, Scripted([])))),
        tuple(actions(run_inspection(clear_img, Scripted([det("laptop", 0.3)], [])))),
        tuple(actions(run_inspection(degrade(clear_img, "blur"), Scripted()))),
    }
    assert len(paths) == 4


def test_original_image_is_never_modified(clear_img):
    before = clear_img.copy()
    run_inspection(clear_img, Scripted([det("laptop", 0.3)], [det("laptop", 0.8)]))
    run_inspection(degrade(clear_img, "dark"), Scripted([]))
    assert np.array_equal(clear_img, before)


def test_steps_record_timestamps_and_observations(clear_img):
    res = run_inspection(clear_img, Scripted([det("laptop", 0.9)]))
    for s in res["steps"]:
        assert s["timestamp"] and "latency_ms" in s and "observation" in s and s["decision"]
