import React from "react";

function StepIcon({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-[#1c1c1e] border border-[#38383a] flex items-center justify-center text-2xl font-light text-[#30d158]">
        {number}
      </div>
      <span className="text-xs font-semibold text-[#86868b] uppercase tracking-widest">{label}</span>
    </div>
  );
}

export default function VisualStory() {
  const steps = [
    { number: "01", label: "Identify", desc: "Capture and catalog discarded electronics with AI-assisted analysis." },
    { number: "02", label: "Verify", desc: "Human operators confirm material details, ensuring accuracy and trust." },
    { number: "03", label: "Route", desc: "Materials are directed to the right facility based on safety and quality." },
    { number: "04", label: "Trace", desc: "Every movement is recorded, creating a permanent material passport." },
  ];

  return (
    <section className="py-24 px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-light text-[#f5f5f7] tracking-tight mb-4">A Visible Journey</h2>
          <p className="text-lg text-[#86868b] max-w-2xl mx-auto leading-relaxed">
            From capture to certification, ReLoop brings structure and visibility to the journey of discarded electronics.
          </p>
        </div>

        <div className="relative">
          <div className="hidden md:flex items-center justify-between mb-12">
            {steps.map((step, i) => (
              <React.Fragment key={step.label}>
                <StepIcon number={step.number} label={step.label} />
                {i < steps.length - 1 && (
                  <div className="flex-1 h-px bg-[#38383a] mx-4" />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="space-y-8 md:space-y-0 md:grid md:grid-cols-2 md:gap-8">
            {steps.map((step, i) => (
              <div key={step.label} className="bg-[#1c1c1e] border border-[#38383a] rounded-2xl p-8 hover:border-[#30d158]/30 transition-colors">
                <div className="flex items-start gap-4 mb-4">
                  <span className="text-3xl font-light text-[#30d158]">{step.number}</span>
                  <div>
                    <h3 className="text-xl font-semibold text-[#f5f5f7] mb-2">{step.label}</h3>
                    <p className="text-sm text-[#86868b] leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
