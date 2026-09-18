"use client";

import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <div className="flex-1 ml-60">
        <TopBar title={title} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
