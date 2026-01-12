"use client";

import { BottomNav } from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Main content area - pad bottom for nav */}
      <main className="pb-24">{children}</main>

      {/* Bottom navigation */}
      <BottomNav />
    </div>
  );
}
