import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { readFile } from "fs/promises";
import path from "path";
import os from "os";
import type { Evidence, MaterialItem, HazardSignal, AnalysisResult } from "@/types";
import { classifyUncertainty } from "./uncertainty";

const MODEL_ID =
  process.env.REROUTE_AWS_BEDROCK_MODEL_ID ||
  process.env.MY_AWS_BEDROCK_MODEL_ID ||
  process.env.AWS_BEDROCK_MODEL_ID ||
  "us.amazon.nova-pro-v1:0";

async function readFileBuffer(filename: string): Promise<Buffer> {
  const primaryPath = path.join(process.cwd(), "uploads", filename);
  try {
    return await readFile(primaryPath);
  } catch {
    const tmpPath = path.join(os.tmpdir(), "uploads", filename);
    return await readFile(tmpPath);
  }
}

const ANALYSIS_PROMPT = `You are an e-waste material analysis system. Analyze the provided evidence (photos, text descriptions, voice transcriptions) and extract structured material intelligence.

For each distinct item or device category observed, provide:
- category: the device/material type (e.g., "laptop", "mobile_phone", "battery", "tablet", "monitor", "cable", "circuit_board", "charger", "other")
- quantity: number of items of this type
- condition: observed condition (e.g., "good", "damaged", "heavily_damaged", "unknown")
- battery_present: whether a battery is present or associated with this item
- components: notable components visible (e.g., ["screen", "keyboard", "ports"])
- confidence: your confidence in this observation (0.0 to 1.0)
- evidence_ids: which evidence items support this observation

Also identify any potential hazard signals:
- type: signal type (e.g., "possible_battery_swelling", "battery_damage", "exposed_components", "liquid_damage", "corrosion", "burn_marks")
- confidence: confidence in this signal (0.0 to 1.0)
- severity: estimated severity if applicable ("low", "medium", "high")
- evidence_ids: which evidence items support this signal

Rules:
1. Every observation MUST reference at least one evidence_id from the provided evidence.
2. Do NOT duplicate observations that describe the same item from multiple evidence sources.
3. Use the evidence_ids exactly as provided in the input.
4. Return ONLY valid JSON matching the schema below. No markdown, no explanation.
5. If you cannot determine something with confidence, say "unknown" rather than guessing.

Return JSON schema:
{
  "items": [
    {
      "category": "string",
      "quantity": number,
      "condition": "string",
      "battery_present": boolean,
      "components": ["string"],
      "confidence": number,
      "evidence_ids": ["string"]
    }
  ],
  "hazard_signals": [
    {
      "type": "string",
      "confidence": number,
      "severity": "string" | null,
      "evidence_ids": ["string"]
    }
  ]
}`;

interface BedrockAnalysisInput {
  images: { data: string; mediaType: string; evidenceId: string }[];
  textDescriptions: { text: string; evidenceId: string }[];
}

interface RawBedrockItem {
  category?: string;
  quantity?: number;
  condition?: string;
  battery_present?: boolean;
  components?: string[];
  confidence?: number;
  evidence_ids?: string[];
}

interface RawBedrockHazard {
  type?: string;
  confidence?: number;
  severity?: string | null;
  evidence_ids?: string[];
}

interface RawBedrockResponse {
  items?: RawBedrockItem[];
  hazard_signals?: RawBedrockHazard[];
}

function getAwsCredentials() {
  const accessKeyId =
    process.env.REROUTE_AWS_ACCESS_KEY_ID ||
    process.env.MY_AWS_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID ||
    "";
  const secretAccessKey =
    process.env.REROUTE_AWS_SECRET_ACCESS_KEY ||
    process.env.MY_AWS_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    "";
  const region =
    process.env.REROUTE_AWS_REGION ||
    process.env.MY_AWS_REGION ||
    process.env.AWS_REGION ||
    "us-east-1";
  return { accessKeyId, secretAccessKey, region };
}

function isConfigured(): boolean {
  const { accessKeyId, secretAccessKey, region } = getAwsCredentials();
  return !!(accessKeyId && secretAccessKey && region);
}

function detectActualImageMimeType(buffer: Buffer, fallbackMime: string): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  if (buffer.length >= 3 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return "image/gif";
  }
  return fallbackMime || "image/jpeg";
}

