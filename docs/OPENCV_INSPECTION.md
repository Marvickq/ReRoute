# OpenCV 5 Visual Inspection Layer

Adds an OpenCV 5 quality gate, bounded inspection loop and visual-evidence extraction around the existing
YOLO service (`reloop-yolo`), with backend enforcement in the Next.js app (`apps/web`).

> Automated output is **decision support**. It is never presented as verification or safety certification;
> a human verifies material before routing.

## Architecture

```
photo -> apps/web /api/evidence  (saved locally + Amazon S3 when configured; original never modified)
      -> /api/lots/:id/analyze -> reloop-yolo POST /material-analysis
            1. cv2.imread                                   (OpenCV 5)
            2. api/quality.py   quality gate                ACCEPT | MANUAL_REVIEW | RETAKE_REQUIRED
            3. api/inspection.py bounded loop (observation -> decision -> action -> outcome)
                 actions: run_detection, enhance_and_redetect (CLAHE on a copy), inspect_crop,
                          request_retake, request_human_review, proceed_to_human_verification
            4. existing YOLO detect()  (unchanged model, now also accepts ndarray + conf override)
            5. existing Bedrock interpretation (skipped when nothing detected / retake)
            6. api/evidence.py  annotated image + crops from the ORIGINAL image
      <- response adds `inspection` and `visual_evidence` (existing keys unchanged)
      -> lib/inspection.ts stores InspectionRecord on the lot; derived images saved via the existing
         evidence storage (local + S3), each referencing source_evidence_id and lot_id
      -> enforcement (backend): lib/safety.ts, lib/lifecycle.ts via lib/inspection-guard.ts
```

Outcomes: `READY_FOR_HUMAN_VERIFICATION`, `HUMAN_REVIEW_REQUIRED`, `RETAKE_REQUIRED`.
The loop is bounded by `INSPECTION_MAX_ITERATIONS` (default 4); exhausting it forces `HUMAN_REVIEW_REQUIRED`.

### Enforcement rules (server side)
- Unresolved inspection (`routing_blocked`) adds blocking reasons in `evaluateSafety` -> `/routing` returns blocked.
- `route`, `dispatch`, `receive` transitions are refused in `transitionLot` while unresolved.
- The inspector `unblock` override is refused while unresolved (it previously cleared everything unconditionally).
- `HUMAN_REVIEW_REQUIRED` is resolved only via `POST /api/lots/:id/inspection {action:"resolve", note}` (note required, event logged).
- `RETAKE_REQUIRED` cannot be overridden; a new photo (`action:"retake"`) must be uploaded and pass.
- A lot with a photo but no inspection result (service down/timeout) gets an "unavailable" inspection that blocks routing.
- Events recorded: `inspection_completed`, `inspection_resolved`, `inspection_retake_requested` (timestamps, reasons, evidence refs).

## Configuration
Quality: `QUALITY_<FIELD>` env vars (see `QualityConfig` in `api/quality.py`, e.g. `QUALITY_BLUR_RETAKE`).
Loop: `INSPECTION_MAX_ITERATIONS`, `INSPECTION_SUFFICIENT_CONFIDENCE`, `INSPECTION_CROP_CONF_FLOOR`,
`SAFETY_CRITICAL_CLASSES` (comma list; default includes `battery`). Threshold defaults are starting points,
calibrated only on the 5 sample photos below, and must be re-calibrated on real facility photos.

## Setup
```
cd reloop-yolo
pip install -r requirements.txt          # opencv-python>=5.0.0 (verified: 5.0.0 / wheel 5.0.0.93)
python -m pytest tests -q                # 33 tests, real YOLO weights are auto-downloaded on first run
python tests/eval_real.py                # measured evaluation -> tests/eval_results.json
cd ../apps/web
npm run test:inspection                  # backend enforcement tests (Node >= 22.18 / 24)
```
`YOLO_WEIGHTS` overrides the weights path. The repo does not contain the trained `best.pt`
(`runs/` is git-ignored), so the service falls back to pretrained COCO `yolov8n.pt` unless you provide it.

