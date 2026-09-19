"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import type { MaterialPassport } from "@/types";

export default function PassportPage() {
  const params = useParams();
  const lotId = params.id as string;
  const [passport, setPassport] = useState<MaterialPassport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPassport = useCallback(async () => {
    if (!lotId) return;
    try {
      const res = await fetch(`/api/lots/${lotId}/passport`);
      if (!res.ok) throw new Error("Passport not found");
      const data = await res.json();
      setPassport(data.passport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load passport");
    } finally {
      setLoading(false);
    }
  }, [lotId]);

  useEffect(() => {
    fetchPassport();
  }, [fetchPassport]);

  if (loading) {
    return (
      <AppShell title="Material Passport">
        <div className="flex items-center justify-center py-20">
          <span className="text-[13px] text-[#666]">Generating passport...</span>
        </div>
      </AppShell>
    );
  }

  if (error || !passport) {
    return (
      <AppShell title="Material Passport">
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-[14px] text-[#ef4444] mb-3">{error || "Passport not found"}</p>
          <Link href={`/lots/${lotId}`} className="text-[12px] text-[#3b82f6] hover:text-[#60a5fa]">
            Back to lot
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Material Passport">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/lots/${lotId}`}
          className="text-[12px] text-[#3b82f6] hover:text-[#60a5fa] transition-colors font-medium"
        >
          ← Back to lot {lotId}
        </Link>
        <a
          href={`/api/lots/${lotId}/passport/download`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-[#16a34a] text-white rounded-md text-[12px] font-semibold hover:bg-[#15803d] transition-colors flex items-center gap-1.5"
        >
          🖨️ Download Passport PDF / Print
        </a>
      </div>

      {/* Passport Header */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-6 mb-6">
        <div className="text-center mb-4">
          <h1 className="text-[18px] font-medium text-[#f0f0f0] tracking-wide">RELOOP MATERIAL PASSPORT</h1>
        </div>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <span className="text-[10px] text-[#444] uppercase tracking-wider block">Passport ID</span>
            <span className="text-[14px] font-mono text-[#f0f0f0]">{passport.passport_id}</span>
          </div>
          <div>
            <span className="text-[10px] text-[#444] uppercase tracking-wider block">Lot ID</span>
            <span className="text-[14px] font-mono text-[#f0f0f0]">{passport.lot_id}</span>
          </div>
          <div>
            <span className="text-[10px] text-[#444] uppercase tracking-wider block">Status</span>
            <StatusPill status={passport.current_status} />
          </div>
          <div>
            <span className="text-[10px] text-[#444] uppercase tracking-wider block">Created</span>
            <span className="text-[12px] text-[#a0a0a0]">{new Date(passport.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Material Summary */}
        <PassportSection title="MATERIAL SUMMARY">
          {passport.material_summary.items.length > 0 ? (
            <div className="space-y-2">
              {passport.material_summary.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-[#1a1a1a] last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[#f0f0f0] capitalize">{item.category.replace(/_/g, " ")}</span>
                    <span className="text-[11px] text-[#666]">×{item.quantity}</span>
                    {item.battery_present && (
                      <span className="text-[9px] text-[#f59e0b] bg-[#422006] px-1.5 py-0.5 rounded">battery</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.condition && (
                      <span className="text-[11px] text-[#666] capitalize">{item.condition.replace(/_/g, " ")}</span>
                    )}
                    {item.components.length > 0 && (
                      <span className="text-[10px] text-[#444]">{item.components.join(", ")}</span>
                    )}
                  </div>
                </div>
              ))}
              <div className="pt-2 text-[11px] text-[#666]">
                Total: {passport.material_summary.total_items} items
              </div>
            </div>
          ) : (
            <span className="text-[12px] text-[#444]">No materials analyzed yet.</span>
          )}
        </PassportSection>

        {/* Original Evidence */}
        <PassportSection title="ORIGINAL EVIDENCE">
          {passport.evidence.length > 0 ? (
            <div className="space-y-1">
              {passport.evidence.map((ev) => (
                <div key={ev.evidence_id} className="flex items-center gap-2 py-1">
                  <EvidenceIcon type={ev.type} />
                  <span className="text-[12px] text-[#a0a0a0]">{ev.filename}</span>
                  <span className="text-[10px] text-[#444] font-mono">{ev.evidence_id}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[12px] text-[#444]">No evidence recorded.</span>
          )}
        </PassportSection>

        {/* AI Understanding */}
        <PassportSection title="AI MATERIAL UNDERSTANDING">
          {passport.ai_understanding.analyzed_at ? (
            <div className="space-y-4">
              <div className="text-[10px] text-[#444]">
                Model: {passport.ai_understanding.model_used} · Analyzed: {new Date(passport.ai_understanding.analyzed_at).toLocaleString()}
              </div>

              {passport.ai_understanding.items.length > 0 && (
                <div>
                  <span className="text-[10px] text-[#444] uppercase tracking-wider">Observations</span>
                  <div className="space-y-2 mt-1">
                    {passport.ai_understanding.items.map((item) => (
                      <div key={item.item_id} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-md p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] text-[#f0f0f0] capitalize">{item.category.replace(/_/g, " ")}</span>
                          <ConfidenceDisplay confidence={item.confidence} uncertainty={item.uncertainty_level} />
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[#666]">
                          <span>Qty: {item.quantity}</span>
                          {item.condition && <span>Condition: {item.condition}</span>}
                          <span>Battery: {item.battery_present ? "Present" : "No"}</span>
                          {item.evidence_ids.length > 0 && (
                            <span>Evidence: {item.evidence_ids.join(", ")}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {passport.ai_understanding.hazard_signals.length > 0 && (
                <div>
                  <span className="text-[10px] text-[#f59e0b] uppercase tracking-wider">Hazard Signals</span>
                  <div className="space-y-2 mt-1">
                    {passport.ai_understanding.hazard_signals.map((signal) => (
                      <div key={signal.signal_id} className="bg-[#422006]/20 border border-[#78350f]/30 rounded-md p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] text-[#f59e0b] capitalize">{signal.type.replace(/_/g, " ")}</span>
                          <ConfidenceDisplay confidence={signal.confidence} uncertainty={signal.uncertainty_level} />
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[#666]">
                          {signal.severity && <span>Severity: {signal.severity}</span>}
                          <span>Review: {signal.review_required ? "Required" : "Not required"}</span>
                          <span>Status: {signal.verification_status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <span className="text-[12px] text-[#444]">Analysis not yet performed.</span>
          )}
        </PassportSection>

        {/* Human Verification */}
        <PassportSection title="HUMAN VERIFICATION">
          {passport.verifications.length > 0 ? (
            <div className="space-y-2">
              {passport.verifications.map((v) => (
                <div key={v.verification_id} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-md p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-[#f0f0f0] capitalize">{v.target_label}</span>
                    <DecisionBadge decision={v.decision} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[#666]">
                    <span>By: {v.verified_by}</span>
                    <span>At: {new Date(v.verified_at).toLocaleString()}</span>
                    {v.note && <span>Note: {v.note}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[12px] text-[#444]">No verifications recorded.</span>
          )}
        </PassportSection>

        {/* Safety Assessment */}
        <PassportSection title="DETERMINISTIC SAFETY ASSESSMENT">
          {passport.safety.evaluated ? (
            <div className="space-y-2">
              {passport.safety.special_handling.length > 0 && (
                <div>
                  <span className="text-[10px] text-[#444] uppercase tracking-wider">Special Handling</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {passport.safety.special_handling.map((h) => (
                      <span key={h} className="text-[10px] text-[#22c55e] bg-[#052e16] px-1.5 py-0.5 rounded">
                        {h.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {passport.safety.blocked && (
                <div>
                  <span className="text-[10px] text-[#ef4444] uppercase tracking-wider">Blocked</span>
                  <div className="mt-1 space-y-0.5">
                    {passport.safety.blocking_reasons.map((reason, i) => (
                      <p key={i} className="text-[11px] text-[#ef4444]/80">- {reason}</p>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-[10px] text-[#444]">
                Evaluated: {new Date(passport.safety.evaluated_at!).toLocaleString()}
              </div>
            </div>
          ) : (
            <span className="text-[12px] text-[#444]">Safety not yet evaluated.</span>
          )}
        </PassportSection>

        {/* Routing Decision */}
        <PassportSection title="ROUTING DECISION">
          {passport.routing.evaluated ? (
            <div className="space-y-3">
              {passport.routing.recommended_facility_name && (
                <div className="bg-[#052e16]/30 border border-[#14532d]/50 rounded-md p-3">
                  <span className="text-[10px] text-[#22c55e] uppercase tracking-wider">Selected Facility</span>
                  <p className="text-[14px] text-[#f0f0f0] mt-1">{passport.routing.recommended_facility_name}</p>
                  <p className="text-[11px] text-[#666] font-mono">{passport.routing.recommended_facility_id}</p>
                </div>
              )}

              {passport.routing.eligible_facilities.length > 0 && (
                <div>
                  <span className="text-[10px] text-[#444] uppercase tracking-wider">All Facilities</span>
                  <div className="space-y-1 mt-1">
                    {passport.routing.eligible_facilities.map((f) => (
                      <div key={f.facility_id} className="flex items-center justify-between text-[11px] py-1">
                        <span className="text-[#a0a0a0]">{f.name}</span>
                        {f.eligible ? (
                          <span className="text-[#22c55e]">Eligible</span>
                        ) : (
                          <span className="text-[#ef4444]">{f.exclusion_reason}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[10px] text-[#444]">
                Evaluated: {new Date(passport.routing.evaluated_at!).toLocaleString()}
              </div>
            </div>
          ) : (
            <span className="text-[12px] text-[#444]">Routing not yet evaluated.</span>
          )}
        </PassportSection>

        {/* Chain of Custody */}
        <PassportSection title="CHAIN OF CUSTODY">
          {passport.lifecycle.events.length > 0 ? (
            <div className="space-y-0">
              {[...passport.lifecycle.events].map((event, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-[#1a1a1a] last:border-0">
                  <span className="text-[10px] text-[#444] font-mono shrink-0 w-16">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  <div className="flex-1">
                    <span className={`text-[11px] font-medium ${
                      event.event_type.includes("blocked") || event.event_type.includes("rejected")
                        ? "text-[#ef4444]"
                        : event.event_type.includes("confirmed") || event.event_type.includes("received")
                        ? "text-[#22c55e]"
                        : "text-[#a0a0a0]"
                    }`}>
                      {event.event_type.replace(/_/g, " ").toUpperCase()}
                    </span>
                    {event.actor && event.actor !== "system" && (
                      <span className="text-[10px] text-[#444] ml-2">by {event.actor}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#333] shrink-0">
                    {new Date(event.timestamp).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[12px] text-[#444]">No lifecycle events recorded.</span>
          )}
        </PassportSection>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-[#2a2a2a] text-center">
        <p className="text-[10px] text-[#444]">
          Generated: {new Date(passport.generated_at).toLocaleString()} · Passport {passport.passport_id}
        </p>
      </div>
    </AppShell>
  );
}

function PassportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
      <h3 className="text-[11px] text-[#666] uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    created: "text-[#666] bg-[#1a1a1a]",
    analyzing: "text-[#3b82f6] bg-[#1e3a5f]",
    analyzed: "text-[#a0a0a0] bg-[#1a1a1a]",
    review_required: "text-[#f59e0b] bg-[#422006]",
    verified: "text-[#22c55e] bg-[#052e16]",
    routing: "text-[#3b82f6] bg-[#1e3a5f]",
    routed: "text-[#22c55e] bg-[#052e16]",
    dispatched: "text-[#22c55e] bg-[#052e16]",
    received: "text-[#22c55e] bg-[#052e16]",
    blocked: "text-[#ef4444] bg-[#450a0a]",
  };
  return (
    <span className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded ${colors[status] || "text-[#666] bg-[#1a1a1a]"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function ConfidenceDisplay({ confidence, uncertainty }: { confidence: number; uncertainty: string }) {
  const pct = Math.round(confidence * 100);
  const color =
    uncertainty === "high"
      ? "text-[#22c55e]"
      : uncertainty === "medium"
      ? "text-[#f59e0b]"
      : "text-[#ef4444]";
  return (
    <span className={`text-[10px] font-mono ${color}`}>
      {pct}% · {uncertainty.toUpperCase()}
    </span>
  );
}

function DecisionBadge({ decision }: { decision: string }) {
  const config: Record<string, { label: string; color: string }> = {
    confirmed: { label: "CONFIRMED", color: "text-[#22c55e] bg-[#052e16]" },
    rejected: { label: "REJECTED", color: "text-[#ef4444] bg-[#450a0a]" },
    cannot_determine: { label: "INCONCLUSIVE", color: "text-[#f59e0b] bg-[#422006]" },
  };
  const c = config[decision] || { label: decision, color: "text-[#666] bg-[#1a1a1a]" };
  return (
    <span className={`text-[9px] font-medium uppercase px-1.5 py-0.5 rounded ${c.color}`}>
      {c.label}
    </span>
  );
}

function EvidenceIcon({ type }: { type: string }) {
  if (type === "photo") {
    return (
      <svg className="w-3.5 h-3.5 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
      </svg>
    );
  }
  if (type === "voice") {
    return (
      <svg className="w-3.5 h-3.5 text-[#a0a0a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    );
  }
  return (
    <svg className="w-3.5 h-3.5 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}
