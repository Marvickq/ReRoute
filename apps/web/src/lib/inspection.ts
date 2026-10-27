import type {
  Evidence,
  InspectionEvidenceRef,
  InspectionRecord,
  MaterialLot,
} from "@/types";
import { saveFileLocally } from "./evidence-files";
import { isS3Configured, uploadToS3 } from "./s3";
import { addEvent } from "./store";
import { auditInspection } from "./audit";
export { inspectionBlockers } from "./inspection-guard";

/** Shape returned by the reloop-yolo service under `inspection` / `visual_evidence`. */
export interface RawInspection {
  outcome: InspectionRecord["outcome"];
  routing_blocked: boolean;
  blocking_reasons: string[];
  reasons: string[];
  steps: InspectionRecord["steps"];
  evidence_requests?: InspectionRecord["evidence_requests"];
  iterations: number;
  max_iterations: number;
  detections: InspectionRecord["detections"];
  quality: { status: string; metrics: Record<string, number> };
  timings_ms?: { total?: number; request_total?: number };
  started_at: string;
  finished_at: string;
  opencv_version?: string;
  detector?: string;
}

export interface RawVisualEvidence {
  annotated_jpeg_b64: string;
  crops: Array<{
    class_name: string;
    confidence: number;
    bbox: number[];
    jpeg_b64: string;
  }>;
}

export function buildUnavailableInspection(lotId: string, sourceEvidenceId: string, why: string): InspectionRecord {
  const now = new Date().toISOString();
  return {
    inspection_id: `INS-${Date.now()}`,
    lot_id: lotId,
    source_evidence_id: sourceEvidenceId,
    outcome: "HUMAN_REVIEW_REQUIRED",
    quality_status: null,
    quality_metrics: {},
    reasons: [why],
    routing_blocked: true,
    blocking_reasons: [`Automated visual inspection unavailable (${why}); human review required before routing`],
    steps: [],
    evidence_requests: [],
    iterations: 0,
    max_iterations: null,
    detections: [],
    evidence_refs: [],
    opencv_version: null,
    detector: null,
    service_available: false,
    total_ms: null,
    started_at: now,
    finished_at: now,
    resolution: null,
  };
}

async function persistDerived(
  lotId: string,
  sourceEvidenceId: string,
  kind: "annotated" | "crop",
  b64: string,
  index: number,
  extra: Partial<InspectionEvidenceRef>
): Promise<InspectionEvidenceRef> {
  const buffer = Buffer.from(b64, "base64");
  const refId = `EVD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${kind}${index}`;
  const filename = `${refId}.jpg`;
  await saveFileLocally(filename, buffer);

  let s3Key: string | undefined;
  if (isS3Configured()) {
    try {
      s3Key = (await uploadToS3(filename, buffer, "image/jpeg")).s3Key;
    } catch (err) {
      console.warn("[Inspection] S3 upload of derived evidence failed:", err);
    }
  }
  return {
    ref_id: refId,
    kind,
    lot_id: lotId,
    source_evidence_id: sourceEvidenceId,
    filename,
    url: `/api/uploads/${filename}`,
    s3_key: s3Key,
    created_at: new Date().toISOString(),
    ...extra,
  };
}

/** Persist the service's inspection result (and its OpenCV-derived images) on the lot. */
export async function recordInspection(
  lot: MaterialLot,
  source: Evidence,
  raw: RawInspection,
  visual: RawVisualEvidence | null
): Promise<InspectionRecord> {
  const refs: InspectionEvidenceRef[] = [];
  if (visual) {
    try {
      refs.push(await persistDerived(lot.lot_id, source.evidence_id, "annotated", visual.annotated_jpeg_b64, 0, {}));
      for (const [i, c] of visual.crops.entries()) {
        refs.push(
          await persistDerived(lot.lot_id, source.evidence_id, "crop", c.jpeg_b64, i + 1, {
            label: c.class_name,
            confidence: c.confidence,
            bbox: c.bbox,
          })
        );
      }
    } catch (err) {
      console.warn("[Inspection] Could not store derived evidence:", err);
    }
  }

  const record: InspectionRecord = {
    inspection_id: `INS-${Date.now()}`,
    lot_id: lot.lot_id,
    source_evidence_id: source.evidence_id,
    outcome: raw.outcome,
    quality_status: raw.quality?.status ?? null,
    quality_metrics: raw.quality?.metrics ?? {},
    reasons: raw.reasons ?? [],
    routing_blocked: Boolean(raw.routing_blocked),
    blocking_reasons: raw.blocking_reasons ?? [],
    steps: raw.steps ?? [],
    evidence_requests: raw.evidence_requests ?? [],
    iterations: raw.iterations ?? (raw.steps?.length ?? 0),
    max_iterations: raw.max_iterations ?? null,
    detections: raw.detections ?? [],
    evidence_refs: refs,
    opencv_version: raw.opencv_version ?? null,
    detector: raw.detector ?? null,
    service_available: true,
    total_ms: raw.timings_ms?.request_total ?? raw.timings_ms?.total ?? null,
    started_at: raw.started_at,
    finished_at: raw.finished_at,
    resolution: null,
  };
  attachInspection(lot, record);
  return record;
}

export function attachInspection(lot: MaterialLot, record: InspectionRecord): void {
  if (lot.inspection) {
    (lot.inspection_history ||= []).push(lot.inspection);
  }
  lot.inspection = record;
  addEvent(lot.lot_id, "inspection_completed", "system", {
    inspection_id: record.inspection_id,
    outcome: record.outcome,
    quality_status: record.quality_status,
    routing_blocked: record.routing_blocked,
    reasons: record.reasons,
    evidence_refs: record.evidence_refs.map((r) => r.ref_id),
    opencv_version: record.opencv_version,
  });
  auditInspection(lot, record);
}
