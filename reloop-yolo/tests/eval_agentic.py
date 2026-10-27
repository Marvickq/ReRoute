"""Run the agentic cases and print/write the measured action sequences.   python tests/eval_agentic.py"""
import json
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import cv2  # noqa: E402
import numpy as np  # noqa: E402
from api.detector import detect, model_name  # noqa: E402
from tests.agentic_cases import cases  # noqa: E402


def main():
    detect(np.zeros((64, 64, 3), np.uint8))  # warm-up
    rows = []
    for name, run in cases():
        t = time.perf_counter()
        r = run()
        ms = round((time.perf_counter() - t) * 1000, 1)
        rows.append({
            "case": name, "outcome": r["outcome"], "routing_blocked": r["routing_blocked"],
            "actions": [s["action"] for s in r["steps"]],
            "tools": [c["tool"] for s in r["steps"] for c in s["tool_calls"]],
            "evidence_requests": [e["instruction"] for e in r["evidence_requests"]],
            "detections": [(d["class_name"], d["confidence"]) for d in r["detections"]],
            "latency_ms": ms})
    out = {"opencv": cv2.__version__, "detector": model_name(), "rows": rows,
           "distinct_action_sequences_A_to_F": len({tuple(r["actions"]) for r in rows[:6]})}
    with open(os.path.join(ROOT, "tests", "eval_agentic_results.json"), "w") as f:
        json.dump(out, f, indent=2)
    print(f"OpenCV {out['opencv']} | {out['detector']}")
    for r in rows:
        print(f"\n{r['case']}\n  outcome={r['outcome']} blocked={r['routing_blocked']} {r['latency_ms']}ms\n"
              f"  actions={r['actions']}\n  detections={r['detections']}\n  requests={r['evidence_requests']}")
    print("\ndistinct action sequences (A-F):", out["distinct_action_sequences_A_to_F"], "of 6")


if __name__ == "__main__":
    main()
