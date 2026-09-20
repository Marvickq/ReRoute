"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import type { MaterialLot, Evidence, MaterialItem, HazardSignal, UncertaintyLevel, SafetyResult, RoutingResult, FacilityEligibility } from "@/types";
import { FACILITIES } from "@/lib/facilities";
import { getLifecycleSteps, areAllRequiredObservationsVerified } from "@/lib/lifecycle";

export default function LotDetailPage() {
  const params = useParams();
  const lotId = params.id as string;
  const [lot, setLot] = useState<MaterialLot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [transitionLoading, setTransitionLoading] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const fetchLot = useCallback(async () => {
    if (!lotId) return;
    try {
      const res = await fetch(`/api/lots/${lotId}`);
      if (!res.ok) throw new Error("Lot not found");
      const data = await res.json();
      setLot(data.lot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lot");
    } finally {
      setLoading(false);
    }
  }, [lotId]);

  useEffect(() => {
    fetchLot();
  }, [fetchLot]);

  const handleAnalyze = async () => {
    if (!lot) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setLot((prev) => (prev ? { ...prev, status: "analyzing" } : prev));

    try {
      const res = await fetch(`/api/lots/${lot.lot_id}/analyze`, { method: "POST" });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Server response error (${res.status}). Please try again.`);
      }
      if (!res.ok) {
        throw new Error(data.error || "Analysis failed");
      }
      setLot((prev) => (prev ? { ...prev, status: "analyzed", analysis: data.analysis, material_items: data.analysis.items, hazard_signals: data.analysis.hazard_signals } : prev));
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Analysis failed");
      setLot((prev) => (prev ? { ...prev, status: "analysis_failed" } : prev));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGetRouting = async () => {
    if (!lot) return;
    setRoutingLoading(true);
    setRoutingError(null);

    try {
      const res = await fetch(`/api/lots/${lot.lot_id}/routing`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Routing evaluation failed");
      }
      await fetchLot();
    } catch (err) {
      setRoutingError(err instanceof Error ? err.message : "Routing failed");
    } finally {
      setRoutingLoading(false);
    }
  };

  const handleVerifyObservation = async (
    target_type: "material" | "hazard",
    target_id: string,
    decision: "confirmed" | "rejected" | "cannot_determine"
  ) => {
    if (!lot) return;
    try {
      const res = await fetch(`/api/lots/${lot.lot_id}/verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type, target_id, decision }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Verification failed");
      }
      await fetchLot();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Verification failed");
    }
  };

  const handleVerifyAllObservations = async () => {
    if (!lot || !lot.analysis) return;
    try {
      const unverifiedItems = lot.material_items.filter(
        (item) => !lot.verifications.some((v) => v.target_type === "material" && v.target_id === item.item_id)
      );
      const unverifiedHazards = lot.hazard_signals.filter(
        (signal) => !lot.verifications.some((v) => v.target_type === "hazard" && v.target_id === signal.signal_id)
      );

      for (const item of unverifiedItems) {
        await fetch(`/api/lots/${lot.lot_id}/verification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_type: "material", target_id: item.item_id, decision: "confirmed" }),
        });
      }

      for (const signal of unverifiedHazards) {
        await fetch(`/api/lots/${lot.lot_id}/verification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_type: "hazard", target_id: signal.signal_id, decision: "confirmed" }),
        });
      }

      await fetchLot();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Bulk verification failed");
    }
  };

  const handleTransition = async (action: "dispatch" | "receive" | "unblock") => {
    if (!lot) return;
    setTransitionLoading(true);
    setTransitionError(null);

    try {
      const res = await fetch(`/api/lots/${lot.lot_id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, actor: "demo_operator" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Transition failed");
      }
      setLot(data.lot);
      if (action === "unblock") {
        await handleGetRouting();
      }
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : "Transition failed");
    } finally {
      setTransitionLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell title="Material Lot">
        <div className="flex items-center justify-center py-20">
          <span className="text-[13px] text-[#666]">Loading lot...</span>
        </div>
      </AppShell>
    );
  }

  if (error || !lot) {
    return (
      <AppShell title="Material Lot">
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-[14px] text-[#ef4444] mb-3">{error || "Lot not found"}</p>
          <Link href="/lots" className="text-[12px] text-[#3b82f6] hover:text-[#60a5fa]">
            Back to lots
          </Link>
        </div>
      </AppShell>
    );
  }

  const photos = lot.evidence.filter((e) => e.type === "photo");
  const voices = lot.evidence.filter((e) => e.type === "voice");
  const hasAnalysis = Boolean(lot.analysis);
  const hasRouting = lot.routing_result !== null;
  const canAnalyze = (lot.status === "created" || lot.status === "analysis_failed") && (lot.evidence.length > 0 || lot.text_description);
  const canRoute = hasAnalysis && !hasRouting && lot.status !== "blocked" && areAllRequiredObservationsVerified(lot);
  const canDispatch = lot.status === "routed";
  const canReceive = lot.status === "dispatched";
  const canUnblock = lot.status === "blocked";

  const lifecycleSteps = getLifecycleSteps(lot);

  return (
    <AppShell title={`Lot ${lot.lot_id}`}>
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <span className="font-mono">{lot.lot_id}</span>
            <StatusBadge status={lot.status} />
          </div>
        }
        description={`Created ${new Date(lot.created_at).toLocaleString()}`}
        action={
          <div className="flex items-center gap-2">
            {(lot.analysis || lot.passport_id) && (
              <>
                <Link
                  href={`/lots/${lot.lot_id}/passport`}
                  className="px-3 py-1.5 bg-[#14532d]/40 border border-[#22c55e]/50 rounded-md text-[12px] font-medium text-[#22c55e] hover:bg-[#14532d]/70 transition-colors flex items-center gap-1.5"
                >
                  📄 View Passport
                </Link>
                <a
                  href={`/api/lots/${lot.lot_id}/passport/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-[#1e3a5f]/60 border border-[#3b82f6]/50 rounded-md text-[12px] font-medium text-[#60a5fa] hover:bg-[#1e3a5f] transition-colors flex items-center gap-1.5"
                >
                  📥 Download PDF
                </a>
              </>
            )}
            <Link
              href="/lots"
              className="px-3 py-1.5 bg-[#222] border border-[#333] rounded-md text-[12px] text-[#a0a0a0] hover:bg-[#2a2a2a] transition-colors"
            >
              Back to lots
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {/* Text Description */}
          {lot.text_description && (
            <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
              <h3 className="text-[13px] font-medium text-[#f0f0f0] mb-3">Text Description</h3>
              <p className="text-[13px] text-[#a0a0a0] leading-relaxed">{lot.text_description}</p>
            </div>
          )}

          {/* Photo Evidence */}
          {photos.length > 0 && (
            <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
              <h3 className="text-[13px] font-medium text-[#f0f0f0] mb-4">
                Photo Evidence ({photos.length})
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {photos.map((ev) => (
                  <EvidenceCard key={ev.evidence_id} evidence={ev} />
                ))}
              </div>
            </div>
          )}

          {/* Voice Evidence */}
          {voices.length > 0 && (
            <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
              <h3 className="text-[13px] font-medium text-[#f0f0f0] mb-4">
                Voice Evidence ({voices.length})
              </h3>
              <div className="space-y-3">
                {voices.map((ev) => (
                  <div key={ev.evidence_id} className="flex items-center gap-3 p-3 bg-[#0a0a0a] rounded-md border border-[#2a2a2a]">
                    <svg className="w-5 h-5 text-[#22c55e] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[#a0a0a0]">{ev.original_filename}</p>
                      <audio controls src={ev.url} className="w-full h-8 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Original Evidence Label */}
          {lot.evidence.length > 0 && (
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <span className="text-[11px] text-[#666] uppercase tracking-wider">Original Evidence</span>
              </div>
              <p className="text-[12px] text-[#444]">
                This is the raw captured input. AI interpretation has not yet been applied.
              </p>
            </div>
          )}

          {/* AI Material Understanding */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-medium text-[#f0f0f0]">AI Material Understanding</h3>
              <div className="flex items-center gap-2">
                {hasAnalysis && (
                  lot.analysis!.items.some((i) => !lot.verifications.some((v) => v.target_type === "material" && v.target_id === i.item_id)) ||
                  lot.analysis!.hazard_signals.some((s) => !lot.verifications.some((v) => v.target_type === "hazard" && v.target_id === s.signal_id))
                ) && (
                  <button
                    onClick={handleVerifyAllObservations}
                    className="px-3 py-1.5 bg-[#14532d]/60 border border-[#22c55e]/50 rounded-md text-[12px] font-medium text-[#22c55e] hover:bg-[#14532d] transition-colors flex items-center gap-1.5"
                  >
                    ✓ Verify All Observations
                  </button>
                )}
                {canAnalyze && !analyzing && (
                  <button
                    onClick={handleAnalyze}
                    className="px-4 py-1.5 bg-[#3b82f6] text-white rounded-md text-[12px] font-medium hover:bg-[#2563eb] transition-colors"
                  >
                    Analyze with AI
                  </button>
                )}
              </div>
            </div>

            {lot.status === "analyzing" && (
              <div className="flex items-center gap-3 py-8 justify-center">
                <div className="w-4 h-4 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
                <span className="text-[13px] text-[#3b82f6]">Analyzing evidence...</span>
              </div>
            )}

            {lot.status === "analysis_failed" && (
              <div className="py-6">
                <div className="bg-[#450a0a] border border-[#7f1d1d] rounded-md p-4 mb-3">
                  <p className="text-[12px] text-[#ef4444]">
                    {analysisError || "Analysis failed. The AI could not process this evidence."}
                  </p>
                </div>
                <button
                  onClick={handleAnalyze}
                  className="px-4 py-1.5 bg-[#222] border border-[#333] rounded-md text-[12px] text-[#a0a0a0] hover:bg-[#2a2a2a] transition-colors"
                >
                  Retry Analysis
                </button>
              </div>
            )}

            {!hasAnalysis && lot.status !== "analyzing" && lot.status !== "analysis_failed" && (
              <div className="py-8 text-center">
                <svg className="w-8 h-8 mx-auto mb-3 text-[#333]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5m-4.25-11.396c.251.023.501.05.75.082M12 20.25a4.5 4.5 0 01-1.423-8.795c.148-.016.298-.03.449-.045a24.301 24.301 0 014.5 0c.151.015.301.029.449.045A4.5 4.5 0 0112 20.25z" />
                </svg>
                <p className="text-[13px] text-[#666] mb-1">Analysis not yet performed</p>
                <p className="text-[11px] text-[#444]">Click &quot;Analyze with AI&quot; to extract structured material intelligence.</p>
              </div>
            )}

            {hasAnalysis && (
              <div className="space-y-4">
                {/* Uncertainty Summary */}
                <UncertaintySummary items={lot.analysis!.items} signals={lot.analysis!.hazard_signals} />

                {/* Items */}
                {lot.analysis!.items.length > 0 && (
                  <div>
                    <h4 className="text-[11px] text-[#666] uppercase tracking-wider mb-2">Detected Items</h4>
                    <div className="space-y-2">
                      {lot.analysis!.items.map((item) => {
                        const v = lot.verifications.find((vr) => vr.target_type === "material" && vr.target_id === item.item_id);
                        return (
                          <ItemCard
                            key={item.item_id}
                            item={item}
                            evidence={lot.evidence}
                            lotId={lot.lot_id}
                            verification={v ? { decision: v.decision, verified_at: v.verified_at } : null}
                            onVerify={(decision) => handleVerifyObservation("material", item.item_id, decision)}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Hazard Signals */}
                {lot.analysis!.hazard_signals.length > 0 && (
                  <div>
                    <h4 className="text-[11px] text-[#f59e0b] uppercase tracking-wider mb-2">Hazard Signals</h4>
                    <div className="space-y-2">
                      {lot.analysis!.hazard_signals.map((signal) => {
                        const v = lot.verifications.find((vr) => vr.target_type === "hazard" && vr.target_id === signal.signal_id);
                        return (
                          <HazardCard
                            key={signal.signal_id}
                            signal={signal}
                            evidence={lot.evidence}
                            lotId={lot.lot_id}
                            verification={v ? { decision: v.decision, verified_at: v.verified_at } : null}
                            onVerify={(decision) => handleVerifyObservation("hazard", signal.signal_id, decision)}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {lot.analysis!.items.length === 0 && lot.analysis!.hazard_signals.length === 0 && (
                  <p className="text-[12px] text-[#666] py-4 text-center">
                    No items or hazard signals detected in this evidence.
                  </p>
                )}

                {/* Analysis metadata */}
                <div className="pt-3 border-t border-[#2a2a2a]">
                  <div className="flex items-center gap-4 text-[11px] text-[#444]">
                    <span>Analyzed: {new Date(lot.analysis!.analyzed_at).toLocaleString()}</span>
                    <span>Model: {lot.analysis!.model_used}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Routing Section */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
            <h3 className="text-[13px] font-medium text-[#f0f0f0] mb-4">
              Safety & Routing
            </h3>

            {lot.status === "blocked" && (
              <div className="bg-[#450a0a]/50 border border-[#7f1d1d] rounded-md p-4 mb-4">
                <div className="flex items-center gap-2 text-[#ef4444] font-medium text-[13px] mb-2">
                  <span>🚫 Safety Evaluation Blocked</span>
                </div>
                {lot.safety_result?.blocking_reasons && lot.safety_result.blocking_reasons.length > 0 && (
                  <ul className="list-disc list-inside text-[12px] text-[#fca5a5] space-y-1 mb-3">
                    {lot.safety_result.blocking_reasons.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] text-[#a0a0a0] mb-3">
                  An inspector can perform a manual physical inspection and override the safety block to re-evaluate routing.
                </p>
                <button
                  onClick={() => handleTransition("unblock")}
                  disabled={transitionLoading}
                  className="px-4 py-2 bg-[#422006] border border-[#78350f] rounded-md text-[12px] font-medium text-[#f59e0b] hover:bg-[#78350f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  🔓 Unblock & Re-Evaluate Lot (Inspector Override)
                </button>
              </div>
            )}

            {canRoute && (
              <div className="py-4 text-center">
                <p className="text-[11px] text-[#444] mb-3">
                  Evaluate safety rules and determine facility eligibility.
                </p>
                <button
                  onClick={handleGetRouting}
                  disabled={routingLoading}
                  className="px-4 py-1.5 bg-[#1e3a5f] border border-[#2563eb]/30 rounded-md text-[12px] text-[#3b82f6] hover:bg-[#1e4070] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {routingLoading ? "Evaluating..." : "Evaluate Safety & Routing"}
                </button>
              </div>
            )}

            {routingError && (
              <div className="bg-[#450a0a] border border-[#7f1d1d] rounded-md p-3 mb-3">
                <p className="text-[12px] text-[#ef4444]">{routingError}</p>
              </div>
            )}

            {lot.safety_result && lot.status !== "blocked" && (
              <SafetyResultCard safety={lot.safety_result} />
            )}

            {lot.routing_result && (
              <RoutingResultCard
                routing={lot.routing_result}
                facilities={FACILITIES}
              />
            )}

            {!hasAnalysis && !lot.safety_result && lot.status !== "blocked" && (
              <p className="text-[12px] text-[#444] text-center py-4">
                Complete AI analysis first to enable safety evaluation and routing.
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
            <h3 className="text-[13px] font-medium text-[#f0f0f0] mb-3">Lot Details</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#666]">Lot ID</span>
                <span className="text-[#a0a0a0] font-mono">{lot.lot_id}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#666]">Status</span>
                <StatusBadge status={lot.status} />
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#666]">Created</span>
                <span className="text-[#a0a0a0]">{new Date(lot.created_at).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#666]">Evidence</span>
                <span className="text-[#a0a0a0]">{lot.evidence.length} items</span>
              </div>
              {hasAnalysis && (
                <>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[#666]">Items Detected</span>
                    <span className="text-[#a0a0a0]">{lot.analysis!.items.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[#666]">Hazard Signals</span>
                    <span className="text-[#a0a0a0]">{lot.analysis!.hazard_signals.length}</span>
                  </div>
                  {lot.verifications.length > 0 && (
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-[#666]">Verified</span>
                      <span className="text-[#a0a0a0]">{lot.verifications.length} observations</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
            <h3 className="text-[13px] font-medium text-[#f0f0f0] mb-3">Lifecycle</h3>
            <div className="space-y-2">
              {lifecycleSteps.map((step) => (
                <div key={step.label} className="flex items-center gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      step.status === "done"
                        ? "bg-[#22c55e]"
                        : step.status === "failed"
                        ? "bg-[#ef4444]"
                        : step.status === "active"
                        ? "bg-[#3b82f6]"
                        : "bg-[#333]"
                    }`}
                  />
                  <span
                    className={`text-[12px] ${
                      step.status === "done"
                        ? "text-[#a0a0a0]"
                        : step.status === "failed"
                        ? "text-[#ef4444]"
                        : step.status === "active"
                        ? "text-[#3b82f6]"
                        : "text-[#444]"
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.timestamp && step.status === "done" && (
                    <span className="text-[10px] text-[#444] ml-auto">
                      {new Date(step.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          {(canDispatch || canReceive || canUnblock) && (
            <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
              <h3 className="text-[13px] font-medium text-[#f0f0f0] mb-3">Actions</h3>
              {transitionError && (
                <div className="bg-[#450a0a] border border-[#7f1d1d] rounded-md px-3 py-2 mb-3">
                  <p className="text-[12px] text-[#ef4444]">{transitionError}</p>
                </div>
              )}
              <div className="space-y-2">
                {canDispatch && (
                  <button
                    onClick={() => handleTransition("dispatch")}
                    disabled={transitionLoading}
                    className="w-full px-4 py-2 bg-[#1e3a5f] border border-[#2563eb]/30 rounded-md text-[12px] text-[#3b82f6] hover:bg-[#1e4070] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {transitionLoading ? "Processing..." : "Mark as Dispatched"}
                  </button>
                )}
                {canReceive && (
                  <button
                    onClick={() => handleTransition("receive")}
                    disabled={transitionLoading}
                    className="w-full px-4 py-2 bg-[#052e16] border border-[#14532d]/30 rounded-md text-[12px] text-[#22c55e] hover:bg-[#0a3d1f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {transitionLoading ? "Processing..." : "Mark as Received"}
                  </button>
                )}
                {canUnblock && (
                  <button
                    onClick={() => handleTransition("unblock")}
                    disabled={transitionLoading}
                    className="w-full px-4 py-2 bg-[#422006] border border-[#78350f] rounded-md text-[12px] text-[#f59e0b] hover:bg-[#78350f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                  >
                    🔓 Unblock & Re-Evaluate Lot
                  </button>
                )}
              </div>
              {lot.selected_facility_id && (
                <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
                  <span className="text-[10px] text-[#444]">Destination:</span>
                  <span className="text-[11px] text-[#a0a0a0] ml-1 font-mono">{lot.selected_facility_id}</span>
                </div>
              )}
            </div>
          )}

          {/* Event Timeline */}
          {lot.events.length > 0 && (
            <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5">
              <h3 className="text-[13px] font-medium text-[#f0f0f0] mb-3">Event History</h3>
              <div className="space-y-2">
                {[...lot.events].reverse().map((event) => (
                  <div key={event.event_id} className="flex items-start gap-3 text-[11px]">
                    <span className="text-[#444] font-mono shrink-0">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    <div>
                      <span className={`font-medium ${
                        event.event_type.includes("blocked") || event.event_type.includes("rejected")
                          ? "text-[#ef4444]"
                          : event.event_type.includes("confirmed") || event.event_type.includes("received")
                          ? "text-[#22c55e]"
                          : "text-[#a0a0a0]"
                      }`}>
                        {event.event_type.replace(/_/g, " ").toUpperCase()}
                      </span>
                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <span className="text-[#444] ml-2">
                          {typeof event.metadata.facility_name === "string" && `→ ${event.metadata.facility_name}`}
                          {Array.isArray(event.metadata.reasons) && ` (${event.metadata.reasons.join(", ")})`}
                        </span>
                      )}
                      <span className="text-[#333] ml-2">by {event.actor}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function UncertaintySummary({ items, signals }: { items: MaterialItem[]; signals: HazardSignal[] }) {
  const lowConfidence = [...items, ...signals].filter((o) => o.uncertainty_level === "low");
  const mediumConfidence = [...items, ...signals].filter((o) => o.uncertainty_level === "medium");

  if (lowConfidence.length === 0 && mediumConfidence.length === 0) {
    return (
      <div className="bg-[#052e16]/30 border border-[#14532d]/50 rounded-md px-3 py-2">
        <span className="text-[11px] text-[#22c55e]">All observations have high confidence.</span>
      </div>
    );
  }

  return (
    <div className="bg-[#422006]/30 border border-[#78350f]/50 rounded-md px-3 py-2">
      <div className="flex items-center gap-3 text-[11px]">
        {lowConfidence.length > 0 && (
          <span className="text-[#ef4444]">
            {lowConfidence.length} low-confidence {lowConfidence.length === 1 ? "observation" : "observations"}
          </span>
        )}
        {mediumConfidence.length > 0 && (
          <span className="text-[#f59e0b]">
            {mediumConfidence.length} medium-confidence {mediumConfidence.length === 1 ? "observation" : "observations"}
          </span>
        )}
        <span className="text-[#666]">may require attention</span>
      </div>
    </div>
  );
}

function ItemCard({
  item,
  evidence,
  lotId,
  verification,
  onVerify,
}: {
  item: MaterialItem;
  evidence: Evidence[];
  lotId: string;
  verification?: { decision: string; verified_at: string } | null;
  onVerify?: (decision: "confirmed" | "rejected" | "cannot_determine") => void;
}) {
  const linkedEvidence = evidence.filter((e) => item.evidence_ids.includes(e.evidence_id));

  return (
    <div className={`bg-[#0a0a0a] border rounded-md p-3 ${
      verification?.decision === "confirmed"
        ? "border-[#14532d]/50"
        : verification?.decision === "rejected"
        ? "border-[#7f1d1d]/50"
        : "border-[#2a2a2a]"
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-[13px] font-medium text-[#f0f0f0] capitalize">
            {item.category.replace(/_/g, " ")}
          </span>
          <span className="text-[12px] text-[#666] ml-2">×{item.quantity}</span>
          {verification && (
            <span className={`ml-2 text-[9px] font-medium uppercase px-1.5 py-0.5 rounded ${
              verification.decision === "confirmed"
                ? "text-[#22c55e] bg-[#052e16]"
                : verification.decision === "rejected"
                ? "text-[#ef4444] bg-[#450a0a]"
                : "text-[#f59e0b] bg-[#422006]"
            }`}>
              {verification.decision === "confirmed" ? "VERIFIED" : verification.decision === "rejected" ? "REJECTED" : "INCONCLUSIVE"}
            </span>
          )}
        </div>
        <ConfidenceBadge confidence={item.confidence} uncertaintyLevel={item.uncertainty_level} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#a0a0a0]">
        {item.condition && (
          <span>Condition: <span className="capitalize">{item.condition.replace(/_/g, " ")}</span></span>
        )}
        <span>Battery: {item.battery_present ? "Present" : "Not detected"}</span>
        {item.components.length > 0 && (
          <span>Components: {item.components.join(", ")}</span>
        )}
      </div>
      {linkedEvidence.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[#1a1a1a]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-[#444]">Evidence:</span>
            {linkedEvidence.map((ev) => (
              <span key={ev.evidence_id} className="text-[10px] text-[#3b82f6] bg-[#1e3a5f] px-1.5 py-0.5 rounded">
                {ev.type === "photo" ? "IMG" : ev.type === "voice" ? "VOI" : "TXT"}-{ev.evidence_id.slice(-4)}
              </span>
            ))}
          </div>
        </div>
      )}
      {!verification && onVerify && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#1a1a1a]">
          <span className="text-[10px] text-[#666]">Review observation:</span>
          <button
            onClick={() => onVerify("confirmed")}
            className="px-2.5 py-1 bg-[#052e16] border border-[#14532d] text-[#22c55e] hover:bg-[#14532d] rounded text-[10px] font-medium transition-colors flex items-center gap-1"
          >
            ✓ Confirm
          </button>
          <button
            onClick={() => onVerify("rejected")}
            className="px-2.5 py-1 bg-[#450a0a] border border-[#7f1d1d] text-[#ef4444] hover:bg-[#7f1d1d] rounded text-[10px] font-medium transition-colors flex items-center gap-1"
          >
            ✗ Reject
          </button>
          <button
            onClick={() => onVerify("cannot_determine")}
            className="px-2.5 py-1 bg-[#422006] border border-[#78350f] text-[#f59e0b] hover:bg-[#78350f] rounded text-[10px] font-medium transition-colors"
          >
            ? Inconclusive
          </button>
        </div>
      )}
    </div>
  );
}

function HazardCard({
  signal,
  evidence,
  lotId,
  verification,
  onVerify,
}: {
  signal: HazardSignal;
  evidence: Evidence[];
  lotId: string;
  verification?: { decision: string; verified_at: string } | null;
  onVerify?: (decision: "confirmed" | "rejected" | "cannot_determine") => void;
}) {
  const linkedEvidence = evidence.filter((e) => signal.evidence_ids.includes(e.evidence_id));

  return (
    <div className={`bg-[#422006]/30 border rounded-md p-3 ${
      verification?.decision === "confirmed"
        ? "border-[#14532d]/50"
        : verification?.decision === "rejected"
        ? "border-[#7f1d1d]/50"
        : "border-[#78350f]/50"
    }`}>
      <div className="flex items-start justify-between mb-1">
        <div>
          <span className="text-[12px] font-medium text-[#f59e0b] capitalize">
            {signal.type.replace(/_/g, " ")}
          </span>
          {verification && (
            <span className={`ml-2 text-[9px] font-medium uppercase px-1.5 py-0.5 rounded ${
              verification.decision === "confirmed"
                ? "text-[#22c55e] bg-[#052e16]"
                : verification.decision === "rejected"
                ? "text-[#ef4444] bg-[#450a0a]"
                : "text-[#f59e0b] bg-[#422006]"
            }`}>
              {verification.decision === "confirmed" ? "CONFIRMED" : verification.decision === "rejected" ? "REJECTED" : "INCONCLUSIVE"}
            </span>
          )}
        </div>
        <ConfidenceBadge confidence={signal.confidence} uncertaintyLevel={signal.uncertainty_level} />
      </div>
      {signal.severity && (
        <span className="text-[11px] text-[#a0a0a0]">Severity: {signal.severity}</span>
      )}
      {linkedEvidence.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[#78350f]/30">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-[#444]">Evidence:</span>
            {linkedEvidence.map((ev) => (
              <span key={ev.evidence_id} className="text-[10px] text-[#3b82f6] bg-[#1e3a5f] px-1.5 py-0.5 rounded">
                {ev.type === "photo" ? "IMG" : ev.type === "voice" ? "VOI" : "TXT"}-{ev.evidence_id.slice(-4)}
              </span>
            ))}
          </div>
        </div>
      )}
      {!verification && onVerify && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#78350f]/30">
          <span className="text-[10px] text-[#666]">Review hazard signal:</span>
          <button
            onClick={() => onVerify("confirmed")}
            className="px-2.5 py-1 bg-[#052e16] border border-[#14532d] text-[#22c55e] hover:bg-[#14532d] rounded text-[10px] font-medium transition-colors flex items-center gap-1"
          >
            ✓ Confirm
          </button>
          <button
            onClick={() => onVerify("rejected")}
            className="px-2.5 py-1 bg-[#450a0a] border border-[#7f1d1d] text-[#ef4444] hover:bg-[#7f1d1d] rounded text-[10px] font-medium transition-colors flex items-center gap-1"
          >
            ✗ Reject
          </button>
          <button
            onClick={() => onVerify("cannot_determine")}
            className="px-2.5 py-1 bg-[#422006] border border-[#78350f] text-[#f59e0b] hover:bg-[#78350f] rounded text-[10px] font-medium transition-colors"
          >
            ? Inconclusive
          </button>
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence, uncertaintyLevel }: { confidence: number; uncertaintyLevel?: UncertaintyLevel }) {
  const pct = Math.round(confidence * 100);
  const color =
    confidence >= 0.8
      ? "text-[#22c55e] bg-[#052e16]"
      : confidence >= 0.5
      ? "text-[#f59e0b] bg-[#422006]"
      : "text-[#ef4444] bg-[#450a0a]";

  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${color}`}>
        {pct}%
      </span>
      {uncertaintyLevel && <UncertaintyBadge level={uncertaintyLevel} />}
    </div>
  );
}

function UncertaintyBadge({ level }: { level: UncertaintyLevel }) {
  const config = {
    high: { label: "HIGH", color: "text-[#22c55e] bg-[#052e16]" },
    medium: { label: "MEDIUM", color: "text-[#f59e0b] bg-[#422006]" },
    low: { label: "LOW", color: "text-[#ef4444] bg-[#450a0a]" },
  };
  const c = config[level];
  return (
    <span className={`text-[9px] font-medium uppercase px-1.5 py-0.5 rounded ${c.color}`}>
      {c.label}
    </span>
  );
}

function EvidenceCard({ evidence }: { evidence: Evidence }) {
  const [loaded, setLoaded] = useState(false);

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

function SafetyResultCard({ safety }: { safety: SafetyResult }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-[#666] uppercase tracking-wider">Safety Evaluation</span>
        <span className="text-[10px] text-[#444]">{new Date(safety.evaluated_at).toLocaleString()}</span>
      </div>

      {safety.special_handling.length > 0 && (
        <div className="bg-[#052e16]/30 border border-[#14532d]/50 rounded-md px-3 py-2">
          <span className="text-[10px] text-[#444]">Special handling required:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {safety.special_handling.map((h) => (
              <span key={h} className="text-[10px] text-[#22c55e] bg-[#052e16] px-1.5 py-0.5 rounded">
                {h.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {safety.requires_human_review && (
        <div className="bg-[#422006]/30 border border-[#78350f]/50 rounded-md px-3 py-2">
          <span className="text-[11px] text-[#f59e0b]">Human review required</span>
        </div>
      )}

      {safety.blocked && (
        <div className="bg-[#450a0a]/30 border border-[#7f1d1d]/50 rounded-md px-3 py-2">
          <span className="text-[11px] text-[#ef4444] font-medium">Routing blocked</span>
          <div className="mt-1 space-y-0.5">
            {safety.blocking_reasons.map((reason, i) => (
              <p key={i} className="text-[10px] text-[#ef4444]/80">- {reason}</p>
            ))}
          </div>
        </div>
      )}

      {!safety.blocked && !safety.requires_human_review && (
        <div className="bg-[#052e16]/30 border border-[#14532d]/50 rounded-md px-3 py-2">
          <span className="text-[11px] text-[#22c55e]">Safety check passed</span>
        </div>
      )}
    </div>
  );
}

function RoutingResultCard({ routing, facilities }: { routing: RoutingResult; facilities: typeof FACILITIES }) {
  const recommended = routing.recommended_facility_id
    ? facilities.find((f) => f.facility_id === routing.recommended_facility_id)
    : null;

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-[#666] uppercase tracking-wider">Routing</span>
        <span className="text-[10px] text-[#444]">{new Date(routing.evaluated_at).toLocaleString()}</span>
      </div>

      {routing.routing_blocked && (
        <div className="bg-[#450a0a]/30 border border-[#7f1d1d]/50 rounded-md px-3 py-2">
          <span className="text-[11px] text-[#ef4444] font-medium">Routing blocked</span>
          <div className="mt-1 space-y-0.5">
            {routing.blocking_reasons.map((reason, i) => (
              <p key={i} className="text-[10px] text-[#ef4444]/80">- {reason}</p>
            ))}
          </div>
        </div>
      )}

      {!routing.routing_blocked && recommended && (
        <div className="bg-[#052e16]/30 border border-[#14532d]/50 rounded-md p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-[#22c55e]">Recommended</span>
            <span className="text-[10px] text-[#22c55e] bg-[#052e16] px-1.5 py-0.5 rounded">ELIGIBLE</span>
          </div>
          <p className="text-[13px] text-[#f0f0f0]">{recommended.name}</p>
          <p className="text-[11px] text-[#666]">{recommended.location}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {recommended.accepted_materials.slice(0, 4).map((mat) => (
              <span key={mat} className="text-[9px] text-[#a0a0a0] bg-[#1a1a1a] px-1.5 py-0.5 rounded">
                {mat.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {routing.eligible_facilities.length > 0 && (
        <div>
          <span className="text-[10px] text-[#444] uppercase tracking-wider">All Facilities</span>
          <div className="space-y-1.5 mt-1">
            {routing.eligible_facilities.map((e) => {
              const f = facilities.find((fc) => fc.facility_id === e.facility_id);
              if (!f) return null;
              return (
                <div
                  key={e.facility_id}
                  className={`flex items-center justify-between px-2 py-1.5 rounded text-[11px] ${
                    e.eligible
                      ? "bg-[#052e16]/20 border border-[#14532d]/30"
                      : "bg-[#1a1a1a] border border-[#2a2a2a] opacity-60"
                  }`}
                >
                  <span className="text-[#a0a0a0]">{f.name}</span>
                  {e.eligible ? (
                    <span className="text-[#22c55e]">Eligible</span>
                  ) : (
                    <span className="text-[#ef4444] text-[10px]">{e.exclusion_reason}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-[#2a2a2a] flex items-center justify-between">
        <a
          href={`/lots/${routing.lot_id}/passport`}
          className="text-[12px] text-[#3b82f6] hover:text-[#60a5fa] transition-colors font-medium flex items-center gap-1"
        >
          📄 View Digital Material Passport →
        </a>
        <a
          href={`/api/lots/${routing.lot_id}/passport/download`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-[#22c55e] hover:text-[#4ade80] transition-colors bg-[#052e16] px-2 py-1 rounded border border-[#14532d]"
        >
          📥 Download PDF
        </a>
      </div>
    </div>
  );
}
