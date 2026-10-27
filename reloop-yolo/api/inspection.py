"""Bounded observation -> decision -> action -> outcome inspection loop.

The path taken is determined by the measured image quality and the actual detector output;
nothing is scripted. Supported actions (the only operations the loop can perform):

  run_detection, enhance_and_redetect, inspect_crop,
  request_retake, request_targeted_retake, request_human_review, proceed_to_human_verification

The loop never marks anything "verified": its best outcome is READY_FOR_HUMAN_VERIFICATION.
"""
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Set

import cv2
import numpy as np

from api.quality import (
    ACCEPT, MANUAL_REVIEW, RETAKE_REQUIRED, QualityConfig, assess_image_quality, enhance_contrast,
)

READY = "READY_FOR_HUMAN_VERIFICATION"
HUMAN_REVIEW = "HUMAN_REVIEW_REQUIRED"
RETAKE = "RETAKE_REQUIRED"

DEFAULT_SAFETY_CLASSES = "battery,power bank,lithium battery,lithium_battery,swollen battery"

DetectFn = Callable[[np.ndarray, Optional[float]], List[Dict[str, Any]]]


@dataclass
class InspectionConfig:
    max_iterations: int = 4
    sufficient_confidence: float = 0.50     # detections at/above this need no extra inspection
    crop_conf_floor: float = 0.15           # detector floor when re-inspecting a crop
    enhance_if_mean_below: float = 90.0     # CLAHE retry only offered for dark/low-contrast images
    enhance_if_contrast_below: float = 45.0
    min_crop_side: int = 320                # crops are upscaled to this before re-detection
    safety_critical_classes: Set[str] = field(
        default_factory=lambda: {c.strip().lower() for c in DEFAULT_SAFETY_CLASSES.split(",")})

    @classmethod
    def from_env(cls) -> "InspectionConfig":
        cfg = cls()
        for name, cast in (("max_iterations", int), ("sufficient_confidence", float),
                           ("crop_conf_floor", float), ("enhance_if_mean_below", float),
                           ("enhance_if_contrast_below", float), ("min_crop_side", int)):
            raw = os.getenv(f"INSPECTION_{name.upper()}")
            if raw is not None:
                try:
                    setattr(cfg, name, cast(float(raw)))
                except ValueError:
                    pass
        raw = os.getenv("SAFETY_CRITICAL_CLASSES")
        if raw:
            cfg.safety_critical_classes = {c.strip().lower() for c in raw.split(",") if c.strip()}
        return cfg


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _area(d: Dict[str, Any]) -> float:
    x1, y1, x2, y2 = d["bbox"]
    return max(0.0, x2 - x1) * max(0.0, y2 - y1)



# Device classes that usually contain a battery: a second view of the battery area is *recommended*
# (non-blocking) because the detector cannot see inside a device.
BATTERY_BEARING = {"cell phone", "laptop", "tablet", "mobile_phone", "remote", "battery"}
EDGE_MARGIN_FRAC = 0.01


def _upscale(crop: np.ndarray, min_side: int) -> np.ndarray:
    s = min_side / max(1, min(crop.shape[:2]))
    return cv2.resize(crop, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC) if s > 1 else crop


def _touches_edge(d: Dict[str, Any], shape) -> List[str]:
    h, w = shape[:2]
    m = EDGE_MARGIN_FRAC * min(h, w)
    x1, y1, x2, y2 = d["bbox"]
    return [n for n, hit in (("left", x1 <= m), ("top", y1 <= m), ("right", x2 >= w - m), ("bottom", y2 >= h - m)) if hit]


