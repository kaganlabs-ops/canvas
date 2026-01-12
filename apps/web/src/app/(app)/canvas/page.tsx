"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

function generateCanvasId() {
  return Math.random().toString(36).substring(2, 8);
}

export default function CanvasRedirect() {
  const router = useRouter();

  useEffect(() => {
    const newId = generateCanvasId();
    router.replace(`/canvas/${newId}`);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center font-mono">
      <span
        className="text-[#33ff00] text-sm animate-pulse"
        style={{ textShadow: "0 0 10px rgba(51, 255, 0, 0.5)" }}
      >
        Creating your canvas...
      </span>
    </div>
  );
}