async function readEvidenceFiles(evidence: Evidence[]): Promise<BedrockAnalysisInput> {
  const images: { data: string; mediaType: string; evidenceId: string }[] = [];
  const textDescriptions: { text: string; evidenceId: string }[] = [];

  for (const ev of evidence) {
    if (ev.type === "photo") {
      try {
        const buffer = await readFileBuffer(ev.filename);
        const actualMime = detectActualImageMimeType(buffer, ev.mime_type);
        images.push({
          data: buffer.toString("base64"),
          mediaType: actualMime,
          evidenceId: ev.evidence_id,
        });
      } catch {
        console.warn(`Could not read image file: ${ev.filename}`);
      }
    }
  }

  return { images, textDescriptions };
}

function buildMessages(input: BedrockAnalysisInput, textDescription: string | null) {
  const content: Array<
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
    | { type: "text"; text: string }
  > = [];

  for (const img of input.images) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mediaType,
        data: img.data,
      },
    });
  }

  let userText = "Analyze the provided evidence and extract structured material intelligence.";
  if (textDescription) {
    userText += `\n\nText description from collector: "${textDescription}"`;
  }
  if (input.images.length > 0) {
    const evidenceRefs = input.images.map((img) => img.evidenceId).join(", ");
    userText += `\n\nEvidence IDs for reference: ${evidenceRefs}`;
  }
  userText += `\n\nReturn your analysis as JSON only.`;

  content.push({ type: "text", text: userText });

  return [{ role: "user", content }];
}

function buildNovaMessages(input: BedrockAnalysisInput, textDescription: string | null) {
  const content: Array<
    | { image: { format: string; source: { bytes: string } } }
    | { text: string }
  > = [];

  for (const img of input.images) {
    let format = "jpeg";
    if (img.mediaType.includes("png")) format = "png";
    else if (img.mediaType.includes("webp")) format = "webp";
    else if (img.mediaType.includes("gif")) format = "gif";

    content.push({
      image: {
        format,
        source: {
          bytes: img.data,
        },
      },
    });
  }

  let userText = "Analyze the provided evidence and extract structured material intelligence.";
  if (textDescription) {
    userText += `\n\nText description from collector: "${textDescription}"`;
  }
  if (input.images.length > 0) {
    const evidenceRefs = input.images.map((img) => img.evidenceId).join(", ");
    userText += `\n\nEvidence IDs for reference: ${evidenceRefs}`;
  }
  userText += `\n\nReturn your analysis as JSON only.`;

  content.push({ text: userText });

  return [{ role: "user", content }];
}

function validateAnalysis(data: unknown): data is RawBedrockResponse {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (obj.items !== undefined && !Array.isArray(obj.items)) return false;
  if (obj.hazard_signals !== undefined && !Array.isArray(obj.hazard_signals)) return false;
  return true;
}

