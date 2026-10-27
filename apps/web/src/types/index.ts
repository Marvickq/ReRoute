export type LotStatus =
  | "created"
  | "analyzing"
  | "analyzed"
  | "analysis_failed"
  | "safety_review"
  | "review_required"
  | "verified"
  | "routing"
  | "routed"
  | "dispatched"
  | "received"
  | "blocked";

export type EvidenceType = "photo" | "voice" | "text";

export type VerificationStatus = "pending" | "confirmed" | "rejected" | "cannot_determine";

export type UncertaintyLevel = "high" | "medium" | "low";

export type VerificationDecision = "confirmed" | "rejected" | "cannot_determine";

export type EventType =
  | "lot_created"
  | "ai_analyzed"
  | "review_requested"
  | "verification_confirmed"
  | "verification_rejected"
  | "verification_undetermined"
  | "safety_review_requested"
  | "routing_completed"
  | "lot_dispatched"
  | "lot_received"
  | "lot_blocked"
  | "lot_unblocked"
  | "inspection_completed"
  | "inspection_resolved"
  | "inspection_retake_requested";

export type InspectionOutcome =
  | "READY_FOR_HUMAN_VERIFICATION"
  | "HUMAN_REVIEW_REQUIRED"
  | "RETAKE_REQUIRED";

export interface InspectionEvidenceRef {
  ref_id: string;
  kind: "annotated" | "crop";
  lot_id: string;
  source_evidence_id: string;
  filename: string;
  url: string;
  s3_key?: string;
  label?: string;
  confidence?: number;
  bbox?: number[];
  created_at: string;
}

export interface InspectionToolCall {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
  latency_ms: number;
}

export interface InspectionStep {
  iteration: number;
  timestamp: string;
  observation: Record<string, unknown>;
  decision: string;
  action: string;
  tool_calls: InspectionToolCall[];
  outcome: string;
  latency_ms: number;
}

export interface EvidenceRequest {
  kind: "quality_retake" | "wider_view" | "close_up" | "missing_view";
  instruction: string;
  reason: string;
  blocking?: boolean;
  target_class?: string;
  target_bbox?: number[];
  check?: string;
}

export type AuditEntryType =
  | "observation"
  | "decision"
  | "tool_call"
  | "action"
  | "result"
  | "inspection_outcome"
  | "human_approval"
  | "retake"
  | "enforcement_block"
  | "routing_decision";

/** Append-only, hash-chained record; see lib/audit.ts. */
export interface AuditEntry {
  seq: number;
  timestamp: string;
  actor: string;
  type: AuditEntryType;
  inspection_id?: string;
  summary: string;
  details: Record<string, unknown>;
  evidence_refs: string[];
  prev_hash: string;
  hash: string;
}

export interface InspectionResolution {
  resolved_by: string;
  resolved_at: string;
  note: string;
}

export interface InspectionRecord {
  inspection_id: string;
  lot_id: string;
  source_evidence_id: string;
  outcome: InspectionOutcome;
  /** Image-quality gate result: ACCEPT | RETAKE_REQUIRED | MANUAL_REVIEW */
  quality_status: string | null;
  quality_metrics: Record<string, number>;
  reasons: string[];
  routing_blocked: boolean;
  blocking_reasons: string[];
  steps: InspectionStep[];
  evidence_requests: EvidenceRequest[];
  iterations: number;
  max_iterations: number | null;
  detections: Array<{ class_name: string; confidence: number; bbox: number[]; crop_confirmed?: boolean; uncertain?: boolean }>;
  evidence_refs: InspectionEvidenceRef[];
  opencv_version: string | null;
  detector: string | null;
  service_available: boolean;
  total_ms: number | null;
  started_at: string;
  finished_at: string;
  /** Set only by a human via the backend; AI output is never a verification. */
  resolution: InspectionResolution | null;
}

export interface Verification {
  verification_id: string;
  lot_id: string;
  target_type: "material" | "hazard";
  target_id: string;
  decision: VerificationDecision;
  note: string | null;
  verified_at: string;
  verified_by: string;
}

export interface Event {
  event_id: string;
  lot_id: string;
  event_type: EventType;
  timestamp: string;
  actor: string;
  metadata: Record<string, unknown>;
}

export interface SafetyResult {
  lot_id: string;
  requires_human_review: boolean;
  blocked: boolean;
  blocking_reasons: string[];
  special_handling: string[];
  evaluated_at: string;
}

export interface FacilityEligibility {
  facility_id: string;
  eligible: boolean;
  material_compatible: boolean;
  handling_capable: boolean;
  has_capacity: boolean;
  available: boolean;
  exclusion_reason: string | null;
}

export interface RoutingResult {
  lot_id: string;
  eligible_facilities: FacilityEligibility[];
  recommended_facility_id: string | null;
  routing_blocked: boolean;
  blocking_reasons: string[];
  evaluated_at: string;
}

