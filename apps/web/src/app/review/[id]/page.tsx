"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import type {
  MaterialLot,
  Verification,
  VerificationDecision,
  MaterialItem,
  HazardSignal,
  Evidence,
} from "@/types";

export default function ReviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const lotId = params.id as string;
  const [lot, setLot] = useState<MaterialLot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<VerificationDecision | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [existingVerification, setExistingVerification] = useState<Verification | null>(null);

  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const targetParam = searchParams?.get("target");
  const [targetType, targetId] = targetParam?.split(":") || ["", ""];

  const fetchLot = useCallback(async () => {
    if (!lotId) return;
    try {
      const res = await fetch(`/api/lots/${lotId}`);
      if (!res.ok) throw new Error("Lot not found");
      const data = await res.json();
      setLot(data.lot);

      const verRes = await fetch(`/api/lots/${lotId}/verification`);
      const verData = await verRes.json();
      const existing = verData.verifications.find(
        (v: Verification) => v.target_type === targetType && v.target_id === targetId
      );
      if (existing) {
        setExistingVerification(existing);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [lotId, targetType, targetId]);

  useEffect(() => {
    fetchLot();
  }, [fetchLot]);

  const handleSubmit = async () => {
    if (!lot || !decision || !targetType || !targetId) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/lots/${lot.lot_id}/verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          decision,
          note: note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }
      setExistingVerification(data.verification);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppShell title="Review">
        <div className="flex items-center justify-center py-20">
          <span className="text-[13px] text-[#666]">Loading review...</span>
        </div>
      </AppShell>
    );
  }

  if (error || !lot) {
    return (
      <AppShell title="Review">
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-[14px] text-[#ef4444] mb-3">{error || "Lot not found"}</p>
          <Link href="/review" className="text-[12px] text-[#3b82f6] hover:text-[#60a5fa]">
            Back to review queue
          </Link>
        </div>
      </AppShell>
    );
  }

  if (!targetType || !targetId) {
    return (
      <AppShell title="Review">
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-[14px] text-[#ef4444] mb-3">Missing target parameter</p>
          <Link href="/review" className="text-[12px] text-[#3b82f6] hover:text-[#60a5fa]">
            Back to review queue
          </Link>
        </div>
      </AppShell>
    );
  }

  const isHazard = targetType === "hazard";
  const target = isHazard
    ? lot.hazard_signals.find((s) => s.signal_id === targetId)
    : lot.material_items.find((item) => item.item_id === targetId);

  if (!target) {
    return (
      <AppShell title="Review">
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-[14px] text-[#ef4444] mb-3">Target observation not found</p>
          <Link href="/review" className="text-[12px] text-[#3b82f6] hover:text-[#60a5fa]">
            Back to review queue
          </Link>
        </div>
      </AppShell>
    );
  }

  const linkedEvidence = lot.evidence.filter((e) =>
    (target as MaterialItem | HazardSignal).evidence_ids.includes(e.evidence_id)
  );

  const alreadyVerified = existingVerification !== null;

  return (
    <AppShell title={`Review — ${lot.lot_id}`}>
      <div className="mb-4">
        <Link
          href="/review"
          className="text-[12px] text-[#3b82f6] hover:text-[#60a5fa] transition-colors"
        >
          ← Back to review queue
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {/* Evidence Section */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
            <h3 className="text-[11px] text-[#666] uppercase tracking-wider mb-3">
              Original Evidence
            </h3>
            {linkedEvidence.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {linkedEvidence.map((ev) => (
                  <EvidencePreview key={ev.evidence_id} evidence={ev} />
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-[#444]">No linked evidence found.</p>
            )}
          </div>

          {/* AI Observation Section */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
            <h3 className="text-[11px] text-[#666] uppercase tracking-wider mb-3">
              AI Observation
            </h3>
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-md p-4">
              {isHazard ? (
                <HazardObservation signal={target as HazardSignal} />
              ) : (
                <MaterialObservation item={target as MaterialItem} />
              )}
            </div>
          </div>

          {/* Human Verification Section */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
            <h3 className="text-[11px] text-[#666] uppercase tracking-wider mb-3">
              Human Verification
            </h3>

            {alreadyVerified ? (
              <div className="space-y-3">
                <VerificationBadge decision={existingVerification!.decision} />
                <div className="text-[12px] text-[#a0a0a0]">
                  <p>Decision: <span className="capitalize">{existingVerification!.decision.replace(/_/g, " ")}</span></p>
                  {existingVerification!.note && (
                    <p className="mt-1">Note: {existingVerification!.note}</p>
                  )}
                  <p className="text-[11px] text-[#444] mt-1">
                    Verified by {existingVerification!.verified_by} at{" "}
                    {new Date(existingVerification!.verified_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-[12px] text-[#a0a0a0]">
                  Review the original evidence and AI observation above, then select your verification decision.
                </p>

                <div className="flex gap-2">
                  {(["confirmed", "rejected", "cannot_determine"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDecision(d)}
                      className={`px-4 py-2 rounded-md text-[12px] font-medium transition-colors border ${
                        decision === d
                          ? d === "confirmed"
                            ? "bg-[#052e16] border-[#14532d] text-[#22c55e]"
                            : d === "rejected"
                            ? "bg-[#450a0a] border-[#7f1d1d] text-[#ef4444]"
                            : "bg-[#422006] border-[#78350f] text-[#f59e0b]"
                          : "bg-[#1a1a1a] border-[#2a2a2a] text-[#666] hover:bg-[#222]"
                      }`}
                    >
                      {d === "confirmed" ? "CONFIRM" : d === "rejected" ? "REJECT" : "CANNOT DETERMINE"}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-[11px] text-[#444] block mb-1">Verification note (optional)</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-md px-3 py-2 text-[12px] text-[#a0a0a0] focus:outline-none focus:border-[#3b82f6]"
                    rows={2}
                    placeholder="Add context for this decision..."
                  />
                </div>

                {submitError && (
                  <div className="bg-[#450a0a] border border-[#7f1d1d] rounded-md px-3 py-2">
                    <p className="text-[12px] text-[#ef4444]">{submitError}</p>
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={!decision || submitting}
                  className="px-4 py-2 bg-[#1e3a5f] border border-[#2563eb]/30 rounded-md text-[12px] text-[#3b82f6] hover:bg-[#1e4070] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? "Submitting..." : "Submit Verification"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
            <h3 className="text-[13px] font-medium text-[#f0f0f0] mb-3">Context</h3>
            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between">
                <span className="text-[#666]">Lot</span>
                <span className="text-[#a0a0a0] font-mono">{lot.lot_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666]">Target</span>
                <span className="text-[#a0a0a0] font-mono">{targetType}-{targetId.slice(-6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666]">Confidence</span>
                <span className="text-[#a0a0a0]">{Math.round(target.confidence * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666]">Uncertainty</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                  target.uncertainty_level === "low"
                    ? "text-[#ef4444] bg-[#450a0a]"
                    : target.uncertainty_level === "medium"
                    ? "text-[#f59e0b] bg-[#422006]"
                    : "text-[#22c55e] bg-[#052e16]"
                }`}>
                  {target.uncertainty_level.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666]">Evidence</span>
                <span className="text-[#a0a0a0]">{linkedEvidence.length} items</span>
              </div>
            </div>
          </div>

          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
            <h3 className="text-[13px] font-medium text-[#f0f0f0] mb-3">Instructions</h3>
            <div className="space-y-2 text-[11px] text-[#666]">
              <p>1. Review the original evidence (photos, text, voice)</p>
              <p>2. Compare with the AI observation</p>
              <p>3. Select CONFIRM, REJECT, or CANNOT DETERMINE</p>
              <p>4. Optionally add a note</p>
              <p>5. Submit your verification</p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function EvidencePreview({ evidence }: { evidence: Evidence }) {
  const [loaded, setLoaded] = useState(false);

  if (evidence.type === "photo") {
    return (
      <div className="relative rounded-md overflow-hidden border border-[#2a2a2a] bg-[#0a0a0a]">
        <img
          src={evidence.url}
          alt={evidence.original_filename}
          className="w-full aspect-square object-cover"
          onLoad={() => setLoaded(true)}
          style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.2s" }}
        />
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] text-[#444]">Loading...</span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
          <span className="text-[10px] text-[#a0a0a0]">{evidence.original_filename}</span>
        </div>
      </div>
    );
  }

  if (evidence.type === "voice") {
    return (
      <div className="rounded-md border border-[#2a2a2a] bg-[#0a0a0a] p-3">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-[#a0a0a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
          <span className="text-[11px] text-[#a0a0a0]">{evidence.original_filename}</span>
        </div>
        <audio controls className="w-full h-8" preload="metadata">
          <source src={evidence.url} type={evidence.mime_type} />
        </audio>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[#2a2a2a] bg-[#0a0a0a] p-3">
      <span className="text-[11px] text-[#a0a0a0]">{evidence.original_filename}</span>
    </div>
  );
}

function MaterialObservation({ item }: { item: MaterialItem }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[13px] font-medium text-[#f0f0f0] capitalize">
          {item.category.replace(/_/g, " ")}
        </span>
        <span className="text-[11px] text-[#666]">×{item.quantity}</span>
        <span className={`text-[9px] font-medium uppercase px-1.5 py-0.5 rounded ${
          item.uncertainty_level === "low"
            ? "text-[#ef4444] bg-[#450a0a]"
            : item.uncertainty_level === "medium"
            ? "text-[#f59e0b] bg-[#422006]"
            : "text-[#22c55e] bg-[#052e16]"
        }`}>
          {item.uncertainty_level}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        {item.condition && (
          <div><span className="text-[#444]">Condition:</span> <span className="text-[#a0a0a0] capitalize">{item.condition.replace(/_/g, " ")}</span></div>
        )}
        <div><span className="text-[#444]">Battery:</span> <span className="text-[#a0a0a0]">{item.battery_present ? "Present" : "Not detected"}</span></div>
        {item.components.length > 0 && (
          <div className="col-span-2"><span className="text-[#444]">Components:</span> <span className="text-[#a0a0a0]">{item.components.join(", ")}</span></div>
        )}
      </div>
    </div>
  );
}

function HazardObservation({ signal }: { signal: HazardSignal }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[13px] font-medium text-[#f59e0b] capitalize">
          {signal.type.replace(/_/g, " ")}
        </span>
        <span className={`text-[9px] font-medium uppercase px-1.5 py-0.5 rounded ${
          signal.uncertainty_level === "low"
            ? "text-[#ef4444] bg-[#450a0a]"
            : signal.uncertainty_level === "medium"
            ? "text-[#f59e0b] bg-[#422006]"
            : "text-[#22c55e] bg-[#052e16]"
        }`}>
          {signal.uncertainty_level}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        {signal.severity && (
          <div><span className="text-[#444]">Severity:</span> <span className="text-[#a0a0a0] capitalize">{signal.severity}</span></div>
        )}
        <div><span className="text-[#444]">Review required:</span> <span className="text-[#a0a0a0]">{signal.review_required ? "Yes" : "No"}</span></div>
      </div>
    </div>
  );
}

function VerificationBadge({ decision }: { decision: VerificationDecision }) {
  const config = {
    confirmed: { label: "CONFIRMED", color: "text-[#22c55e] bg-[#052e16] border-[#14532d]" },
    rejected: { label: "REJECTED", color: "text-[#ef4444] bg-[#450a0a] border-[#7f1d1d]" },
    cannot_determine: { label: "CANNOT DETERMINE", color: "text-[#f59e0b] bg-[#422006] border-[#78350f]" },
  };
  const c = config[decision];
  return (
    <span className={`text-[11px] font-medium uppercase px-2 py-1 rounded border ${c.color}`}>
      {c.label}
    </span>
  );
}
