import pytest

pytest.importorskip("ultralytics")

from tests.agentic_cases import cases  # noqa: E402


@pytest.fixture(scope="module")
def results():
    return {name[0]: run() for name, run in ((c[0].split()[0:1], c[1]) for c in cases())}


def acts(r):
    return [s["action"] for s in r["steps"]]


def test_clear_case_proceeds_and_recommends_battery_view_without_blocking(results):
    r = results["A"]
    assert acts(r) == ["run_detection", "proceed_to_human_verification"]
    assert not r["routing_blocked"]
    assert [e["kind"] for e in r["evidence_requests"]] == ["missing_view"]
    assert r["evidence_requests"][0]["blocking"] is False


def test_blurry_case_gets_targeted_quality_retake(results):
    r = results["B"]
    assert acts(r) == ["request_retake"] and r["routing_blocked"]
    assert r["evidence_requests"][0]["kind"] == "quality_retake"
    assert "focus" in r["evidence_requests"][0]["instruction"].lower()


def test_ambiguous_case_inspects_crops_then_escalates_to_human(results):
    r = results["C"]
    assert acts(r)[0] == "run_detection" and "inspect_crop" in acts(r) and acts(r)[-1] == "request_human_review"
    assert r["routing_blocked"] and r["outcome"] == "HUMAN_REVIEW_REQUIRED"


def test_truncated_view_requests_wider_retake(results):
    r = results["E"]
    assert acts(r) == ["run_detection", "request_targeted_retake"]
    assert r["evidence_requests"][0]["kind"] == "wider_view" and r["routing_blocked"]


def test_uncertain_safety_critical_requests_close_up_and_blocks(results):
    r = results["F"]
    assert acts(r) == ["run_detection", "inspect_crop", "request_targeted_retake"]
    assert r["evidence_requests"][0]["kind"] == "close_up" and r["routing_blocked"]
    assert any("safety-critical" in b.lower() for b in r["blocking_reasons"])


def test_different_visual_results_produce_different_action_sequences(results):
    seqs = {k: tuple(acts(results[k])) for k in "ABCDEF"}
    assert len(set(seqs.values())) == 6, seqs


def test_every_step_logs_tool_calls_with_latency(results):
    for k, r in results.items():
        for s in r["steps"][:-1] if r["steps"][-1]["tool_calls"] == [] else r["steps"]:
            for c in s["tool_calls"]:
                assert c["tool"].startswith(("opencv.", "yolo.")) and "latency_ms" in c and "result" in c
    assert results["C"]["steps"][1]["tool_calls"][0]["tool"] == "opencv.crop_upscale"
