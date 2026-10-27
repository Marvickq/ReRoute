import glob
import os
import sys

import cv2
import numpy as np
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
SAMPLES = os.path.join(ROOT, "tests", "samples")


def degrade(img, kind):
    """Synthetic degradations applied with OpenCV to REAL photos (labelled synthetic in test names)."""
    if kind == "blur":
        return cv2.GaussianBlur(img, (0, 0), 8)
    if kind == "dark":
        return np.clip(img.astype(np.float32) * 0.15, 0, 255).astype(np.uint8)
    if kind == "lowres":
        s = 200 / min(img.shape[:2])
        return cv2.resize(img, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    raise ValueError(kind)


@pytest.fixture(scope="session")
def samples():
    paths = sorted(glob.glob(os.path.join(SAMPLES, "*.jpg")))
    assert paths, "real sample images missing from tests/samples"
    return {os.path.basename(p): cv2.imread(p, cv2.IMREAD_COLOR) for p in paths}


@pytest.fixture(scope="session")
def clear_img(samples):
    return samples["phone_scrap.jpg"]
