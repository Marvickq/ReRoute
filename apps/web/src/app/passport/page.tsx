"use client";

import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export default function PassportPage() {
  return (
    <AppShell title="Material Passport">
      <PageHeader
        title="Material Passport"
        description="The auditable record of a material lot's complete lifecycle — from evidence to handover."
      />

      <div className="bg-[#111] border border-[#2a2a2a] rounded-lg">
        <EmptyState
          title="No passport generated yet"
          description="Material Passports are generated after a lot completes the full pipeline: capture, analysis, verification, routing, and handover."
          icon={
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          }
        />
      </div>
    </AppShell>
  );
}
