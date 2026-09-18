"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import type { ReviewQueueItem } from "@/types";

export default function ReviewPage() {
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/review");
      const data = await res.json();
      setQueue(data.queue);
    } catch {
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const pending = queue.filter((item) => item.verification_status === "pending");
  const reviewed = queue.filter((item) => item.verification_status !== "pending");

  if (loading) {
    return (
      <AppShell title="Review">
        <div className="flex items-center justify-center py-20">
          <span className="text-[13px] text-[#666]">Loading review queue...</span>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Review">
      <PageHeader
        title="Review Queue"
        description="Lots requiring human verification for uncertain AI observations."
      />

      {queue.length === 0 ? (
        <div className="bg-[#111] border border-[#2a2a2a] rounded-lg">
          <EmptyState
            title="No observations require review"
            description="When AI observations have medium or low confidence, they will appear here for human verification."
            icon={
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div>
              <h3 className="text-[11px] text-[#666] uppercase tracking-wider mb-3">
                Pending Review ({pending.length})
              </h3>
              <div className="space-y-2">
                {pending.map((item) => (
                  <ReviewItem key={`${item.lot_id}-${item.target_id}`} item={item} />
                ))}
              </div>
            </div>
          )}

          {reviewed.length > 0 && (
            <div>
              <h3 className="text-[11px] text-[#444] uppercase tracking-wider mb-3">
                Reviewed ({reviewed.length})
              </h3>
              <div className="space-y-2">
                {reviewed.map((item) => (
                  <ReviewItem key={`${item.lot_id}-${item.target_id}`} item={item} reviewed />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

function ReviewItem({ item, reviewed }: { item: ReviewQueueItem; reviewed?: boolean }) {
  const uncertaintyColor =
    item.uncertainty_level === "low"
      ? "text-[#ef4444] bg-[#450a0a]"
      : item.uncertainty_level === "medium"
      ? "text-[#f59e0b] bg-[#422006]"
      : "text-[#22c55e] bg-[#052e16]";

  const statusColor =
    item.verification_status === "confirmed"
      ? "text-[#22c55e] bg-[#052e16]"
      : item.verification_status === "rejected"
      ? "text-[#ef4444] bg-[#450a0a]"
      : item.verification_status === "cannot_determine"
      ? "text-[#f59e0b] bg-[#422006]"
      : "text-[#666] bg-[#1a1a1a]";

  const statusLabel =
    item.verification_status === "pending"
      ? "PENDING"
      : item.verification_status === "confirmed"
      ? "CONFIRMED"
      : item.verification_status === "rejected"
      ? "REJECTED"
      : "CANNOT DETERMINE";

  const targetIcon =
    item.target_type === "hazard" ? (
      <svg className="w-4 h-4 text-[#f59e0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    );

  return (
    <Link
      href={`/review/${item.lot_id}?target=${item.target_type}:${item.target_id}`}
      className={`block bg-[#111] border rounded-lg p-4 hover:bg-[#161616] transition-colors ${
        reviewed ? "border-[#1a1a1a] opacity-70" : "border-[#2a2a2a]"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {targetIcon}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[13px] font-medium text-[#f0f0f0] capitalize">
                {item.target_label}
              </span>
              <span className={`text-[9px] font-medium uppercase px-1.5 py-0.5 rounded ${uncertaintyColor}`}>
                {item.uncertainty_level}
              </span>
              <span className="text-[10px] text-[#444] font-mono">
                {item.target_type === "hazard" ? "HAZARD" : "ITEM"}-{item.target_id.slice(-6)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[#666]">
              <span>Lot: <span className="font-mono">{item.lot_id}</span></span>
              <span>Confidence: {Math.round(item.confidence * 100)}%</span>
              <span>Evidence: {item.evidence_count}</span>
            </div>
          </div>
        </div>
        <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
      {item.verified_at && (
        <div className="mt-2 text-[10px] text-[#444]">
          Verified: {new Date(item.verified_at).toLocaleString()}
        </div>
      )}
    </Link>
  );
}
