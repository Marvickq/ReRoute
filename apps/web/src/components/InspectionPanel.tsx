"use client";

import { useState } from "react";
import type { MaterialLot } from "@/types";

const OUTCOME_STYLE: Record<string, { label: string; cls: string }> = {
  READY_FOR_HUMAN_VERIFICATION: {
    label: "Ready for human verification",
    cls: "bg-[#14532d]/40 border-[#22c55e]/40 text-[#4ade80]",
  },
  HUMAN_REVIEW_REQUIRED: {
    label: "Human review required",
    cls: "bg-[#78350f]/40 border-[#f59e0b]/40 text-[#fbbf24]",
  },
  RETAKE_REQUIRED: {
    label: "Retake required",
    cls: "bg-[#7f1d1d]/40 border-[#ef4444]/40 text-[#f87171]",
  },
};

interface Props {
  lot: MaterialLot;
  onChanged: () => void | Promise<void>;
  onReanalyze: () => void | Promise<void>;
}

export default function InspectionPanel({ lot, onChanged, onReanalyze }: Props) {
  const insp = lot.inspection;
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!insp) return null;

  const style = OUTCOME_STYLE[insp.outcome] ?? OUTCOME_STYLE.HUMAN_REVIEW_REQUIRED;
  const annotated = insp.evidence_refs.find((r) => r.kind === "annotated");
  const crops = insp.evidence_refs.filter((r) => r.kind === "crop");
  const unresolved = insp.routing_blocked && !insp.resolution;

  const resolve = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/lots/${lot.lot_id}/inspection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", note, actor: "demo_operator" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not resolve");
      setNote("");
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not resolve");
    } finally {
      setBusy(false);
    }
  };

  const retake = async (file: File) => {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("lot_id", lot.lot_id);
      const up = await fetch("/api/evidence", { method: "POST", body: fd });
      const upData = await up.json();
      if (!up.ok) throw new Error(upData.error || "Upload failed");
      const res = await fetch(`/api/lots/${lot.lot_id}/inspection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retake", evidence_id: upData.evidence.evidence_id, actor: "demo_operator" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Retake failed");
      await onChanged();
      await onReanalyze();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Retake failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-5" data-testid="inspection-panel">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <h3 className="text-[13px] font-medium text-[#f0f0f0]">Visual Inspection</h3>
          <span className={`px-2 py-0.5 border rounded text-[10px] font-medium ${style.cls}`}>{style.label}</span>
          {insp.resolution && (
            <span className="px-2 py-0.5 border border-[#3b82f6]/40 bg-[#1e3a5f]/60 text-[#60a5fa] rounded text-[10px]">
              Resolved by {insp.resolution.resolved_by}
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono text-[#666]">
          {insp.service_available
            ? `OpenCV ${insp.opencv_version ?? "?"} · ${insp.detector ?? "detector"} · ${insp.total_ms ?? "?"} ms`
            : "automated inspection unavailable"}
        </span>
      </div>

      <p className="text-[11px] text-[#666] mb-3">
        Automated checks are decision support only. They are not a verification or safety certification; a person must
        verify the material before routing.
      </p>

      {insp.quality_status && (
        <p className="text-[12px] text-[#a0a0a0] mb-2">
          Image quality: <span className="text-[#f0f0f0] font-mono">{insp.quality_status}</span>
          {insp.quality_metrics.laplacian_variance !== undefined && (
            <span className="text-[#666]">
              {" "}· sharpness {insp.quality_metrics.laplacian_variance.toFixed(0)} · brightness{" "}
              {insp.quality_metrics.mean_brightness?.toFixed(0)} · {insp.quality_metrics.width}×{insp.quality_metrics.height}
            </span>
          )}
        </p>
      )}

      {insp.reasons.length > 0 && (
        <ul className="text-[12px] text-[#a0a0a0] list-disc pl-5 mb-3">
          {insp.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}

      {(insp.evidence_requests ?? []).length > 0 && (
        <div className="border border-[#f59e0b]/30 bg-[#78350f]/20 rounded p-3 mb-3 text-[12px] text-[#fbbf24]">
          <div className="font-medium mb-1">Evidence requested</div>
          <ul className="list-disc pl-5">
            {insp.evidence_requests.map((r, i) => (
              <li key={i}>
                {r.instruction}
                {r.blocking === false && <span className="text-[#a0a0a0]"> (recommended, not blocking)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {unresolved && (
        <div className="border border-[#ef4444]/30 bg-[#7f1d1d]/20 rounded p-3 mb-3 text-[12px] text-[#f87171]">
          <div className="font-medium mb-1">Routing blocked</div>
          <ul className="list-disc pl-5">
            {insp.blocking_reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {annotated && (
        <div className="mb-3">
          <h4 className="text-[11px] text-[#666] uppercase tracking-wider mb-2">
            Annotated evidence (derived copy; original preserved)
          </h4>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={annotated.url} alt="Annotated detections" className="max-h-72 rounded border border-[#2a2a2a]" />
          {crops.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {crops.map((c) => (
                <figure key={c.ref_id} className="text-[10px] text-[#666]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.url} alt={c.label} className="h-20 rounded border border-[#2a2a2a]" />
                  <figcaption>
                    {c.label} {c.confidence?.toFixed(2)}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      )}

      <details className="mb-3">
        <summary className="text-[11px] text-[#666] cursor-pointer">
          Inspection loop ({insp.iterations}/{insp.max_iterations ?? "-"} steps)
        </summary>
        <ol className="mt-2 space-y-1 text-[11px] text-[#a0a0a0] font-mono">
          {insp.steps.map((s) => (
            <li key={s.iteration}>
              {s.iteration}. <span className="text-[#60a5fa]">{s.action}</span> - {s.decision} → {s.outcome} ({s.latency_ms} ms)
            </li>
          ))}
        </ol>
      </details>

      <details className="mb-3">
        <summary className="text-[11px] text-[#666] cursor-pointer">
          Audit trail ({(lot.audit_trail ?? []).length} entries, hash-chained)
        </summary>
        <ol className="mt-2 space-y-1 text-[11px] text-[#a0a0a0] font-mono max-h-64 overflow-auto">
          {(lot.audit_trail ?? []).map((e) => (
            <li key={e.seq}>
              {e.seq}. [{e.type}] {e.actor}: {e.summary}
              {e.evidence_refs.length > 0 && <span className="text-[#555]"> · evidence {e.evidence_refs.join(", ")}</span>}
            </li>
          ))}
        </ol>
      </details>

      {unresolved && insp.outcome === "RETAKE_REQUIRED" && (
        <label className="inline-block px-3 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[12px] rounded cursor-pointer">
          {busy ? "Working..." : "Upload new photo"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && retake(e.target.files[0])}
          />
        </label>
      )}

      {unresolved && insp.outcome === "HUMAN_REVIEW_REQUIRED" && (
        <div className="flex gap-2 flex-wrap">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe what you physically checked..."
            className="flex-1 min-w-[220px] bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-1.5 text-[12px] text-[#f0f0f0]"
          />
          <button
            onClick={resolve}
            disabled={busy || note.trim().length < 5}
            className="px-3 py-1.5 bg-[#2563eb] disabled:opacity-40 text-white text-[12px] rounded"
          >
            Record human inspection
          </button>
        </div>
      )}
      {err && <p className="text-[12px] text-[#f87171] mt-2">{err}</p>}
    </div>
  );
}
