import React from "react";

export default function MaterialPassportSection() {
  const passportSteps = [
    { icon: "📋", title: "Digital Record", desc: "Every material lot receives a unique passport that follows it through its entire lifecycle." },
    { icon: "🔗", title: "Chain of Custody", desc: "Complete traceability from capture to final destination, with every handoff recorded." },
    { icon: "✓", title: "Verified Data", desc: "Safety results, routing decisions, and quality assessments are permanently archived." },
  ];

  return (
    <section id="passport" className="py-24 px-8 bg-[#1c1c1e]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-light text-[#f5f5f7] tracking-tight mb-4">Material Passport</h2>
          <p className="text-lg text-[#86868b] max-w-2xl mx-auto leading-relaxed">
            The passport is the record that follows material through its entire journey — from discard to renewal.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {passportSteps.map((item) => (
            <div key={item.title} className="bg-[#2c2c2e] border border-[#38383a] rounded-2xl p-8 hover:border-[#30d158]/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-[#30d158]/10 flex items-center justify-center text-xl mb-4">
                {item.icon}
              </div>
              <h3 className="text-lg font-semibold text-[#f5f5f7] mb-2">{item.title}</h3>
              <p className="text-sm text-[#86868b] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-[#2c2c2e] border border-[#38383a] rounded-2xl p-8">
          <h3 className="text-lg font-semibold text-[#f5f5f7] mb-6">A Sample Passport Record</h3>
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            {[
              { label: "Lot ID", value: "RL-1047" },
              { label: "Status", value: "Verified" },
              { label: "Safety", value: "Passed" },
              { label: "Destination", value: "Recycling Partner" },
            ].map((item) => (
              <div key={item.label}>
                <div className="text-xs text-[#86868b] uppercase tracking-wider mb-1">{item.label}</div>
                <div className="text-[#f5f5f7] font-medium">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
