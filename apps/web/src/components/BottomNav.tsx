"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe font-mono">
      {/* Terminal background */}
      <div className="absolute inset-0 bg-[#0a0a0a]/95 border-t border-[#33ff00]/30" />

      {/* Nav content */}
      <div className="relative flex items-center justify-center gap-3 px-4 py-3">
        {/* Canvas button */}
        <Link
          href="/canvas"
          className={`px-4 py-2 border transition-all text-xs tracking-wider ${
            isActive("/canvas")
              ? "border-[#33ff00] bg-[#33ff00] text-[#0a0a0a]"
              : "border-[#33ff00]/40 text-[#33ff00]/70 hover:border-[#33ff00] hover:text-[#33ff00]"
          }`}
          style={isActive("/canvas") ? {} : { textShadow: "0 0 5px rgba(51, 255, 0, 0.3)" }}
        >
          [ CANVAS ]
        </Link>
      </div>
    </div>
  );
}
