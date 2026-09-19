# ReLoop — E-Waste Material Intelligence System

## Overview

AI-assisted material intelligence, safety routing, and traceability system for e-waste.

**Core principle:** AI handles ambiguity. Deterministic systems handle accountability.

## Architecture

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS (App Router)
- **AI:** AWS Bedrock (Anthropic Claude) with mock fallback
- **Storage:** In-memory Map (swap point: DynamoDB)
- **File Storage:** Local uploads (swap point: S3)

## Quick Start

```bash
cd apps/web
npm install
cp .env.example .env
# Edit .env with your AWS credentials
npm run dev
```

## Environment Variables

See `.env.example`. Required for AWS Bedrock integration:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_BEDROCK_MODEL_ID` (optional, defaults to `anthropic.claude-sonnet-4-6`)

**Without AWS credentials**, the system runs in mock mode with simulated analysis results.

## Project Structure

```
apps/web/src/
├── lib/
│   ├── bedrock.ts      # AWS Bedrock client + mock fallback
│   ├── store.ts        # In-memory data store (swap: DynamoDB)
│   ├── safety.ts       # Deterministic safety rules engine
│   ├── facilities.ts   # Synthetic facility data
│   ├── routing.ts      # Routing engine
│   ├── uncertainty.ts  # Confidence classification
│   ├── lifecycle.ts    # State machine / lifecycle transitions
│   └── passport.ts     # Material Passport generator
├── types/
│   └── index.ts        # All TypeScript types
├── app/
│   ├── api/            # API routes
│   ├── lots/[id]/      # Lot detail, routing, verification, passport
│   ├── review/         # Review queue
│   └── facilities/     # Facility list
└── components/          # Reusable UI components
```

## AWS Setup

### IAM Permissions Required

The IAM user needs:
- `AmazonBedrockFullAccess` (or custom policy with `bedrock:InvokeModel`)

### AWS Credentials

**Option 1: `.env` file**
```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

**Option 2: AWS CLI**
```bash
aws configure
```

**Option 3: IAM Role** (if running on EC2/Lambda)

### Verification

After setting credentials, verify Bedrock works:
```bash
# Check if the SDK can find credentials
node -e "const { fromEnv } = require('@aws-sdk/credential-provider-env'); console.log('AWS SDK ready')"
```

## Feature List

1. **Multimodal Waste Capture** — Photo, voice, text evidence capture
2. **Material Understanding** — Bedrock analysis with structured JSON output
3. **Confidence & Uncertainty** — Deterministic HIGH/MEDIUM/LOW classification
4. **Safety Engine + Routing** — Deterministic rules, facility eligibility
5. **Human Verification** — CONFIRM/REJECT/CANNOT DETERMINE workflow
6. **Lifecycle Management** — State machine with valid transitions
7. **Material Passport** — Complete audit trail generation

## Development Notes

- **Mock mode** is active when no AWS credentials are detected — this is intentional for development
- **No authentication** implemented (demo_operator placeholder)
- **Facility data** is synthetic (5 facilities in Maharashtra, India)
- **Uploads** go to `apps/web/uploads/` (local filesystem, swap: S3)
- **Store** uses in-memory Map (swap: DynamoDB)

## Git Workflow

```bash
# NEVER commit .env
git status --ignored | grep .env

# Always include .env.example and .gitignore
git add .env.example .gitignore
git commit -m "..."
```
