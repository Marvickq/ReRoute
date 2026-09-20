"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import type { MaterialLot } from "@/types";

export default function LotsPage() {
  const router = useRouter();
  const [lots, setLots] = useState<MaterialLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetch("/api/lots")
      .then((res) => res.json())
      .then((data) => setLots(data.lots || []))
      .catch(() => setLots([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = lots.filter((lot) => {
    const matchesSearch =
      search === "" ||
      lot.lot_id.toLowerCase().includes(search.toLowerCase()) ||
      (lot.text_description && lot.text_description.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "all" || lot.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppShell title="Material Lots">
      <PageHeader
        title="Material Lots"
        description="All material lots tracked through the ReLoop pipeline."
      />

      <div className="bg-[#111] border border-[#2a2a2a] rounded-lg">
        <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search lots..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-1.5 text-[12px] text-[#f0f0f0] placeholder:text-[#444] focus:outline-none focus:border-[#555] w-56"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-1.5 text-[12px] text-[#a0a0a0] focus:outline-none focus:border-[#555]"
            >
              <option value="all">All statuses</option>
              <option value="created">Created</option>
              <option value="analyzed">Analyzed</option>
              <option value="review_required">Review Required</option>
              <option value="verified">Verified</option>
              <option value="routed">Routed</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
          <span className="text-[11px] text-[#666]">{filtered.length} lots</span>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center">
            <span className="text-[13px] text-[#666]">Loading...</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={lots.length === 0 ? "No material lots yet" : "No matching lots"}
            description={
              lots.length === 0
                ? "Create your first material lot to get started."
                : "Try adjusting your search or filter."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2a2a2a] bg-[#0d0d0d]">
                  <th className="px-4 py-3 text-[11px] text-[#888] uppercase tracking-wider font-semibold w-[140px]">Lot ID</th>
                  <th className="px-4 py-3 text-[11px] text-[#888] uppercase tracking-wider font-semibold w-[160px]">Status</th>
                  <th className="px-4 py-3 text-[11px] text-[#888] uppercase tracking-wider font-semibold w-[120px]">Evidence</th>
                  <th className="px-4 py-3 text-[11px] text-[#888] uppercase tracking-wider font-semibold">Description</th>
                  <th className="px-4 py-3 text-[11px] text-[#888] uppercase tracking-wider font-semibold w-[200px] text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {filtered.map((lot) => (
                  <tr
                    key={lot.lot_id}
                    onClick={() => router.push(`/lots/${lot.lot_id}`)}
                    className="hover:bg-[#1a1a1a] transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3 text-[13px] font-mono text-[#f0f0f0] group-hover:text-[#3b82f6] transition-colors">
                      {lot.lot_id}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lot.status} />
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#a0a0a0]">
                      {lot.evidence.length} {lot.evidence.length === 1 ? "item" : "items"}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#888] max-w-[300px] truncate">
                      {lot.text_description || "—"}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#666] font-mono text-right">
                      {lot.created_at.slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
