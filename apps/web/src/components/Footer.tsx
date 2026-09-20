export default function Footer() {
  return (
    <footer className="bg-[#1c1c1e] border-t border-[#38383a]">
      <div className="max-w-7xl mx-auto px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#30d158] flex items-center justify-center">
                <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
              </div>
              <span className="text-xl font-semibold text-[#f5f5f7] tracking-tight">ReLoop</span>
            </div>
            <p className="text-sm text-[#86868b] max-w-sm leading-relaxed mb-4">
              Building a more visible, responsible journey for discarded electronics.
            </p>
            <nav>
              <ul className="space-y-2.5">
                {["About", "How It Works", "Material Passport", "Contact"].map((item) => (
                  <li key={item}>
                    <a href={`/#${item.toLowerCase().replace(/\s+/g, "-")}`} className="text-sm text-[#86868b] hover:text-[#f5f5f7] transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-[#86868b] uppercase tracking-widest mb-4">For Businesses</h4>
            <ul className="space-y-2.5">
              {["Collection", "Material Tracking", "Recycling Partners"].map((item) => (
                <li key={item}>
                  <a href="/lots" className="text-sm text-[#86868b] hover:text-[#f5f5f7] transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-[#86868b] uppercase tracking-widest mb-4">For Collectors</h4>
            <ul className="space-y-2.5">
              {["Create a Lot", "Track Material", "View Passport"].map((item) => (
                <li key={item}>
                  <a href={item === "Create a Lot" ? "/new-lot" : item === "View Passport" ? "/passport" : "/lots"} className="text-sm text-[#86868b] hover:text-[#f5f5f7] transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-[#86868b] uppercase tracking-widest mb-4">Company</h4>
            <ul className="space-y-2.5">
              {["About ReLoop", "Contact", "Privacy", "Terms"].map((item) => (
                <li key={item}>
                  <a href={item === "About ReLoop" ? "/#about" : item === "Contact" ? "/#contact" : "/#"} className="text-sm text-[#86868b] hover:text-[#f5f5f7] transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-[#38383a] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#6e6e72]">© 2026 ReLoop. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[#6e6e72]">ReLoop</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
