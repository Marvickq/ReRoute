import cv2
import numpy as np
import pytest

from api.quality import (ACCEPT, MANUAL_REVIEW, RETAKE_REQUIRED, QualityConfig,
                         assess_image_quality, enhance_contrast)
from tests.conftest import degrade


def test_opencv_is_version_5():
    assert cv2.__version__.startswith("5."), cv2.__version__


def test_real_unmodified_photos_are_accepted(samples):
    for name, img in samples.items():
        r = assess_image_quality(img, QualityConfig())
        assert r["status"] == ACCEPT, (name, r["reasons"], r["metrics"])


@pytest.mark.parametrize("kind,check", [("blur", "blur"), ("dark", "dark"), ("lowres", "resolution")])
def test_synthetically_degraded_real_photos_require_retake(samples, kind, check):
    for name, img in samples.items():
        r = assess_image_quality(degrade(img, kind), QualityConfig())
        assert r["status"] == RETAKE_REQUIRED, (name, kind, r["metrics"])
        assert r["failed_checks"].get(check) == RETAKE_REQUIRED


def test_overexposure_detected(clear_img):
    white = np.full_like(clear_img, 245)
    white[::7, ::7] = 200
    r = assess_image_quality(white, QualityConfig())
    assert r["status"] == RETAKE_REQUIRED and "bright" in r["failed_checks"]


def test_undecodable_image_requires_retake():
    assert assess_image_quality(None)["status"] == RETAKE_REQUIRED


def test_thresholds_are_configurable(clear_img):
    mild = cv2.GaussianBlur(clear_img, (0, 0), 3)
    strict = QualityConfig(blur_review=5000.0, blur_retake=1000.0)
    lax = QualityConfig(blur_review=1.0, blur_retake=0.5)
    assert assess_image_quality(mild, strict)["status"] == RETAKE_REQUIRED
    assert assess_image_quality(mild, lax)["status"] == ACCEPT


def test_marginal_quality_is_manual_review(clear_img):
    img = cv2.GaussianBlur(clear_img, (0, 0), 3)  # measured laplacian variance ~28.5: between 15 and 50
    r = assess_image_quality(img, QualityConfig())
    assert r["status"] == MANUAL_REVIEW, r["metrics"]


def test_env_override(monkeypatch):
    monkeypatch.setenv("QUALITY_BLUR_RETAKE", "123.5")
    monkeypatch.setenv("QUALITY_MIN_SIDE_RETAKE", "300")
    cfg = QualityConfig.from_env()
    assert cfg.blur_retake == 123.5 and cfg.min_side_retake == 300


def test_enhance_does_not_modify_input_and_raises_dark_brightness(clear_img):
    dark = degrade(clear_img, "dark")
    before = dark.copy()
    out = enhance_contrast(dark)
    assert np.array_equal(dark, before)
    assert out.shape == dark.shape and out.mean() > dark.mean()