## AWS components actually used (from code, not live-verified here)
| Component | Where | Condition |
|---|---|---|
| Amazon S3 | `lib/s3.ts`, evidence + derived crops | only when AWS credentials are set |
| Amazon DynamoDB | `lib/dynamodb.ts` lot sync | only when credentials set |
| Amazon Bedrock (Nova Pro) | `reloop-yolo/api/bedrock.py`, `lib/bedrock.ts` | credentials needed; the service otherwise falls back to a detection-based mapping. Response now carries `bedrock.source` (`amazon-bedrock` or `detection-fallback`) so this is observable |
| EventBridge, CloudWatch Logs, Step Functions, Transcribe | `lib/events.ts` etc. | credentials; Step Functions and Transcribe log "Mock" when unconfigured |
| AWS Amplify | `amplify.yml` hosts `apps/web` | deployment |

The YOLO/OpenCV service itself runs on **Render** (`render.yaml`), not AWS. No AWS credentials were available in the
development session, so nothing AWS-side was exercised live here.
Caveat: the existing UI label `model_used = "yolov8n + amazon-nova"` is set whenever the YOLO URL is configured, even when
Bedrock was not actually called. Use `bedrock.source` for the truth.

## Synthetic data
- `apps/web/src/lib/facilities.ts` facilities are **synthetic demo data** (now labelled on the Facilities page).
- Test images in `reloop-yolo/tests/samples` are real Wikimedia Commons photos (see `SOURCES.md`), not ReRoute facility photos,
  and have no ground-truth labels. Blur/dark/low-res variants are synthetic degradations made with OpenCV at test time.

## Measured results (CPU, single thread, yolov8n.pt COCO, OpenCV 5.0.0) - `tests/eval_results.json`
25 cases (5 photos x original + 4 synthetic degradations):
- All 5 unmodified photos pass the quality gate (ACCEPT). All 5 blur(sigma 8), 5 dark(x0.15), 5 low-res(200px) variants -> `RETAKE_REQUIRED` in 11-57 ms with no detector call.
- Original photos: 1/5 -> `READY_FOR_HUMAN_VERIFICATION` (`cell phone` 0.67); 4/5 -> `HUMAN_REVIEW_REQUIRED` (3 had zero detections, 1 had two low-confidence detections `remote` 0.32 / `bicycle` 0.29 not confirmed by crop re-inspection).
- Latency, full loop incl. detection (n=9, warm model, CPU): median 0.9 s / max 2.2 s in the latest run (an earlier run on the same machine gave median 1.6 s: it varies with machine load); retake short-circuit median 12-26 ms.
- CLAHE contrast enhancement: **no demonstrated benefit**. It changed detections in 6/15 comparisons: it added unlikely classes (`cake` x2, `car`, `suitcase`), dropped `bicycle` on one original, and recovered `bicycle`/`remote` on one dimmed copy. Without ground truth none of these can be called an improvement. It is only used as a retry; anything found after enhancement is forced to human review.
- No precision/recall/mAP is reported: there is no ground truth.

### Failure cases / limitations (measured or observed)
- Pretrained COCO `yolov8n` is a poor fit for e-waste piles: no detections on 3/5 real photos and spurious classes (`cake`, `bicycle`, `microwave`). The loop contains this by routing to humans; it does not fix it. Evaluating the trained model requires `best.pt`.
- Laplacian-variance blur detection misses 31 px horizontal motion blur on busy scenes (still ACCEPT on 5/5 photos). A directional sharpness metric would be needed.
- Only the first photo of a lot is inspected. HEIC uploads may not decode with OpenCV (-> `RETAKE_REQUIRED`, "could not be decoded").
- Evidence images are served by the existing unauthenticated `/api/uploads/:filename` route (unguessable random names, no ACL). Real access control is not implemented.
- Lot state is in-memory plus best-effort DynamoDB sync (existing design).
- Render free tier cold start + the 12 s fetch timeout can yield an "inspection unavailable" record (blocks routing until a human resolves it).
- The Next.js app was **not** built or run end-to-end in this session (disk full; see below). Web logic was verified by Node tests on the real lib modules, TypeScript checks of the changed modules with the AWS/Next modules stubbed, and syntax checks of the rest.

## Agentic Vision layer
**Evidence-gap resolution.** The loop turns measured gaps into *targeted* requests (`evidence_requests` on the inspection):
- failed quality check -> instruction specific to that check (focus, light, glare, resolution);
- confident detection whose box touches an image edge (OpenCV/YOLO geometry) -> `wider_view` retake;
- uncertain safety-critical class after crop re-inspection -> `close_up` retake of that object;
- battery-bearing device detected -> `missing_view` *recommendation* (non-blocking: battery condition is not visible from one photo);
- anything else unresolved (no detections, low-confidence detections not confirmed by crop, found only after CLAHE, marginal quality, budget exhausted) -> human review.

