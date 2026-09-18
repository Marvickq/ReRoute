export default function TopBar({ title }: { title: string }) {
  return (
    <header className="h-14 border-b border-[#2a2a2a] bg-[#0a0a0a] flex items-center justify-between px-6">
      <h1 className="text-[15px] font-semibold text-[#f0f0f0]">{title}</h1>
      <div className="flex items-center gap-4">
        <span className="text-[12px] text-[#666] font-mono">SYS:OPERATIONAL</span>
        <div className="w-7 h-7 rounded-full bg-[#222] border border-[#333] flex items-center justify-center">
          <span className="text-[11px] font-medium text-[#a0a0a0]">OP</span>
        </div>
      </div>
    </header>
  );
}