def _quality_requests(q: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Targeted retake instructions derived from which quality checks actually failed."""
    tips = {
        "blur": "Hold the camera steady and tap to focus on the material, then retake.",
        "dark": "Retake with more light (move to a lit area or use a lamp); avoid shadows on the material.",
        "bright": "Retake with less glare/overexposure (avoid direct flash or sunlight on the surface).",
        "clipped_dark": "Retake with more light; large parts of the frame are black.",
        "clipped_bright": "Retake with less glare; large parts of the frame are blown out.",
        "contrast": "Retake against a plain, evenly lit background.",
        "resolution": "Move closer or use a higher-resolution camera setting; the image is too small.",
    }
    out = []
    for n, grade in q.get("failed_checks", {}).items():
        if grade != RETAKE_REQUIRED:
            continue
        out.append({"kind": "quality_retake", "check": n, "instruction": tips.get(n, "Retake the photo."),
                    "reason": next((r for r in q["reasons"]), n)})
    return out or [{"kind": "quality_retake", "check": "decode", "instruction": "Upload a valid JPEG/PNG photo.",
                    "reason": "; ".join(q["reasons"])}]


def _decide(state: Dict[str, Any], cfg: InspectionConfig) -> Dict[str, Any]:
    """Pick the next action and say why, from the current observation only."""
    q = state["quality"]
    dets = state["detections"]
    if q["status"] == RETAKE_REQUIRED:
        return {"action": "request_retake", "reason": "; ".join(q["reasons"]) or "unusable image"}
    if dets is None:
        return {"action": "run_detection", "reason": f"image quality {q['status']}; no detections yet"}
    if not dets:
        m = q["metrics"]
        can_enhance = (not state["enhanced"]) and (
            m["mean_brightness"] < cfg.enhance_if_mean_below
            or m["contrast_std"] < cfg.enhance_if_contrast_below)
        if can_enhance:
            return {"action": "enhance_and_redetect",
                    "reason": f"no detections and image is dim/low-contrast "
                              f"(mean {m['mean_brightness']:.0f}, std {m['contrast_std']:.0f})"}
        return {"action": "request_human_review", "reason": "no objects detected"}
    unresolved = [i for i, d in enumerate(dets)
                  if d["confidence"] < cfg.sufficient_confidence and not d.get("crop_checked")]
    if unresolved:
        i = max(unresolved, key=lambda k: _area(dets[k]))
        d = dets[i]
        return {"action": "inspect_crop", "target": i,
                "reason": f"{d['class_name']} confidence {d['confidence']:.2f} "
                          f"< {cfg.sufficient_confidence:.2f}; inspecting crop"}
    still_unsure = [d for d in dets
                    if d["confidence"] < cfg.sufficient_confidence and not d.get("crop_confirmed")]
    unsure_safety = [d for d in still_unsure if d["class_name"].lower() in cfg.safety_critical_classes]
    if unsure_safety:
        d = unsure_safety[0]
        return {"action": "request_targeted_retake", "target_detection": d, "kind": "close_up",
                "instruction": f"Take a well-lit close-up of the suspected {d['class_name']} (fill the frame, "
                               f"include any labels and visible swelling/damage).",
                "reason": f"possible safety-critical {d['class_name']} (confidence {d['confidence']:.2f}) "
                          f"not confirmed by crop inspection; a closer view is needed"}
    if still_unsure:
        return {"action": "request_human_review",
                "reason": "crop inspection did not confirm: "
                          + ", ".join(sorted({d['class_name'] for d in still_unsure}))}
    if any(d.get("found_after_enhancement") for d in dets):
        return {"action": "request_human_review",
                "reason": "objects were only detected after contrast enhancement"}
    cut = [(d, _touches_edge(d, state["shape"])) for d in dets]
    cut = [(d, e) for d, e in cut if e]
    if cut:
        d, edges = cut[0]
        return {"action": "request_targeted_retake", "target_detection": d, "kind": "wider_view",
                "instruction": f"The {d['class_name']} is cut off at the {'/'.join(edges)} edge; retake from "
                               f"further away so the whole object is in frame.",
                "reason": f"{d['class_name']} bounding box touches the {'/'.join(edges)} image edge (truncated view)"}
    if q["status"] == MANUAL_REVIEW:
        return {"action": "request_human_review",
                "reason": "marginal image quality: " + "; ".join(q["reasons"])}
    return {"action": "proceed_to_human_verification",
            "reason": f"{len(dets)} detection(s) at/above {cfg.sufficient_confidence:.2f} on an acceptable image"}


def _det_summary(dets: Optional[List[Dict[str, Any]]], shape) -> Optional[List[Dict[str, Any]]]:
    if dets is None:
        return None
    h, w = shape[:2]
    return [{"class_name": d["class_name"], "confidence": d["confidence"],
             "area_fraction": round(_area(d) / float(h * w), 4),
             "touches_edge": _touches_edge(d, shape)} for d in dets]


def _dsum(r):
    return [{"class_name": d["class_name"], "confidence": d["confidence"]} for d in r]


def run_inspection(
    img: Optional[np.ndarray],
    detect_fn: DetectFn,
    quality_config: Optional[QualityConfig] = None,
    config: Optional[InspectionConfig] = None,
) -> Dict[str, Any]:
    """Run the loop. `detect_fn(ndarray, conf_or_None)` returns detections as produced by detector.detect().

    Every step records: observation, decision (+reason), tool_calls (name/args/result/latency), action, outcome.
    Returns outcome, routing_blocked, blocking_reasons, reasons, evidence_requests, detections, steps, quality,
    timings; `working_image` is the array the final boxes refer to (the original is never overwritten).
    """
    cfg = config or InspectionConfig.from_env()
    t0 = time.perf_counter()
    started = _now()
    tq = time.perf_counter()
    quality = assess_image_quality(img, quality_config)
    quality_call = {"tool": "opencv.assess_image_quality",
                    "args": {"shape": None if img is None else list(img.shape)},
                    "result": {"status": quality["status"], "failed_checks": quality.get("failed_checks", {})},
                    "latency_ms": round((time.perf_counter() - tq) * 1000, 1)}
    shape = img.shape if img is not None else (0, 0, 3)
    state: Dict[str, Any] = {"quality": quality, "detections": None, "enhanced": False, "shape": shape}
    steps: List[Dict[str, Any]] = []
    requests: List[Dict[str, Any]] = []
    working = img
    outcome: Optional[str] = None
    reasons: List[str] = []

    for iteration in range(1, cfg.max_iterations + 1):
        dets = state["detections"]
        observation = {"quality_status": quality["status"],
                       "quality_metrics": quality["metrics"] if iteration == 1 else None,
                       "detections": _det_summary(dets, shape)}
        decision = _decide(state, cfg)
        action = decision["action"]
        ts = time.perf_counter()
        calls: List[Dict[str, Any]] = [quality_call] if iteration == 1 else []
        step: Dict[str, Any] = {"iteration": iteration, "timestamp": _now(), "observation": observation,
                                "decision": decision["reason"], "action": action, "tool_calls": calls}

        def tool(name, args, fn, summarize):
            t = time.perf_counter()
            res = fn()
            calls.append({"tool": name, "args": args, "result": summarize(res),
                          "latency_ms": round((time.perf_counter() - t) * 1000, 1)})
            return res

        if action == "request_retake":
            outcome, reasons = RETAKE, quality["reasons"]
            reqs = _quality_requests(quality)
            requests.extend(reqs)
            step["outcome"] = "stopped: targeted retake requested - " + " ".join(r["instruction"] for r in reqs)
        elif action == "run_detection":
            state["detections"] = tool("yolo.detect", {"conf": None}, lambda: detect_fn(working, None), _dsum)
            step["outcome"] = f"{len(state['detections'])} detection(s)"
        elif action == "enhance_and_redetect":
            enhanced = tool("opencv.enhance_contrast_clahe", {}, lambda: enhance_contrast(img),
                            lambda r: {"mean_before": round(float(img.mean()), 1),
                                       "mean_after": round(float(r.mean()), 1)})
            new = tool("yolo.detect", {"on": "clahe_copy"}, lambda: detect_fn(enhanced, None), _dsum)
            state["enhanced"] = True
            if new:
                for d in new:
                    d["found_after_enhancement"] = True
                state["detections"], working = new, enhanced
            step["outcome"] = f"{len(new)} detection(s) after CLAHE (on a copy; original untouched)"
        elif action == "inspect_crop":
            from api.evidence import crop_detection
            d = state["detections"][int(decision["target"])]
            crop = tool("opencv.crop_upscale", {"bbox": d["bbox"], "min_side": cfg.min_crop_side},
                        lambda: _upscale(crop_detection(working, d["bbox"]), cfg.min_crop_side),
                        lambda r: {"shape": list(r.shape)})
            sub = tool("yolo.detect", {"conf": cfg.crop_conf_floor, "on": "crop"},
                       lambda: detect_fn(crop, cfg.crop_conf_floor), _dsum)
            best = max((s["confidence"] for s in sub if s["class_name"] == d["class_name"]), default=0.0)
            d["crop_checked"] = True
            d["crop_confidence"] = round(best, 4)
            d["crop_confirmed"] = best >= cfg.sufficient_confidence
            d["uncertain"] = not d["crop_confirmed"]
            step["outcome"] = (f"crop re-detection: best {d['class_name']} {best:.2f} -> "
                               f"{'confirmed' if d['crop_confirmed'] else 'not confirmed'}")
        elif action == "request_targeted_retake":
            d = decision["target_detection"]
            requests.append({"kind": decision["kind"], "instruction": decision["instruction"],
                             "reason": decision["reason"], "target_class": d["class_name"],
                             "target_bbox": d["bbox"]})
            outcome, reasons = RETAKE, [decision["reason"]]
            step["outcome"] = "stopped: targeted retake requested - " + decision["instruction"]
        elif action == "request_human_review":
            outcome, reasons = HUMAN_REVIEW, [decision["reason"]]
            step["outcome"] = "stopped: human review requested"
        elif action == "proceed_to_human_verification":
            outcome, reasons = READY, [decision["reason"]]
            step["outcome"] = "stopped: evidence sufficient for human verification"

        step["latency_ms"] = round((time.perf_counter() - ts) * 1000, 1)
        steps.append(step)
        if outcome:
            break

    if outcome is None:
        outcome = HUMAN_REVIEW
        reasons = [f"iteration budget ({cfg.max_iterations}) exhausted without sufficient evidence"]
        steps.append({"iteration": cfg.max_iterations + 1, "timestamp": _now(), "observation": {},
                      "decision": reasons[0], "action": "request_human_review", "tool_calls": [],
                      "outcome": "stopped: budget exhausted", "latency_ms": 0.0})

    dets = state["detections"] or []
    blocking: List[str] = []
    if outcome == RETAKE:
        blocking.append("Evidence gap: a targeted retake is required before routing ("
                        + " ".join(r["instruction"] for r in requests) + ")")
    for d in dets:
        if d["class_name"].lower() in cfg.safety_critical_classes and not (
                d["confidence"] >= cfg.sufficient_confidence or d.get("crop_confirmed")):
            blocking.append(f"Unresolved safety-critical finding: {d['class_name']} "
                            f"(confidence {d['confidence']:.2f}) needs physical inspection")
    if outcome == HUMAN_REVIEW:
        blocking.append("Inspection could not establish sufficient visual evidence; human review required before routing")
    safety_present = [d["class_name"] for d in dets if d["class_name"].lower() in cfg.safety_critical_classes]
    if safety_present:
        reasons.append("Safety-critical class detected (" + ", ".join(sorted(set(safety_present)))
                       + "); detector output is not a safety certification")
    # Non-blocking recommendation: the detector cannot see inside devices, so suggest a battery-area view.
    bearing = sorted({d["class_name"] for d in dets
                      if d["class_name"].lower() in BATTERY_BEARING and d["confidence"] >= cfg.sufficient_confidence})
    if bearing and outcome == READY:
        requests.append({"kind": "missing_view", "blocking": False,
                         "instruction": "Recommended: add a photo of the back / battery compartment of the "
                                        + ", ".join(bearing) + " (battery condition is not visible from this view).",
                         "reason": "battery-bearing device detected; battery condition cannot be assessed from this image"})

    return {
        "outcome": outcome,
        "routing_blocked": bool(blocking),
        "blocking_reasons": blocking,
        "reasons": reasons,
        "evidence_requests": requests,
        "human_verification_required": True,
        "detections": dets,
        "quality": quality,
        "steps": steps,
        "iterations": len(steps),
        "max_iterations": cfg.max_iterations,
        "started_at": started,
        "finished_at": _now(),
        "timings_ms": {"total": round((time.perf_counter() - t0) * 1000, 1)},
        "working_image": working,
        "enhancement_used": state["enhanced"],
    }