**Audit trail** (`lot.audit_trail`, `GET /api/lots/:id/audit`): append-only, SHA-256 hash-chained (`lib/audit.ts`), so editing,
deleting or reordering an entry is detectable (`audit_chain.valid`). Entries: `observation`, `decision`, `tool_call`
(`opencv.assess_image_quality`, `yolo.detect`, `opencv.enhance_contrast_clahe`, `opencv.crop_upscale`, with args/result/latency),
`action`, `result`, `inspection_outcome` (links source + derived evidence ids and evidence requests), `human_approval`
(resolve / operator transitions), `retake`, `enforcement_block` (refused transitions) and `routing_decision`
(links inspection id, who resolved it, evidence ids, blocking reasons). The hash chain is tamper-*evident* only: it lives with the lot
(in-memory + best-effort DynamoDB), is not externally anchored, and an actor with write access could rewrite the whole chain.

### Agentic evaluation (`python tests/eval_agentic.py`, `tests/eval_agentic_results.json`)
| Case | Actions taken | Outcome |
|---|---|---|
| A clear real photo | run_detection -> proceed_to_human_verification | ready for human verification (+ non-blocking battery-view recommendation) |
| B blurry (synthetic blur of real photo) | request_retake (focus instruction), detector not called | RETAKE, blocked |
| C ambiguous real photo (`remote` 0.32, `bicycle` 0.29) | run_detection, inspect_crop x2, request_human_review | human review, blocked |
| D real photo, nothing detected | run_detection, request_human_review | human review, blocked |
| E real photo cropped so phone is cut at top | run_detection, request_targeted_retake (wider view) | RETAKE, blocked |
| F safety-critical uncertain **(scripted detector)** | run_detection, inspect_crop, request_targeted_retake (close-up) | RETAKE, blocked, safety-critical reason |
| G safety-critical confident **(scripted detector)** | run_detection, proceed_to_human_verification | ready for human verification, flagged "not a safety certification" |

6 of 6 distinct action sequences for A-F. F/G use a scripted detector because neither pretrained COCO nor the repo contains a battery class;
they verify the branch logic, not detection accuracy. Case E's crop is a synthetic edit of a real photo.

Tests this round: Python 40 passed (incl. 7 agentic); Node 13 passed (8 enforcement + 5 audit).
Not verified: the Next.js routes (`audit`, `inspection`, `routing`, `transition`, `analyze`) and the UI at runtime; only type-checked (AWS/Next modules stubbed) and the pure lib modules executed.

## Competition note (OpenCV 5)
OpenCV 5.0.0 does the substantive image work: decoding, grayscale/Laplacian sharpness, exposure and clipping statistics,
LAB/CLAHE enhancement, bicubic crop upscaling, rectangle/text annotation, crop extraction and JPEG encoding. The version is
reported at `GET /` and in every inspection record. Video analysis is **not** implemented.

## 2-minute demo
1. (0:00) Start service: `uvicorn api.main:app --port 8005`; `GET /` shows `opencv_version: 5.0.0`. Start web with `YOLO_API_URL=http://127.0.0.1:8005`.
2. (0:15) New Lot -> upload `tests/samples/smartphone_blackview.jpg` -> Analyze. Panel: quality ACCEPT, loop = run_detection -> proceed_to_human_verification, annotated image + crop, "Ready for human verification".
3. (0:45) New Lot -> upload a blurred copy (any phone photo defocused). Panel: RETAKE_REQUIRED, reasons, loop shows request_retake and no detection. Click Get Routing -> blocked. Try dispatch/unblock via API -> refused.
4. (1:15) Upload a retake (the sharp original) -> re-analyze -> new inspection recorded, previous kept in history.
5. (1:35) Upload `tests/samples/junk_separation_2.jpg` -> HUMAN_REVIEW_REQUIRED (no detections). Routing blocked; enter a note "inspected by hand" -> Record human inspection -> routing proceeds; the event log shows `inspection_resolved`.
6. (1:55) Show `tests/eval_results.json` / `pytest` summary and the "synthetic facility data" label.
