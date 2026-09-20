"use client";

import Link from "next/link";
import Footer from "@/components/Footer";
import VisualStory from "@/components/VisualStory";
import MaterialPassport from "@/components/MaterialPassport";
import TrustSection from "@/components/TrustSection";

function HeroImage() {
  return (
    <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden border border-[#38383a] bg-[#1c1c1e]">
      <img
        src="https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80"
        alt="E-Waste Circuit Board"
        className="w-full h-full object-cover opacity-70"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a]/60 via-transparent to-[#1c1c1e]/80" />
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#000000]">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#000000]/80 backdrop-blur-xl border-b border-[#38383a]">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#30d158] flex items-center justify-center">
              <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-[#f5f5f7] tracking-tight">ReLoop</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {[
              { href: "#about", label: "About" },
              { href: "#how-it-works", label: "How It Works" },
              { href: "#passport", label: "Passport" },
              { href: "/lots", label: "Dashboard" },
            ].map((item) => (
              <a key={item.href} href={item.href} className="text-sm text-[#86868b] hover:text-[#f5f5f7] transition-colors">
                {item.label}
              </a>
            ))}
          </div>
          <Link href="/new-lot" className="px-4 py-2 bg-[#30d158] text-black rounded-lg text-sm font-semibold hover:bg-[#28a745] transition-colors">
            Create Lot
          </Link>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="text-[#30d158] text-xs font-semibold uppercase tracking-widest mb-6">Material Intelligence & Traceability</div>
              <h1 className="text-6xl md:text-7xl font-light text-[#f5f5f7] tracking-tight leading-none mb-6">
                ReLoop
              </h1>
              <p className="text-xl text-[#86868b] leading-relaxed max-w-lg mb-8">
                Turning discarded electronics into traceable material.
              </p>
              <p className="text-base text-[#86868b] leading-relaxed mb-10 max-w-lg">
                ReLoop brings structure and visibility to the journey of discarded electronics — from capture to certification.
              </p>
              <div className="flex gap-4">
                <Link href="/new-lot" className="px-6 py-3 bg-[#30d158] text-black rounded-xl text-sm font-semibold hover:bg-[#28a745] transition-colors">
                  Get Started
                </Link>
                <a href="#how-it-works" className="px-6 py-3 border border-[#38383a] text-[#f5f5f7] rounded-xl text-sm font-medium hover:border-[#86868b] transition-colors">
                  Learn More
                </a>
              </div>
            </div>
            <div>
              <HeroImage />
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="py-24 px-8 border-t border-[#38383a]">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-light text-[#f5f5f7] tracking-tight mb-6">The Problem</h2>
              <p className="text-lg text-[#86868b] leading-relaxed mb-6">
                Electronic waste is difficult to identify, handle, and move through responsible recycling channels.
              </p>
              <p className="text-base text-[#86868b] leading-relaxed">
                Millions of tons of discarded electronics sit in limbo — unlogged, unverified, and unrouted. Without a clear system, valuable materials are lost and hazardous components pose real risks.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: "?", title: "Unidentified", desc: "Materials go unrecognized and unclassified" },
                { icon: "⚠", title: "Unsafe", desc: "Hazardous waste reaches untrained hands" },
                { icon: "✕", title: "Untracked", desc: "No record of movement or transformation" },
                { icon: "→", title: "Unrouted", desc: "Materials end up in wrong facilities" },
              ].map((item) => (
                <div key={item.title} className="bg-[#1c1c1e] border border-[#38383a] rounded-2xl p-6">
                  <div className="text-2xl mb-3">{item.icon}</div>
                  <h3 className="text-sm font-semibold text-[#f5f5f7] mb-1">{item.title}</h3>
                  <p className="text-xs text-[#86868b]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24 px-8 border-t border-[#38383a]">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl font-light text-[#f5f5f7] tracking-tight mb-6">ReLoop Brings Structure</h2>
          <p className="text-lg text-[#86868b] max-w-2xl mx-auto leading-relaxed">
            ReLoop is built for the people who care about what happens to discarded electronics — not just the technology behind it. It brings clarity, verification, and responsible handling to every step.
          </p>
        </div>
      </section>

      <VisualStory />
      <MaterialPassport />
      <TrustSection />
      <Footer />
    </div>
  );
}