function generateMockAnalysis(
  evidence: Evidence[],
  textDescription: string | null,
  lotId: string
): AnalysisResult {
  const evidenceIds = evidence.filter((e) => e.type === "photo").map((e) => e.evidence_id);
  const allIds = evidenceIds.length > 0 ? evidenceIds : ["mock-evidence"];

  const items: MaterialItem[] = [];
  const hazardSignals: HazardSignal[] = [];

  if (textDescription) {
    const lower = textDescription.toLowerCase();
    if (lower.includes("laptop") || lower.includes("notebook")) {
      const confidence = 0.85;
      items.push({
        item_id: `ITEM-${Date.now()}-1`,
        lot_id: lotId,
        category: "laptop",
        quantity: 1,
        condition: lower.includes("damage") || lower.includes("broken") ? "damaged" : "unknown",
        battery_present: lower.includes("battery"),
        components: [],
        confidence,
        uncertainty_level: classifyUncertainty(confidence),
        evidence_ids: allIds,
      });
    }
    if (lower.includes("phone")) {
      const phoneMatch = lower.match(/(\d+)\s*(phone|mobile|cell)/);
      const confidence = 0.82;
      items.push({
        item_id: `ITEM-${Date.now()}-2`,
        lot_id: lotId,
        category: "mobile_phone",
        quantity: phoneMatch ? parseInt(phoneMatch[1]) : 1,
        condition: "unknown",
        battery_present: true,
        components: [],
        confidence,
        uncertainty_level: classifyUncertainty(confidence),
        evidence_ids: allIds,
      });
    }
    if (lower.includes("battery")) {
      const confidence = 0.88;
      items.push({
        item_id: `ITEM-${Date.now()}-3`,
        lot_id: lotId,
        category: "battery",
        quantity: lower.match(/(\d+)\s*batter/)?.[1] ? parseInt(lower.match(/(\d+)\s*batter/)![1]) : 1,
        condition: lower.includes("swollen") || lower.includes("swelling") ? "damaged" : "unknown",
        battery_present: true,
        components: [],
        confidence,
        uncertainty_level: classifyUncertainty(confidence),
        evidence_ids: allIds,
      });
      if (lower.includes("swollen") || lower.includes("swelling")) {
        const hzConfidence = 0.57;
        hazardSignals.push({
          signal_id: `HZ-${Date.now()}-1`,
          lot_id: lotId,
          type: "possible_battery_swelling",
          confidence: hzConfidence,
          uncertainty_level: classifyUncertainty(hzConfidence),
          severity: "medium",
          evidence_ids: allIds,
          review_required: true,
          verification_status: "pending",
        });
      }
    }
    if (lower.includes("tablet") || lower.includes("ipad")) {
      const confidence = 0.75;
      items.push({
        item_id: `ITEM-${Date.now()}-4`,
        lot_id: lotId,
        category: "tablet",
        quantity: 1,
        condition: "unknown",
        battery_present: true,
        components: [],
        confidence,
        uncertainty_level: classifyUncertainty(confidence),
        evidence_ids: allIds,
      });
    }
  }

  if (items.length === 0 && evidence.length > 0) {
    const confidence = 0.5;
    items.push({
      item_id: `ITEM-${Date.now()}-1`,
      lot_id: lotId,
      category: "mixed_electronics",
      quantity: evidence.length,
      condition: "unknown",
      battery_present: false,
      components: [],
      confidence,
      uncertainty_level: classifyUncertainty(confidence),
      evidence_ids: allIds,
    });
  }

  return {
    lot_id: lotId,
    items,
    hazard_signals: hazardSignals,
    analyzed_at: new Date().toISOString(),
    model_used: isConfigured() ? MODEL_ID : "mock-analysis",
  };
}

