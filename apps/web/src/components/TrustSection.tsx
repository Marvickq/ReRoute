import React from "react";

export default function TrustSection() {
  const trustItems = [
    {
      title: "Clarity",
      desc: "Every material lot carries a clear, accessible record of what it is, where it came from, and where it's going.",
    },
    {
      title: "Verification",
      desc: "Human operators confirm each observation before it moves forward, ensuring only accurate data enters the system.",
    },
    {
      title: "Responsible Handling",
      desc: "Safety checks and routing logic ensure hazardous materials are handled by qualified facilities.",
    },
    {
      title: "Traceability",
      desc: "A permanent, immutable record of every handoff, transformation, and decision.",
    },
  ];

  return (
    <section id="trust" className="py-24 px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-light text-[#f5f5f7] tracking-tight mb-4">Built on Trust</h2>
          <p className="text-lg text-[#86868b] max-w-2xl mx-auto leading-relaxed">
            ReLoop is designed for the people who care about what happens to discarded electronics — not just the technology behind it.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {trustItems.map((item) => (
            <div key={item.title} className="bg-[#1c1c1e] border border-[#38383a] rounded-2xl p-8 hover:border-[#30d158]/30 transition-colors">
              <h3 className="text-xl font-semibold text-[#f5f5f7] mb-3">{item.title}</h3>
              <p className="text-sm text-[#86868b] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
