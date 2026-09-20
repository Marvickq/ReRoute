import json
import os
from pathlib import Path

import boto3
from dotenv import load_dotenv


# --------------------------------------------------
# Load .env
# --------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_FILE = PROJECT_ROOT / "apps" / "web" / ".env"

load_dotenv(ENV_FILE)


# --------------------------------------------------
# AWS configuration
# --------------------------------------------------

REGION = os.getenv("AWS_REGION", "us-east-1")

MODEL_ID = os.getenv(
    "AWS_BEDROCK_MODEL_ID",
    "us.amazon.nova-pro-v1:0"
)

ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID")
SECRET_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")


print("AWS region:", REGION)
print("Bedrock model:", MODEL_ID)
print("AWS access key loaded:", bool(ACCESS_KEY))
print("AWS secret key loaded:", bool(SECRET_KEY))


# --------------------------------------------------
# Bedrock client
# --------------------------------------------------

bedrock = boto3.client(
    "bedrock-runtime",
    region_name=REGION,
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY
)


# --------------------------------------------------
# YOLO → Bedrock
# --------------------------------------------------

def interpret_detections(detections):

    prompt = f"""
You are the Material Intelligence layer of ReLoop,
an AI-assisted e-waste management system.

YOLO detected these objects:

{json.dumps(detections, indent=2)}

Convert these detections into structured material information.

Return ONLY valid JSON in this exact format:

{{
    "items": [
        {{
            "category": "string",
            "quantity": 1,
            "condition": "unknown",
            "battery_present": "unknown",
            "components": [],
            "confidence": 0.0
        }}
    ]
}}

Rules:

- Use YOLO detections as evidence.
- Quantity should be based on detected objects.
- Do not invent battery information.
- Use "unknown" when information cannot be determined.
- Keep confidence between 0 and 1.
- Return JSON only.
"""

    response = bedrock.invoke_model(
        modelId=MODEL_ID,
        body=json.dumps({
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "text": prompt
                        }
                    ]
                }
            ],
            "inferenceConfig": {
                "maxTokens": 1000,
                "temperature": 0
            }
        })
    )

    response_body = json.loads(response["body"].read())

    # Extract Nova's text response
    text = response_body["output"]["message"]["content"][0]["text"]

    # Convert Bedrock JSON text into Python dictionary
    try:
        material_intelligence = json.loads(text)
    except json.JSONDecodeError:
        print("\nBedrock raw response:")
        print(text)
        raise ValueError("Bedrock did not return valid JSON")

    return material_intelligence