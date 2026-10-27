"""OpenCV-based image quality validation for ReRoute evidence photos.

Every metric is computed from the decoded pixels with OpenCV/NumPy. Thresholds are
configurable (dataclass fields or QUALITY_* environment variables) and are *defaults*
that must be calibrated against real field photos; they are not tuned claims.
"""
import os
from dataclasses import dataclass, fields, asdict
from typing import Any, Dict, List, Optional

import cv2
import numpy as np

ACCEPT = "ACCEPT"
RETAKE_REQUIRED = "RETAKE_REQUIRED"
MANUAL_REVIEW = "MANUAL_REVIEW"

# Laplacian variance is measured on an image normalised to this long side so the
# score does not depend on how many pixels the phone camera produced.
BLUR_EVAL_LONG_SIDE = 640


@dataclass
class QualityConfig:
    # Resolution (shorter side, pixels)
    min_side_retake: int = 224
    min_side_review: int = 480
    # Sharpness: variance of Laplacian at BLUR_EVAL_LONG_SIDE
    blur_retake: float = 15.0
    blur_review: float = 50.0
    # Exposure: mean grey level (0-255)
    dark_retake: float = 35.0
    dark_review: float = 60.0
    bright_retake: float = 235.0
    bright_review: float = 210.0
    # Clipping: fraction of pixels that are near-black / near-white
    clipped_retake: float = 0.80
    clipped_review: float = 0.50
    # Contrast: standard deviation of grey level
    contrast_retake: float = 10.0
    contrast_review: float = 25.0

    @classmethod
    def from_env(cls) -> "QualityConfig":
        cfg = cls()
        for f in fields(cls):
            raw = os.getenv(f"QUALITY_{f.name.upper()}")
            if raw is not None:
                try:
                    setattr(cfg, f.name, type(getattr(cfg, f.name))(float(raw)))
                except ValueError:
                    pass
        return cfg


def _grade(value: float, retake: float, review: float, higher_is_worse: bool = False) -> str:
    if higher_is_worse:
        if value >= retake:
            return RETAKE_REQUIRED
        if value >= review:
            return MANUAL_REVIEW
    else:
        if value <= retake:
            return RETAKE_REQUIRED
        if value <= review:
            return MANUAL_REVIEW
    return ACCEPT


def compute_metrics(img: np.ndarray) -> Dict[str, float]:
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img

    long_side = max(h, w)
    scale = BLUR_EVAL_LONG_SIDE / long_side
    interp = cv2.INTER_AREA if scale < 1 else cv2.INTER_LINEAR
    norm = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=interp)

    mean, std = cv2.meanStdDev(gray)
    return {
        "width": int(w),
        "height": int(h),
        "min_side": int(min(h, w)),
        "laplacian_variance": float(cv2.Laplacian(norm, cv2.CV_64F).var()),
        "mean_brightness": float(mean[0][0]),
        "contrast_std": float(std[0][0]),
        "dark_fraction": float(np.mean(gray < 25)),
        "bright_fraction": float(np.mean(gray > 235)),
    }


def assess_image_quality(
    img: Optional[np.ndarray], config: Optional[QualityConfig] = None
) -> Dict[str, Any]:
    """Return {status, reasons, metrics, thresholds}. `img` is a BGR ndarray or None."""
    cfg = config or QualityConfig.from_env()
    if img is None or img.size == 0:
        return {
            "status": RETAKE_REQUIRED,
            "reasons": ["Image could not be decoded"],
            "metrics": {},
            "thresholds": asdict(cfg),
        }

    m = compute_metrics(img)
    checks: List[tuple] = [
        ("resolution", _grade(m["min_side"], cfg.min_side_retake, cfg.min_side_review),
         f"Low resolution ({m['width']}x{m['height']})"),
        ("blur", _grade(m["laplacian_variance"], cfg.blur_retake, cfg.blur_review),
         f"Image appears blurry (sharpness score {m['laplacian_variance']:.1f})"),
        ("dark", _grade(m["mean_brightness"], cfg.dark_retake, cfg.dark_review),
         f"Image is too dark (mean brightness {m['mean_brightness']:.0f}/255)"),
        ("bright", _grade(m["mean_brightness"], cfg.bright_retake, cfg.bright_review, True),
         f"Image is overexposed (mean brightness {m['mean_brightness']:.0f}/255)"),
        ("clipped_dark", _grade(m["dark_fraction"], cfg.clipped_retake, cfg.clipped_review, True),
         f"{m['dark_fraction']:.0%} of pixels are near-black"),
        ("clipped_bright", _grade(m["bright_fraction"], cfg.clipped_retake, cfg.clipped_review, True),
         f"{m['bright_fraction']:.0%} of pixels are near-white"),
        ("contrast", _grade(m["contrast_std"], cfg.contrast_retake, cfg.contrast_review),
         f"Very low contrast (std {m['contrast_std']:.1f})"),
    ]

    failed = [(n, s, msg) for n, s, msg in checks if s != ACCEPT]
    if any(s == RETAKE_REQUIRED for _, s, _ in failed):
        status = RETAKE_REQUIRED
    elif failed:
        status = MANUAL_REVIEW
    else:
        status = ACCEPT

    return {
        "status": status,
        "reasons": [f"{msg} [{s}]" for _, s, msg in failed],
        "failed_checks": {n: s for n, s, _ in failed},
        "metrics": {k: round(v, 4) if isinstance(v, float) else v for k, v in m.items()},
        "thresholds": asdict(cfg),
    }


def enhance_contrast(img: np.ndarray) -> np.ndarray:
    """CLAHE on the lightness channel. Returns a new array; the input is not modified."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return cv2.cvtColor(cv2.merge((clahe.apply(l), a, b)), cv2.COLOR_LAB2BGR)