export interface Evidence {
  evidence_id: string;
  lot_id: string;
  type: EvidenceType;
  filename: string;
  original_filename: string;
  mime_type: string;
  size: number;
  url: string;
  s3_key?: string;
  created_at: string;
}

export interface TextEvidence {
  evidence_id: string;
  lot_id: string;
  type: "text";
  content: string;
  created_at: string;
}

export interface MaterialItem {
  item_id: string;
  lot_id: string;
  category: string;
  quantity: number;
  condition: string | null;
  battery_present: boolean;
  components: string[];
  confidence: number;
  uncertainty_level: UncertaintyLevel;
  evidence_ids: string[];
}

export interface HazardSignal {
  signal_id: string;
  lot_id: string;
  type: string;
  confidence: number;
  uncertainty_level: UncertaintyLevel;
  severity: string | null;
  evidence_ids: string[];
  review_required: boolean;
  verification_status: VerificationStatus;
}

export interface AnalysisResult {
  lot_id: string;
  items: MaterialItem[];
  hazard_signals: HazardSignal[];
  analyzed_at: string;
  model_used: string;
}

export interface MaterialLot {
  lot_id: string;
  created_at: string;
  updated_at: string;
  status: LotStatus;
  text_description: string | null;
  evidence: Evidence[];
  material_items: MaterialItem[];
  hazard_signals: HazardSignal[];
  analysis: AnalysisResult | null;
  verification_status: VerificationStatus;
  selected_facility_id: string | null;
  passport_id: string | null;
  safety_result: SafetyResult | null;
  routing_result: RoutingResult | null;
  events: Event[];
  verifications: Verification[];
  inspection?: InspectionRecord | null;
  inspection_history?: InspectionRecord[];
  audit_trail?: AuditEntry[];
  dispatched_at: string | null;
  received_at: string | null;
}

export interface ReviewQueueItem {
  lot_id: string;
  lot_created_at: string;
  target_type: "material" | "hazard";
  target_id: string;
  target_label: string;
  category: string;
  confidence: number;
  uncertainty_level: UncertaintyLevel;
  evidence_count: number;
  verification_status: VerificationStatus;
  verified_at: string | null;
}

export interface MaterialPassport {
  passport_id: string;
  lot_id: string;
  created_at: string;
  generated_at: string;
  current_status: LotStatus;

  material_summary: {
    items: Array<{
      category: string;
      quantity: number;
      condition: string | null;
      battery_present: boolean;
      components: string[];
    }>;
    total_items: number;
  };

  evidence: Array<{
    evidence_id: string;
    type: EvidenceType;
    filename: string;
    url: string;
  }>;

  ai_understanding: {
    items: Array<{
      item_id: string;
      category: string;
      quantity: number;
      condition: string | null;
      battery_present: boolean;
      components: string[];
      confidence: number;
      uncertainty_level: UncertaintyLevel;
      evidence_ids: string[];
    }>;
    hazard_signals: Array<{
      signal_id: string;
      type: string;
      confidence: number;
      uncertainty_level: UncertaintyLevel;
      severity: string | null;
      evidence_ids: string[];
      review_required: boolean;
      verification_status: VerificationStatus;
    }>;
    model_used: string | null;
    analyzed_at: string | null;
  };

  verifications: Array<{
    verification_id: string;
    target_type: "material" | "hazard";
    target_id: string;
    target_label: string;
    decision: VerificationDecision;
    note: string | null;
    verified_by: string;
    verified_at: string;
  }>;

  safety: {
    evaluated: boolean;
    requires_human_review: boolean;
    blocked: boolean;
    blocking_reasons: string[];
    special_handling: string[];
    evaluated_at: string | null;
  };

  routing: {
    evaluated: boolean;
    recommended_facility_id: string | null;
    recommended_facility_name: string | null;
    routing_blocked: boolean;
    blocking_reasons: string[];
    eligible_facilities: Array<{
      facility_id: string;
      name: string;
      eligible: boolean;
      exclusion_reason: string | null;
    }>;
    evaluated_at: string | null;
  };

  lifecycle: {
    current_status: LotStatus;
    created_at: string;
    updated_at: string;
    dispatched_at: string | null;
    received_at: string | null;
    events: Array<{
      event_type: string;
      timestamp: string;
      actor: string;
      metadata: Record<string, unknown>;
    }>;
  };
}

export interface CreateLotRequest {
  text?: string;
  evidence_ids: string[];
}

export interface CreateLotResponse {
  lot: MaterialLot;
}

export interface UploadEvidenceResponse {
  evidence: Evidence;
}

export interface Facility {
  facility_id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  accepted_materials: string[];
  handling_capabilities: string[];
  capacity: number;
  available: boolean;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}
