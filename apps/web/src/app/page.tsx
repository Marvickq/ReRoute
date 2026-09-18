"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import type { MaterialLot } from "@/types";

export default function DashboardPage() {
  const [lots, setLots] = useState<MaterialLot[]>([]);

  useEffect(() => {
    fetch("/api/lots")
      .then((res) => res.json())
      .then((data) => setLots(data.lots || []))
      .catch(() => setLots([]));
  }, []);

  const totalLots = lots.length;
  const pendingReview = lots.filter((l) => l.status === "review_required").length;
  const created = lots.filter((l) => l.status === "created").length;
  const totalEvidence = lots.reduce((sum, l) => sum + l.evidence.length, 0);

  const stats = [
    { label: "Total Lots", value: String(totalLots), change: `${created} newly created` },
    { label: "Pending Review", value: String(pendingReview), change: pendingReview > 0 ? "needs attention" : "none" },
    { label: "Evidence Items", value: String(totalEvidence), change: "captured" },
    { label: "Pipeline", value: "Phase 1", change: "Capture only" },
  ];

  return (
    <AppShell title="Dashboard">
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-[#111] border border-[#2a2a2a] rounded-lg p-4">
              <div className="text-[11px] text-[#666] uppercase tracking-wider mb-1">{stat.label}</div>
              <div className="text-[24px] font-semibold text-[#f0f0f0]">{stat.value}</div>
              <div className="text-[11px] text-[#a0a0a0] mt-1">{stat.change}</div>
            </div>
          ))}
        </div>

        <div className="bg-[#111] border border-[#2a2a2a] rounded-lg">
          <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
            <h3 className="text-[13px] font-medium text-[#f0f0f0]">Recent Lots</h3>
            <Link href="/lots" className="text-[12px] text-[#3b82f6] hover:text-[#60a5fa] transition-colors">
              View all
            </Link>
          </div>
          {lots.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] text-[#666] mb-3">No material lots yet.</p>
              <Link
                href="/new-lot"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#22c55e] text-black rounded-md text-[12px] font-medium hover:bg-[#16a34a] transition-colors"
              >
                Create first lot
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#2a2a2a]">
              {lots.slice(0, 5).map((lot) => (
                <Link key={lot.lot_id} href={`/lots/${lot.lot_id}`}>
                  <div className="px-4 py-3 flex items-center justify-between hover:bg-[#1a1a1a] transition-colors cursor-pointer">
                    <div className="flex items-center gap-4">
                      <span className="text-[13px] font-mono text-[#f0f0f0]">{lot.lot_id}</span>
                      <StatusBadge status={lot.status} />
                      <span className="text-[12px] text-[#666]">
                        {lot.evidence.length} evidence{lot.evidence.length !== 1 ? "s" : ""}
                        {lot.text_description ? " · has text" : ""}
                      </span>
                    </div>
                    <span className="text-[12px] text-[#666]">
                      {new Date(lot.created_at).toLocaleString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-4">
            <h3 className="text-[13px] font-medium text-[#f0f0f0] mb-3">Pipeline Status</h3>
            <div className="space-y-2">
              {[
                { stage: "Capture (Phase 1)", count: totalLots, total: totalLots },
                { stage: "AI Analysis (Phase 2)", count: 0, total: totalLots, locked: true },
                { stage: "Safety (Phase 6)", count: 0, total: totalLots, locked: true },
                { stage: "Routing (Phase 8)", count: 0, total: totalLots, locked: true },
                { stage: "Passport (Phase 10)", count: 0, total: totalLots, locked: true },
              ].map((s) => (
                <div key={s.stage} className="flex items-center gap-3">
                  <span className="text-[12px] text-[#a0a0a0] w-36">{s.stage}</span>
                  <div className="flex-1 h-1.5 bg-[#222] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.locked ? "bg-[#333]" : "bg-[#22c55e]"}`}
                      style={{ width: s.total > 0 ? `${(s.count / s.total) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="text-[11px] text-[#666] w-6 text-right">{s.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-4">
            <h3 className="text-[13px] font-medium text-[#f0f0f0] mb-3">System Status</h3>
            <div className="space-y-2">
              {[
                { service: "Evidence Upload", status: "operational" },
                { service: "Lot Creation", status: "operational" },
                { service: "AI Pipeline", status: "awaiting Phase 2" },
                { service: "Safety Engine", status: "awaiting Phase 6" },
                { service: "Routing", status: "awaiting Phase 8" },
              ].map((s) => (
                <div key={s.service} className="flex items-center justify-between py-1">
                  <span className="text-[12px] text-[#a0a0a0]">{s.service}</span>
                  <span
                    className={`flex items-center gap-1.5 text-[11px] ${
                      s.status === "operational" ? "text-[#22c55e]" : "text-[#666]"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        s.status === "operational" ? "bg-[#22c55e]" : "bg-[#444]"
                      }`}
                    />
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
