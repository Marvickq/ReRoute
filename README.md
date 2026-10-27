# ♻️ ReRoute

### Evidence-driven e-waste inspection and traceability

ReRoute turns physical e-waste evidence into structured material records
that can be reviewed, routed, and tracked through a Digital Material
Passport.

> **AI interprets evidence. Humans resolve uncertainty. Deterministic
> rules control the workflow. The audit trail records the journey.**


**Core technologies:** OpenCV 5, YOLOv8, FastAPI, Next.js, Amazon
Bedrock\
**Important deployment note:** The web app and vision service are
separate deployments. The FastAPI/OpenCV/YOLO vision service currently
runs on **Render, not AWS**. AWS integrations are
configuration-dependent and must be verified in the target environment
before being described as live.

------------------------------------------------------------------------

## Contents

-   [Problem and solution](#problem-and-solution)
-   [Key capabilities](#key-capabilities)
-   [Architecture](#architecture)
-   [Agentic inspection loop](#agentic-inspection-loop)
-   [Technology stack](#technology-stack)
-   [Repository layout](#repository-layout)
-   [Prerequisites](#prerequisites)
-   [Pinned dependencies](#pinned-dependencies)
-   [Local development](#local-development)
-   [Configuration](#configuration)
-   [Tests and evaluation](#tests-and-evaluation)
-   [Deployment](#deployment)
-   [Limitations and responsible use](#limitations-and-responsible-use)


------------------------------------------------------------------------

## Problem and solution

E-waste often arrives mixed, damaged, or poorly documented. Before it
can be responsibly handled, operators need evidence about visible
objects, material characteristics, uncertainty, required review, and
compatible downstream facilities.

ReRoute links the journey:

**Capture → Image quality gate → Object detection → Structured
interpretation → Human verification → Deterministic safety checks →
Facility routing → Lifecycle tracking → Digital Material Passport**

The prototype uses synthetic facility data. It does not claim that a
photo alone can establish hidden chemical composition, exact weight,
battery condition, or whether an item is safe.

## Key capabilities

-   **Evidence capture:** photo, text, and voice-note workflow.
-   **OpenCV quality gate:** image decoding, resolution, blur, exposure,
    and clipping checks.
-   **Visual evidence:** annotated images and crops associated with
    detections.
-   **YOLO detection:** visible-object classes, confidence values, and
    bounding boxes.
-   **Bounded inspection loop:** image quality and detector results
    influence the next step.
-   **Human verification:** uncertain results require operator review.
-   **Deterministic controls:** unresolved inspection and safety states
    block downstream actions.
-   **Material traceability:** lot lifecycle, evidence, decisions, and
    Digital Material Passport.
-   **Cloud integrations:** S3, DynamoDB, Bedrock, EventBridge, and
    related services when correctly configured.

------------------------------------------------------------------------

## Architecture

The diagram distinguishes the AWS application/integration layer from the
separately hosted vision service. Solid arrows show the intended data
flow; actual cloud integration depends on environment configuration.

``` mermaid
flowchart LR
    U["Collector / Inspector<br/>Photo · Voice · Text"] --> WEB

    subgraph AWS["AWS application and integration layer"]
        WEB["AWS Amplify<br/>Next.js web app / API routes"]
        GUARD["Deterministic controls<br/>Safety · Lifecycle · Inspection guard"]
        S3[("Amazon S3<br/>Evidence files")]
        DDB[("Amazon DynamoDB<br/>Lots · Passport · Audit")]
        EB["Amazon EventBridge"]
        SF["AWS Step Functions"]
        LAMBDA["API Gateway + Lambda<br/>(where deployed/configured)"]
        BR["Amazon Bedrock<br/>Nova Pro"]
        CW["Amazon CloudWatch"]
        TR["Amazon Transcribe"]
        WEB --> GUARD
        WEB -. configured integration .-> S3
        WEB -. configured integration .-> DDB
        WEB -. configured integration .-> EB
        EB -. configured integration .-> SF
        WEB -. configured integration .-> TR
        WEB -. configured integration .-> LAMBDA
        WEB -. configured integration .-> BR
        SF -. configured integration .-> BR
        WEB -. logs/observability .-> CW
    end

    WEB -->|"inspection request / image"| VISION

    subgraph RENDER["Separate vision service — Render, not AWS"]
        VISION["FastAPI service"]
        QUALITY["OpenCV 5<br/>Decode · Quality gate · CLAHE · Crops · Annotation"]
        YOLO["YOLOv8<br/>Class · Confidence · Bounding box"]
        LOOP["Bounded inspection loop<br/>Observe → Decide → Act → Outcome"]
        RESULT["Inspection result<br/>Ready for human · Review · Retake"]
        VISION --> QUALITY --> LOOP
        LOOP --> YOLO
        YOLO --> LOOP
        LOOP --> RESULT
    end

    RESULT -->|"structured result"| WEB
    WEB --> HUMAN["Human verification"]
    HUMAN --> GUARD
    GUARD --> ROUTE["Facility routing<br/>Synthetic facility dataset in prototype"]
    ROUTE --> LIFE["Lifecycle tracking"]
    LIFE --> PASS["Digital Material Passport"]
    GUARD --> AUDIT["Audit trail<br/>Hash-linked events"]
```

### Architecture notes

-   **OpenCV 5** handles image decoding and quality/preprocessing
    operations. The original image is retained; an enhanced copy is a
    retry path, not a replacement for the source evidence.
-   **YOLOv8** supplies visual detections. Detections are evidence, not
    proof of composition or safety.
-   **The inspection loop is bounded and rule-driven.** OpenCV/YOLO
    outcomes influence the next action; deterministic code enforces
    safety gates. It is not represented as an autonomous LLM agent.
-   **Amazon Bedrock** is used for structured material interpretation
    only when credentials, region, model access, and service
    configuration are valid.
-   Some AWS integrations may fall back to mock/demo behavior when
    unconfigured. Do not treat the presence of an integration module as
    proof of a live AWS deployment.
-   The current facility dataset is synthetic. Do not present its
    entries as verified, currently authorized recyclers.

## Agentic inspection loop

The loop makes a bounded decision based on observed image quality and
detection evidence:

1.  Assess image quality with OpenCV.
2.  If the image fails the configured quality gate, request a retake
    without running detection.
3.  Otherwise run YOLO and inspect the result.
4.  If evidence remains weak or ambiguous, use the configured retry path
    (for example, CLAHE or crop/upscale) within the iteration limit.
5.  Return one of the explicit outcomes:
    -   `READY_FOR_HUMAN`
    -   `HUMAN_REVIEW_REQUIRED`
    -   `RETAKE_REQUIRED`
6.  Require human verification and deterministic safety checks before
    downstream routing or lifecycle actions.

"Ready for human" means ready for operator verification; it does **not**
mean the material has been verified as safe.

------------------------------------------------------------------------

## Technology stack

  -----------------------------------------------------------------------
  Layer                               Technologies
  ----------------------------------- -----------------------------------
  Web app                             Next.js, React, TypeScript,
                                      Tailwind CSS

  Vision API                          Python, FastAPI, Uvicorn

  Image processing                    OpenCV 5

  Object detection                    Ultralytics YOLOv8, PyTorch

  Material interpretation             Amazon Bedrock Nova Pro, when
                                      configured

  Cloud integrations                  AWS Amplify, S3, DynamoDB, API
                                      Gateway, Lambda, EventBridge, Step
                                      Functions, CloudWatch, Transcribe
                                      --- configuration-dependent

  Traceability                        Material-lot records, lifecycle
                                      states, hash-linked audit events
  -----------------------------------------------------------------------

## Repository layout

The repository has evolved; verify paths against the checked-out branch
before relying on these examples.

``` text
ReRoute/
├── apps/
│   └── web/                    # Next.js application
│       ├── lib/                # Inspection guards, evidence helpers, integrations
│       └── ...
├── reloop-yolo/
│   └── api/
│       ├── main.py             # FastAPI endpoints
│       ├── quality.py          # OpenCV quality gate
│       ├── inspection.py       # Bounded inspection loop
│       ├── evidence.py         # Annotated images / crops
│       ├── detector.py         # YOLO integration
│       └── bedrock.py          # Bedrock integration / fallback
├── tests/                      # Python tests (location may vary by branch)
├── docs/
│   └── OPENCV_INSPECTION.md
└── README.md
```

------------------------------------------------------------------------

## Prerequisites

-   Git
-   **Node.js:** use the version specified by the repository's `.nvmrc`,
    `engines` field, or CI configuration if present.
-   npm
-   **Python 3.12** is the recommended baseline for the tested vision
    environment; check the repository's Python constraints before using
    a different version.
-   A virtual environment for Python
-   Optional AWS account and permissions for the integrations you intend
    to test
-   Sufficient disk space for PyTorch and model weights

> On Windows, if `python` is not available, install Python from
> python.org and enable the launcher/PATH option, or use the installed
> interpreter's full path. Installing packages with `pip` does not
> install Python itself.

## Pinned dependencies

Use the checked-in lockfiles as the source of truth for the web app.
Install with `npm ci`, not `npm install`, to reproduce the lockfile.

### Web dependencies

``` powershell
cd apps/web
npm ci
```

This requires a committed `package-lock.json`. If the lockfile is
missing or out of sync with `package.json`, fix and commit it before
claiming a reproducible build. Do not regenerate it casually during
deployment.

### Python dependencies

Create a `reloop-yolo/requirements.txt` containing **exact versions**
for every direct runtime dependency and commit it. The tested
environment reported OpenCV package version `opencv-python==5.0.0.93`
(OpenCV runtime reports `5.0.0`) and Ultralytics `8.4.155`; PyTorch was
reported as `2.14.0+cpu` in that environment. Confirm these versions are
available for your target Python/platform before pinning them,
especially the PyTorch wheel index. Do not silently substitute different
versions.

Example install commands once the repository's pinned file is present:

``` powershell
cd reloop-yolo
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

macOS/Linux:

``` bash
cd reloop-yolo
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

**Reproducibility requirement:** a version mentioned in documentation is
not a dependency pin unless it is in the committed
requirements/lockfile. Check the actual lockfiles before release.

------------------------------------------------------------------------

## Local development

Run the web app and vision API in separate terminals.

### 1. Start the vision API

``` powershell
cd reloop-yolo
.\.venv\Scripts\activate
uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
```

The API should be reachable at `http://127.0.0.1:8000`. If the app
exposes OpenAPI docs, check `http://127.0.0.1:8000/docs`.

macOS/Linux:

``` bash
cd reloop-yolo
source .venv/bin/activate
uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Configure and start the web app

Create `apps/web/.env.local` (or the environment-file name actually read
by this branch):

``` env
RELOOP_YOLO_API_URL=http://127.0.0.1:8000
AWS_REGION=us-east-1
AWS_BEDROCK_MODEL_ID=us.amazon.nova-pro-v1:0
```

Add S3/DynamoDB or other settings only if the corresponding integration
is enabled. Prefer an AWS IAM role or a local AWS profile over
long-lived access keys. Never commit credentials or `.env*` files.

Then:

``` powershell
cd apps/web
npm ci
npm run dev
```

Open `http://localhost:3000`.

> Environment variable names can differ by branch. Check the code and
> deployment settings before assuming every variable above is consumed.
> Do not expose AWS secrets through `NEXT_PUBLIC_*` variables.

------------------------------------------------------------------------

## Configuration

At minimum, configure and verify:

  -----------------------------------------------------------------------
  Setting                             Purpose
  ----------------------------------- -----------------------------------
  `RELOOP_YOLO_API_URL`               Base URL of the FastAPI vision
                                      service

  `AWS_REGION`                        Region for enabled AWS integrations

  `AWS_BEDROCK_MODEL_ID`              Bedrock model ID; Nova Pro is
                                      configured as
                                      `us.amazon.nova-pro-v1:0` in this
                                      prototype

  `YOLO_WEIGHTS`                      Optional path override for model
                                      weights

  `INSPECTION_MAX_ITERATIONS`         Upper bound for the inspection loop

  `QUALITY_*`                         Image-quality thresholds, where
                                      supported
  -----------------------------------------------------------------------

The repository may define additional variables. Search the code and
deployment dashboard for the authoritative list before production
deployment.

------------------------------------------------------------------------

## Tests and evaluation

Run tests from the repository root. Confirm test paths and commands
against the current branch.

### Python tests

``` powershell
cd reloop-yolo
python -m pytest tests/ -q
```

If `pytest` is not included in the pinned development dependencies,
install it through the project's development requirements rather than
adding an unpinned global package.

### Web tests

The web integration has Node tests. If the repository's `package.json`
defines a test script, run:

``` powershell
cd apps/web
npm test
```

Otherwise inspect the scripts and test files and use the command
declared by the project. Do not assume a test command passed unless you
ran it and saw a successful exit code.

### Build check

``` powershell
cd apps/web
npm run build
```

Run the build after tests and before deployment. A test pass does not
prove that the full Next.js app builds or that the end-to-end flow
works.

### Reported prototype evaluation

The previous prototype run reported:

-   33 Python tests passed.
-   8 Node tests passed.
-   Five original sample images were assessed; all five passed the
    quality gate.
-   Four of the five original-image cases required human review; one
    reached ready-for-human-verification.
-   Degraded blur/dark/low-resolution samples were rejected for retake
    before detection in the tested cases.
-   Full-loop median was approximately 1.6 seconds and maximum
    approximately 2.2 seconds on the tested CPU environment; retake
    short-circuit median was approximately 26 ms.

These are **reported prototype results**, not a guarantee that the
current checkout will reproduce them. The sample set is small and lacks
ground-truth labels; precision, recall, and mAP were not established.
The pretrained COCO weights performed poorly on e-waste classes, and the
trained `best.pt` model was not present in the tested environment.
Re-run evaluation and update these figures before submission.

------------------------------------------------------------------------

## Deployment

### Web app --- AWS Amplify

1.  Push the repository to the intended Git provider and select the
    correct app/root directory (`apps/web`, if supported by the current
    Amplify configuration).
2.  Configure the build settings using the repository's actual package
    manager and lockfile.
3.  Add environment variables in Amplify's environment configuration;
    never commit secrets.
4.  Configure the public API URL for the vision service and ensure the
    service allows requests from the deployed web origin.
5.  Configure IAM permissions and service settings for each AWS
    integration that should be live.
6.  Deploy, then verify the deployed app and inspect build/runtime logs
    in CloudWatch or the relevant hosting logs.

### Vision service --- Render

The FastAPI/OpenCV/YOLO service is currently separate from AWS and runs
on Render.

1.  Set the service root directory to `reloop-yolo` if that matches the
    repository layout.
2.  Install from the committed, pinned Python requirements file.
3.  Configure the start command to the actual FastAPI module, for
    example `uvicorn api.main:app --host 0.0.0.0 --port $PORT`.
4.  Configure `YOLO_WEIGHTS` and any model asset required by the
    detector. Ensure the weights are available to the deployed service
    and licensing is understood.
5.  Set `RELOOP_YOLO_API_URL` in the web app to the deployed HTTPS
    service URL.
6.  Verify health, CORS, upload size limits, timeouts, and error
    handling using the deployed app.

### AWS integrations

-   Verify the correct AWS region, IAM permissions, Bedrock model
    access, S3 bucket policies, DynamoDB tables, and event/workflow
    resources.
-   Test each integration in the target account. Modules or
    infrastructure templates alone do not prove that a service is
    deployed or working.
-   Some services have demo/mock fallbacks when credentials or
    configuration are absent. Make fallback status visible and do not
    label mock execution as a successful live AWS call.
-   The vision service is not AWS-hosted in the current deployment. Do
    not describe the complete computer-vision pipeline as AWS-hosted
    unless it has actually been moved and verified there.

### End-to-end deployment smoke test

1.  Create a test lot using non-sensitive sample evidence.
2.  Upload a clear image and verify the quality-gate result.
3.  Upload a deliberately blurred/dark image and confirm the retake
    path.
4.  Confirm detections and crops are tied to the source image.
5.  Confirm uncertain detections require human review.
6.  Attempt routing before required verification and confirm it is
    blocked.
7.  Complete the human review and verify that deterministic rules still
    govern routing.
8.  Inspect the lifecycle, passport, and audit entries.
9.  Verify which persistence/services were genuinely live (not in-memory
    or mock mode).
10. Check logs for errors and ensure evidence endpoints are protected
    before using real user data.

------------------------------------------------------------------------

## Limitations and responsible use

-   This is a prototype, not a hazardous-material certification system.
-   Visible-object detection cannot establish hidden chemistry, exact
    mass, battery integrity, or safety.
-   Human verification is required where the workflow marks uncertainty
    or safety-sensitive evidence.
-   Facility data is synthetic until replaced with verified, current
    facility records. working on it
-   A hash-linked audit trail can help detect later changes; it does not
    by itself prove that the original input was true.




## Project principle

> **Don't just identify the waste. Structure it well enough to make the
> next decision accountable.**