function generateId(prefix: string, index: number): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${prefix}-${timestamp}-${index + 1}-${random}`;
}

function mapItems(raw: RawBedrockItem[], lotId: string, evidenceIds: string[]): MaterialItem[] {
  return raw.map((item, i) => {
    const confidence = typeof item.confidence === "number" ? Math.min(1, Math.max(0, item.confidence)) : 0.8;
    return {
      item_id: generateId("ITEM", i),
      lot_id: lotId,
      category: typeof item.category === "string" ? item.category : "unknown",
      quantity: typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1,
      condition: typeof item.condition === "string" ? item.condition : null,
      battery_present: typeof item.battery_present === "boolean" ? item.battery_present : false,
      components: Array.isArray(item.components) ? item.components.filter((c): c is string => typeof c === "string") : [],
      confidence,
      uncertainty_level: classifyUncertainty(confidence),
      evidence_ids: Array.isArray(item.evidence_ids) ? item.evidence_ids.filter((id): id is string => typeof id === "string" && evidenceIds.includes(id)) : evidenceIds,
    };
  });
}

function mapHazardSignals(raw: RawBedrockHazard[], lotId: string, evidenceIds: string[]): HazardSignal[] {
  return raw.map((sig, i) => {
    const confidence = typeof sig.confidence === "number" ? Math.min(1, Math.max(0, sig.confidence)) : 0.8;
    return {
      signal_id: generateId("HZ", i),
      lot_id: lotId,
      type: typeof sig.type === "string" ? sig.type : "unknown_signal",
      confidence,
      uncertainty_level: classifyUncertainty(confidence),
      severity: typeof sig.severity === "string" ? sig.severity : null,
      evidence_ids: Array.isArray(sig.evidence_ids) ? sig.evidence_ids.filter((id): id is string => typeof id === "string" && evidenceIds.includes(id)) : evidenceIds,
      review_required: confidence < 0.7,
      verification_status: "pending" as const,
    };
  });
}

function getYoloUrl(): string {
  let rawUrl = process.env.MY_YOLO_API_URL || process.env.YOLO_API_URL || "";
  if (!rawUrl) return "http://127.0.0.1:8005/material-analysis";
  rawUrl = rawUrl.trim().replace(/\/+$/, "");
  if (!rawUrl.endsWith("/material-analysis")) {
    rawUrl = `${rawUrl}/material-analysis`;
  }
  return rawUrl;
}

async function tryYoloAnalysis(
  evidence: Evidence[],
  lotId: string
): Promise<AnalysisResult | null> {
  const yoloUrl = getYoloUrl();
  if (!yoloUrl) return null;
  const photo = evidence.find((e) => e.type === "photo");
  if (!photo) return null;

  try {
    const fileBuffer = await readFileBuffer(photo.filename);
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: photo.mime_type || "image/jpeg" });
    formData.append("file", blob, photo.original_filename);

    console.log(`[YOLO API] Sending material analysis request to: ${yoloUrl}`);
    const res = await fetch(yoloUrl, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(8000), // 8s timeout to prevent AWS Amplify Lambda gateway timeouts
    });

    if (!res.ok) {
      console.warn(`[YOLO API Error] HTTP ${res.status}: ${res.statusText}`);
      return null;
    }
    const data = await res.json();
    if (!data.success || !data.bedrock) {
      console.warn("[YOLO API Error] Invalid response format from YOLO server:", data);
      return null;
    }

    const evidenceIds = evidence.map((e) => e.evidence_id);
    const items = mapItems(data.bedrock.items || [], lotId, evidenceIds);
    const hazardSignals = mapHazardSignals(data.bedrock.hazard_signals || [], lotId, evidenceIds);

    return {
      lot_id: lotId,
      items,
      hazard_signals: hazardSignals,
      analyzed_at: new Date().toISOString(),
      model_used: "yolov8n + amazon-nova",
    };
  } catch (err) {
    console.warn("[YOLO API Warning] Could not reach YOLO microservice, falling back to direct Bedrock:", err);
    return null;
  }
}

export async function analyzeLot(
  evidence: Evidence[],
  textDescription: string | null,
  lotId: string
): Promise<AnalysisResult> {
  if (evidence.length === 0 && !textDescription) {
    throw new Error("No evidence to analyze. At least one evidence item or text description is required.");
  }

  const evidenceIds = evidence.map((e) => e.evidence_id);

  // Try YOLO microservice if configured
  const yoloResult = await tryYoloAnalysis(evidence, lotId);
  if (yoloResult) return yoloResult;

  if (!isConfigured()) {
    console.log("Bedrock not configured — using mock analysis");
    return generateMockAnalysis(evidence, textDescription, lotId);
  }

  const input = await readEvidenceFiles(evidence);
  const isNova = MODEL_ID.includes("nova");

  let commandBody: string;
  if (isNova) {
    const messages = buildNovaMessages(input, textDescription);
    commandBody = JSON.stringify({
      system: [{ text: ANALYSIS_PROMPT }],
      messages,
      inferenceConfig: {
        maxTokens: 4096,
        temperature: 0.1,
      },
    });
  } else {
    const messages = buildMessages(input, textDescription);
    commandBody = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 4096,
      messages,
      system: ANALYSIS_PROMPT,
    });
  }

  const { accessKeyId, secretAccessKey, region } = getAwsCredentials();
  const client = new BedrockRuntimeClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: commandBody,
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  let rawText = "";
  if (isNova) {
    rawText = responseBody.output?.message?.content?.find((c: { text?: string }) => typeof c.text === "string")?.text || "";
  } else {
    rawText = responseBody.content?.find((c: { type: string; text?: string }) => c.type === "text")?.text || "";
  }

  if (!rawText) {
    throw new Error("No text content in Bedrock response");
  }

  let parsed: unknown;
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
  } catch {
    throw new Error("Failed to parse AI response as JSON");
  }

  if (!validateAnalysis(parsed)) {
    throw new Error("AI response does not match expected schema");
  }

  const items = mapItems(parsed.items || [], lotId, evidenceIds);
  const hazardSignals = mapHazardSignals(parsed.hazard_signals || [], lotId, evidenceIds);

  if (items.length === 0 && hazardSignals.length === 0) {
    throw new Error("AI analysis returned no items or hazard signals");
  }

  return {
    lot_id: lotId,
    items,
    hazard_signals: hazardSignals,
    analyzed_at: new Date().toISOString(),
    model_used: MODEL_ID,
  };
}

