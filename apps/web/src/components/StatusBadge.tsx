const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  created: { label: "Created", color: "text-[#a0a0a0]", bg: "bg-[#222]" },
  analyzing: { label: "Analyzing", color: "text-[#3b82f6]", bg: "bg-[#1e3a5f]" },
  analyzed: { label: "Analyzed", color: "text-[#22c55e]", bg: "bg-[#052e16]" },
  analysis_failed: { label: "Analysis Failed", color: "text-[#ef4444]", bg: "bg-[#450a0a]" },
  safety_review: { label: "Safety Review", color: "text-[#f59e0b]", bg: "bg-[#422006]" },
  review_required: { label: "Review Required", color: "text-[#f59e0b]", bg: "bg-[#422006]" },
  verified: { label: "Verified", color: "text-[#22c55e]", bg: "bg-[#052e16]" },
  routing: { label: "Routing", color: "text-[#3b82f6]", bg: "bg-[#1e3a5f]" },
  routed: { label: "Routed", color: "text-[#22c55e]", bg: "bg-[#052e16]" },
  dispatched: { label: "Dispatched", color: "text-[#22c55e]", bg: "bg-[#052e16]" },
  received: { label: "Received", color: "text-[#22c55e]", bg: "bg-[#052e16]" },
  blocked: { label: "Blocked", color: "text-[#ef4444]", bg: "bg-[#450a0a]" },
  pending: { label: "Pending", color: "text-[#a0a0a0]", bg: "bg-[#222]" },
  confirmed: { label: "Confirmed", color: "text-[#22c55e]", bg: "bg-[#052e16]" },
  rejected: { label: "Rejected", color: "text-[#ef4444]", bg: "bg-[#450a0a]" },
  unknown: { label: "Unknown", color: "text-[#a0a0a0]", bg: "bg-[#222]" },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, color: "text-[#a0a0a0]", bg: "bg-[#222]" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${config.color} ${config.bg}`}>
      {config.label}
    </span>
  );
}
