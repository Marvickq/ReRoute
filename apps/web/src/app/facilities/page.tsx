"use client";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { FACILITIES } from "@/lib/facilities";

export default function FacilitiesPage() {
  return (
    <AppShell title="Facilities">
      <PageHeader
        title="Facilities"
        description="Authorized e-waste recyclers registered with CPCB/MPCB."
      />

      <div className="space-y-3">
        {FACILITIES.map((facility) => (
          <div
            key={facility.facility_id}
            className={`bg-[#111] border rounded-lg p-5 ${
              facility.available ? "border-[#2a2a2a]" : "border-[#3a1a1a] opacity-60"
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-[14px] font-medium text-[#f0f0f0]">
                  {facility.name}
                </h3>
                <span className="text-[11px] text-[#666]">{facility.location}</span>
              </div>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  facility.available
                    ? "text-[#22c55e] bg-[#052e16]"
                    : "text-[#ef4444] bg-[#450a0a]"
                }`}
              >
                {facility.available ? "ONLINE" : "OFFLINE"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <span className="text-[10px] text-[#444] uppercase tracking-wider">
                  Capacity
                </span>
                <div className="mt-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      facility.capacity >= 0.9
                        ? "bg-[#ef4444]"
                        : facility.capacity >= 0.7
                        ? "bg-[#f59e0b]"
                        : "bg-[#22c55e]"
                    }`}
                    style={{ width: `${facility.capacity * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-[#666] mt-0.5">
                  {Math.round(facility.capacity * 100)}%
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[#444] uppercase tracking-wider">
                  Materials
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {facility.accepted_materials.map((mat) => (
                    <span
                      key={mat}
                      className="text-[9px] text-[#a0a0a0] bg-[#1a1a1a] px-1.5 py-0.5 rounded"
                    >
                      {mat.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-[#444] uppercase tracking-wider">
                  Capabilities
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {facility.handling_capabilities.length > 0 ? (
                    facility.handling_capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="text-[9px] text-[#22c55e] bg-[#052e16] px-1.5 py-0.5 rounded"
                      >
                        {cap.replace(/_/g, " ")}
                      </span>
                    ))
                  ) : (
                    <span className="text-[9px] text-[#444]">None</span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-[10px] text-[#444] font-mono">
              {facility.facility_id}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
