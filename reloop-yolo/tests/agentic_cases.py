"""Evaluation cases for the agentic inspection loop.

Cases A-E use REAL photos and the REAL detector. Case F/G need a safety-critical class (battery); the pretrained COCO
model has no such class and your trained best.pt is not in the repo, so those two use a SCRIPTED DETECTOR (test
double, clearly labelled) to exercise the safety branch. They say nothing about real detection accuracy.
"""
import os

import cv2

from api.detector import detect
from api.inspection import run_inspection
from tests.conftest import SAMPLES, degrade


def _load(name):
    return cv2.imread(os.path.join(SAMPLES, name))


class Scripted:
    def __init__(self, *responses):
        self.responses = list(responses)

    def __call__(self, arr, conf=None):
        r = self.responses.pop(0) if self.responses else []
        return [dict(d) for d in r]


def real(img):
    return run_inspection(img, lambda a, c=None: detect(a, c))


def cases():
    phone = _load("smartphone_blackview.jpg")
    h, w = phone.shape[:2]
    batt = lambda c: {"class_name": "battery", "confidence": c, "bbox": [300, 200, 700, 600]}  # noqa: E731
    return [
        ("A clear (real photo, real YOLO)", lambda: real(phone)),
        ("B blurry (real photo + synthetic blur)", lambda: real(degrade(phone, "blur"))),
        ("C ambiguous (real photo, low-confidence real detections)", lambda: real(_load("phone_scrap.jpg"))),
        ("D nothing detected (real photo)", lambda: real(_load("junk_separation_2.jpg"))),
        ("E truncated view (real photo cropped so phone is cut at top)", lambda: real(phone[150:, :])),
        ("F safety-critical, uncertain (SCRIPTED detector)",
         lambda: run_inspection(_load("phone_scrap.jpg"), Scripted([batt(0.30)], []))),
        ("G safety-critical, confident (SCRIPTED detector)",
         lambda: run_inspection(_load("phone_scrap.jpg"), Scripted([batt(0.95)]))),
    ]
