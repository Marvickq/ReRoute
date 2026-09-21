import json
import os
from pathlib import Path
from typing import Optional, Dict, Any, List

import boto3
from dotenv import load_dotenv

# --------------------------------------------------
# Load .env (if present locally)
# --------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_FILE = PROJECT_ROOT / "apps" / "web" / ".env"

if ENV_FILE.exists():
    load_dotenv(ENV_FILE)

# --------------------------------------------------
# Default AWS configuration from environment
# --------------------------------------------------

def get_env_aws_config():
    region = (
        os.getenv("MY_AWS_REGION")
        or os.getenv("REROUTE_AWS_REGION")
        or os.getenv("AWS_REGION", "us-east-1")
    )
    model_id = (
        os.getenv("MY_AWS_BEDROCK_MODEL_ID")
        or os.getenv("REROUTE_AWS_BEDROCK_MODEL_ID")
        or os.getenv("AWS_BEDROCK_MODEL_ID", "us.amazon.nova-pro-v1:0")
    )
    access_key = (
        os.getenv("MY_AWS_ACCESS_KEY_ID")
        or os.getenv("REROUTE_AWS_ACCESS_KEY_ID")
        or os.getenv("AWS_ACCESS_KEY_ID")
    )
    secret_key = (
        os.getenv("MY_AWS_SECRET_ACCESS_KEY")
        or os.getenv("REROUTE_AWS_SECRET_ACCESS_KEY")
        or os.getenv("AWS_SECRET_ACCESS_KEY")
    )
    return region, model_id, access_key, secret_key

# --------------------------------------------------
# Fallback Material Intelligence Generator from YOLO Detections
# --------------------------------------------------

def generate_fallback_intelligence(detections: List[Dict[str, Any]]) -> Dict[str, Any]:
    category_map = {
        "cell phone": "mobile_phone",
        "laptop": "laptop",
        "keyboard": "keyboard",
        "mouse": "mouse",
        "tv": "monitor",
        "remote": "remote_control",
        "bottle": "container",
    }
    
    counts: Dict[str, int] = {}
    confidences: Dict[str, float] = {}
    
    for d in detections:
        c_name = d.get("class_name", "unknown")
        cat = category_map.get(c_name.lower(), c_name)
        counts[cat] = counts.get(cat, 0) + 1
        confidences[cat] = max(confidences.get(cat, 0.0), float(d.get("confidence", 0.8)))

    items = []
    for cat, qty in counts.items():
        items.append({
            "category": cat,
            "quantity": qty,
            "condition": "unknown",
            "battery_present": cat in ["mobile_phone", "laptop", "tablet", "battery"],
            "components": [],
            "confidence": confidences.get(cat, 0.8)
        })

    if not items:
        items.append({
            "category": "electronic_device",
            "quantity": 1,
            "condition": "unknown",
            "battery_present": False,
            "components": [],
            "confidence": 0.7
        })

    return {
        "items": items,
        "hazard_signals": []
    }

# --------------------------------------------------
# YOLO → Bedrock (or Fallback)
# --------------------------------------------------

def interpret_detections(
    detections: List[Dict[str, Any]],
    aws_access_key: Optional[str] = None,
    aws_secret_key: Optional[str] = None,
    aws_region: Optional[str] = None
) -> Dict[str, Any]:
    
    default_region, default_model_id, default_access_key, default_secret_key = get_env_aws_config()
    
    region = aws_region or default_region
    access_key = aws_access_key or default_access_key
    secret_key = aws_secret_key or default_secret_key
    model_id = default_model_id

    if not access_key or not secret_key:
        print("[YOLO API] AWS credentials not provided, returning detection-based intelligence")
        return generate_fallback_intelligence(detections)

    try:
        bedrock = boto3.client(
            "bedrock-runtime",
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key
        )

        prompt = f"""You are the Material Intelligence layer of ReLoop, an AI-assisted e-waste management system.

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
            "battery_present": false,
            "components": [],
            "confidence": 0.0
        }}
    ],
    "hazard_signals": []
}}

Rules:
- Use YOLO detections as evidence.
- Quantity should be based on detected objects.
- Do not invent battery information unless reasonably inferred.
- Keep confidence between 0 and 1.
- Return JSON only.
"""

        response = bedrock.invoke_model(
            modelId=model_id,
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
        raw_text = ""

        # Check Nova Pro or standard response layout
        if "output" in response_body and "message" in response_body["output"]:
            content = response_body["output"]["message"]["content"]
            if isinstance(content, list) and len(content) > 0:
                raw_text = content[0].get("text", "")
        elif "content" in response_body:
            content = response_body["content"]
            if isinstance(content, list) and len(content) > 0:
                raw_text = content[0].get("text", "")

        if raw_text:
            json_match = raw_text[raw_text.find('{'):raw_text.rfind('}')+1]
            if json_match:
                material_intelligence = json.loads(json_match)
                if isinstance(material_intelligence, dict) and "items" in material_intelligence:
                    return material_intelligence

        print("[YOLO API Warning] Bedrock response parsing failed, using fallback")
        return generate_fallback_intelligence(detections)

    except Exception as err:
        print(f"[YOLO API Warning] Bedrock call failed: {err}. Falling back to detection-based intelligence.")
        return generate_fallback_intelligence(detections)