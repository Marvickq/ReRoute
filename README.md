# ♻️ ReRoute

### Turning discarded electronics into traceable material.

ReRoute is an AI-assisted e-waste material intelligence and traceability platform that helps transform messy physical e-waste into **structured, verified, routable material records**.

Instead of treating e-waste as an anonymous pile of objects, ReRoute creates a digital record around each material lot — from initial capture and AI analysis to human verification, safety decisions, routing, and a Digital Material Passport.

> AI interprets the ambiguity. Deterministic systems control what happens next.

---

## 🌐 Live Demo

[Add your deployed ReRoute URL here]

---

## 📌 Table of Contents

| Section | What You'll Find |
|---|---|
| 🌍 [Problem](#-the-problem) | Why e-waste is difficult to identify and route |
| 💡 [Insight](#-the-insight) | The information gap inside the physical waste stream |
| 🚀 [Solution](#-the-solution) | How ReRoute structures e-waste |
| ✨ [Key Features](#-key-features) | Core product capabilities |
| 🧠 [Intelligence Flow](#-intelligence-flow) | End-to-end ReRoute workflow |
| 🤖 [AI Boundary](#-ai--with-a-boundary) | What AI does and what deterministic systems control |
| 👁️ [YOLO Detection](#️-yolo-detection) | Computer-vision layer |
| 👩‍💻 [Human Verification](#-human-verification) | Human-in-the-loop review |
| 🛡️ [Safety & Routing](#️-safety--routing) | Deterministic decision layer |
| 🪪 [Material Passport](#-digital-material-passport) | Traceable material record |
| 🏗️ [AWS Architecture](#️-aws-architecture) | Cloud system structure |
| 🛠️ [Tech Stack](#️-tech-stack) | Technologies used |
| 🔄 [Lifecycle](#-material-lifecycle) | Material state transitions |
| 🚧 [Challenges](#-challenges) | Problems encountered while building |
| 🚀 [Roadmap](#-roadmap) | What's next |
| ⚙️ [Setup](#️-local-setup) | Run ReRoute locally |
| 🎬 [Demo Flow](#-collector-workflow) | Recommended demonstration |
| 💭 [Bigger Idea](#-the-bigger-idea) | Why ReRoute exists |

---

## 🌍 The Problem

E-waste does not arrive as clean, structured data.

A collector may receive:

- A damaged smartphone
- A laptop with an unknown battery condition
- Mixed circuit boards
- Old monitors
- Loose batteries
- Multiple electronic components in one lot

Before material can be responsibly handled, someone needs to understand:

- What is it?
- How much is there?
- What condition is it in?
- Does it contain a battery?
- Are there hazards?
- Who can handle it?
- Where should it go?
- What happened to it afterwards?

The physical stream is messy. Formal recycling workflows require structured information.

> **The challenge is turning ambiguous physical material into information that can be verified and acted upon.**

---

## 💡 The Insight

Most e-waste systems focus on one part of the journey:

```
Collection → Marketplace → Recycling
```

But the difficult part happens *between* these stages. A physical object needs to become a structured material record before downstream decisions can be made reliably.

This led to a simple idea:

> **What if the first step in e-waste handling was creating a trustworthy digital representation of the material itself?**

ReRoute is built around that representation.

---

## 🚀 The Solution

ReRoute creates a structured workflow around each material lot:

```
Physical E-Waste
    ↓
Capture
    ↓
AI Analysis
    ↓
Structured Material Record
    ↓
Uncertainty
    ↓
Human Verification
    ↓
Safety Decision
    ↓
Routing
    ↓
Lifecycle Tracking
    ↓
Digital Material Passport
```

The system separates two responsibilities:

- **AI / Intelligence** — interprets ambiguous evidence and structures it
- **Deterministic Software** — controls what happens next

This prevents an AI model from directly deciding what should happen to potentially hazardous material.

---

## ✨ Key Features

| Feature | Description | Purpose |
|---|---|---|
| 📦 Material Lots | Create a unique lot for collected e-waste | Organize physical material |
| 📷 Multimodal Capture | Photo, voice and text evidence | Capture messy real-world input |
| 👁️ YOLO Detection | Detect visible electronic objects | Computer-vision evidence |
| 🧠 Bedrock Analysis | Convert evidence into structured material information | Material intelligence |
| 📊 Confidence & Uncertainty | Classifies analysis confidence | Makes uncertainty visible |
| 🔎 Evidence Traceability | Links outputs to source evidence | Explainability |
| 👩‍💻 Human Verification | Confirm, reject or mark uncertain findings | Human oversight |
| 🛡️ Safety Engine | Applies deterministic handling rules | Conservative decisions |
| 🏭 Facility Routing | Matches material against facility capabilities | Route compatible material |
| 🔄 Lifecycle Tracking | Tracks lot state from creation to receipt | Operational visibility |
| 🪪 Digital Material Passport | Structured record of the material journey | Traceability |
| ☁️ AWS Infrastructure | Bedrock, S3, DynamoDB, Lambda and workflow services | Cloud infrastructure |

---

## 🧠 Intelligence Flow

ReRoute uses multiple layers rather than relying on a single AI prediction.

```
Photo / Voice / Text
    ↓
Evidence Capture
    ↓
YOLO Detection
    ↓
Object Evidence
    ↓
Amazon Bedrock
    ↓
Material Intelligence
    ↓
Confidence / Uncertainty
    ↓
Human Verification
    ↓
Deterministic Safety Rules
    ↓
Deterministic Routing
    ↓
Material Lifecycle
    ↓
Digital Material Passport
```

The central principle is:

> **YOLO sees. Bedrock interprets. Humans verify. Deterministic systems decide. ReRoute records.**

---

## 👁️ YOLO Detection

ReRoute includes a custom YOLO-based computer-vision layer for identifying visible e-waste objects.

The model provides:

- Class
- Confidence
- Bounding Box
- Evidence Image

Example output:

```json
{
  "class_name": "Battery",
  "confidence": 0.9986,
  "bbox": [31.35, 53.77, 345.32, 248.81]
}
```

These detections are not treated as the final material decision. They become **evidence** that can be interpreted alongside other information.

---

## 🤖 AI — With a Boundary

ReRoute uses **Amazon Bedrock** as the material intelligence layer.

### AI CAN

- Interpret visual evidence
- Understand detected objects
- Structure material information
- Estimate analysis confidence
- Identify relevant material characteristics
- Connect multiple pieces of evidence
- Provide structured analysis

### AI CANNOT DIRECTLY

- Decide that hazardous material is safe
- Bypass required human verification
- Choose a facility without deterministic constraints
- Override safety rules
- Replace human verification where review is required

The architecture intentionally separates intelligence from control:

```
AI
 ↓
Interpret
 ↓
Structure
 ↓
Expose Uncertainty
 ↓
Human Verification
 ↓
Deterministic Rules
 ↓
Action
```

---

## 👩‍💻 Human Verification

AI analysis can be uncertain. Instead of hiding that uncertainty, ReRoute surfaces it.

Verification operators can:

- **Confirm**
- **Reject**
- **Cannot Determine**

This creates a human checkpoint before important downstream decisions.

> **When the system is uncertain, uncertainty becomes part of the workflow instead of being hidden.**

---

## 🛡️ Safety & Routing

Safety decisions are handled through deterministic rules rather than an LLM.

Examples include:

- Battery detected → Special handling required
- Hazard signal detected → Human review required
- Required verification incomplete → Routing blocked
- Low-confidence material → Review required

The system can therefore distinguish between:

```
AI uncertainty ≠ Safety decision
```

This is important because confidence in a model prediction is not the same thing as proof that material is safe.

---

## 🏭 Facility Routing

ReRoute currently uses a **synthetic facility dataset** for the prototype.

Facilities have attributes such as:

- Accepted Materials
- Battery Capability
- Hazardous Material Capability
- Capacity
- Availability

Routing first applies hard constraints:

```
Material Accepted?
    ↓
Handling Capability?
    ↓
Capacity Available?
    ↓
Facility Available?
```

Eligible facilities can then be evaluated using prototype routing factors such as:

- Distance
- Capacity Headroom
- Handling Capability

> The current facility dataset is synthetic and is used to demonstrate the routing workflow.

---

## 🔄 Material Lifecycle

Each material lot moves through a controlled lifecycle:

```
CREATED
  ↓
ANALYZING
  ↓
ANALYZED
  ↓
SAFETY CHECK
  ↓
REVIEW REQUIRED
  ↓
VERIFIED
  ↓
ROUTING
  ↓
DISPATCHED
  ↓
RECEIVED
```

A lot can also become **BLOCKED** when required safety or verification conditions are not satisfied.

This gives the material a stateful journey instead of treating analysis as a one-time prediction.

---

## 🪪 Digital Material Passport

The **Digital Material Passport** is the structured record representing a material lot.

It can contain:

- Lot ID
- Material Category
- Quantity
- Condition
- Battery Information
- Hazard Information
- AI Analysis Confidence
- Evidence
- Human Verification
- Safety Status
- Destination
- Lifecycle State

Example:

```
Lot: RL-1001
Material: Battery
Quantity: 1
Battery: Yes
Verification: Confirmed
Safety: Approved for Handling
Destination: SafeDisposal Pvt Ltd
AI Verification: Amazon Bedrock
```

> **It is the structured source of truth for the material's journey.**

---

## 🔎 Evidence Traceability

ReRoute keeps the connection between:

```
Physical Evidence
    ↓
YOLO Detection
    ↓
Bedrock Interpretation
    ↓
Material Record
    ↓
Human Verification
    ↓
Safety Decision
    ↓
Routing
```

This makes it possible to understand not only **what the system decided**, but also **what evidence contributed to the decision**.

> **Every important material decision should have a path back to its evidence.**

---

## 🧑‍🔧 Collector Workflow

**01 — Create a Lot**
The collector creates a new material lot.

**02 — Capture Evidence**
Photos, voice notes and text descriptions can be attached.

**03 — Analyze**
ReRoute processes the available evidence using the YOLO and Bedrock intelligence layers.

**04 — Review**
Uncertain or safety-sensitive information is sent for human verification.

**05 — Decide**
Deterministic safety rules determine whether the material can proceed.

**06 — Route**
The system identifies compatible facilities using the routing constraints.

**07 — Track**
The lot moves through its lifecycle.

**08 — Passport**
A Digital Material Passport provides the structured record of the material.

---

## 🏗️ AWS Architecture

```
COLLECTOR
   │
   Photo / Voice / Text
   ▼
┌──────────────────┐
│  Amplify Hosting  │
└─────────┬─────────┘
          ▼
┌──────────────────┐
│   API Gateway     │
└─────────┬─────────┘
          ▼
┌──────────────────┐
│      Lambda       │
└─────────┬─────────┘
          │
   ┌──────┼───────────┐
   ▼      ▼            ▼
   S3   DynamoDB   EventBridge
   │      │              │
   │      │              ▼
   │      │        Step Functions
   │      │              │
   └──────┼──────────────┘
          ▼
┌──────────────────┐
│  Amazon Bedrock   │
└─────────┬─────────┘
          ▼
   Material Intelligence
          ▼
   Human Verification
          ▼
   Deterministic Rules
          ▼
       Routing
          ▼
Digital Material Passport
```

### AWS Services

| AWS Service | Role |
|---|---|
| ☁️ Amplify Hosting | Hosts the ReRoute web application |
| 🚪 API Gateway | Exposes backend APIs |
| ⚡ Lambda | Runs backend logic |
| 🗂️ S3 | Stores evidence and files |
| 🗄️ DynamoDB | Stores material and lot records |
| 🔔 EventBridge | Handles workflow events |
| 🔄 Step Functions | Orchestrates processing workflows |
| 🧠 Bedrock | Provides material intelligence |

---

## 🛠️ Tech Stack

**Frontend**
- Next.js
- React
- TypeScript
- Tailwind CSS

**AI / Computer Vision**
- YOLO
- OpenCV
- FastAPI
- Amazon Bedrock
- AWS Nova Pro

**Backend**
- Next.js API routes
- FastAPI
- Python

**AWS**
- Amazon Bedrock
- Amazon S3
- Amazon DynamoDB
- AWS Lambda
- Amazon API Gateway
- Amazon EventBridge
- AWS Step Functions
- AWS Amplify Hosting

**Data & Documents**
- DynamoDB
- S3
- Digital Material Passport
- PDF generation

---

## 🔐 Data & Security

ReRoute is designed to keep sensitive configuration and evidence outside the source repository.

Environment variables are stored locally or through deployment configuration.

Sensitive files such as `.env` and `.env.local` are excluded from Git.

Generated ML assets are also excluded:

```
dataset/
runs/
*.pt
*.pth
.venv/
```

The repository therefore contains the application and model integration code rather than local datasets, generated training outputs or credentials.

---

## 🚧 Challenges

**01 — E-waste is inherently messy**
Real-world e-waste rarely arrives as clean individual objects. A single image can contain multiple objects, damaged components and incomplete information. This required a multimodal evidence approach rather than relying on one input.

**02 — AI confidence is not enough**
A high-confidence detection does not automatically mean a material is safe to handle. This led to the separation between AI Analysis → Uncertainty → Human Verification → Safety Rules.

**03 — Routing requires constraints**
Identifying an object is only the beginning. A facility also needs to be able to accept and safely process that material. This required routing based on deterministic facility capabilities.

**04 — Traceability must survive the workflow**
The evidence used for analysis should remain connected to the final material record. This led to the Digital Material Passport concept.

---

## 🏆 What We Built

ReRoute combines several stages into one operational workflow:

```
Messy E-Waste
    ↓
Capture
    ↓
YOLO Detection
    ↓
Bedrock Interpretation
    ↓
Structured Material Record
    ↓
Uncertainty
    ↓
Human Verification
    ↓
Safety Decision
    ↓
Facility Routing
    ↓
Lifecycle Tracking
    ↓
Digital Material Passport
```

> **Don't just identify the waste. Structure it well enough to make the next decision accountable.**

---

## 🚀 Roadmap

**Phase 1 — Prototype**
- Multimodal material capture
- YOLO object detection
- Bedrock material analysis
- Confidence and uncertainty
- Human verification
- Deterministic safety rules
- Synthetic facility routing
- Lifecycle tracking
- Digital Material Passport

**Phase 2 — Operational Data**
- Real facility datasets
- Real recycler acceptance criteria
- Better material taxonomy
- Expanded evidence types
- Improved routing constraints
- More robust model evaluation

**Phase 3 — Real-World Validation**

Validate the workflow with:
- E-waste collectors
- Aggregators
- Authorized recyclers
- Facility operators

Measure:
- Identification accuracy
- Verification time
- Routing accuracy
- Material traceability
- Operator usefulness

**Phase 4 — Scale**
- Larger recycler networks
- Regional routing
- Advanced material classification
- Automated workflow orchestration
- Longitudinal material traceability

---

## ⚙️ Local Setup

### Prerequisites

- Node.js
- Python 3.11+
- npm
- Git
- AWS account with Amazon Bedrock access

### Clone

```bash
git clone https://github.com/Marvickq/ReRoute.git
cd ReRoute
```

### Frontend

```bash
cd apps/web
npm install
npm run dev
```

The web application runs locally on:

```
http://localhost:3000
```

### YOLO API

Create and activate the Python environment:

```bash
python -m venv .venv
```

Windows:

```powershell
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install fastapi uvicorn python-multipart boto3 python-dotenv ultralytics
```

Start the YOLO API:

```bash
uvicorn api.main:app --reload --port 8000
```

The API runs on:

```
http://127.0.0.1:8000
```

### Environment Variables

Create `apps/web/.env`:

```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_BEDROCK_MODEL_ID=us.amazon.nova-pro-v1:0

RELOOP_YOLO_API_URL=http://127.0.0.1:8000
```

> Never commit AWS credentials or `.env` files to GitHub.

---

## 💭 The Bigger Idea

The physical e-waste stream is messy. Formal recycling workflows require structured information.

ReRoute creates the bridge:

```
Physical Material
    ↓
Digital Evidence
    ↓
Structured Intelligence
    ↓
Human Verification
    ↓
Controlled Decision
    ↓
Traceable Journey
```

The goal is not simply to build another e-waste marketplace. It is to make the material itself **more understandable, verifiable and traceable** as it moves through the recycling journey.

> **ReRoute turns ambiguous physical e-waste into verified, routable, traceable material.**
