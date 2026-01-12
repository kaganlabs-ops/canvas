"use client";

import { useState, useEffect } from "react";

interface GeneratingRoomCardProps {
  createdAt: string;
  prompt?: string;
}

// Status messages that cycle through during generation
const STATUS_MESSAGES = [
  { text: "Setting up environment...", duration: 8000 },
  { text: "Analyzing your request...", duration: 10000 },
  { text: "Writing code...", duration: 15000 },
  { text: "Building components...", duration: 12000 },
  { text: "Installing dependencies...", duration: 10000 },
  { text: "Starting dev server...", duration: 8000 },
  { text: "Almost there...", duration: 15000 },
  { text: "Finalizing...", duration: 60000 },
];

// Average generation time in seconds (adjust based on actual data)
const ESTIMATED_TOTAL_TIME = 90;

export function GeneratingRoomCard({ createdAt, prompt }: GeneratingRoomCardProps) {
  const [statusIndex, setStatusIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Calculate elapsed time
  useEffect(() => {
    const startTime = new Date(createdAt).getTime();

    const updateElapsed = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      setElapsedSeconds(elapsed);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  // Cycle through status messages
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const scheduleNext = () => {
      const currentStatus = STATUS_MESSAGES[statusIndex];
      if (statusIndex < STATUS_MESSAGES.length - 1) {
        timeoutId = setTimeout(() => {
          setStatusIndex((prev) => prev + 1);
        }, currentStatus.duration);
      }
    };

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [statusIndex]);

  // Calculate progress percentage (capped at 95% until complete)
  const progressPercent = Math.min(95, (elapsedSeconds / ESTIMATED_TOTAL_TIME) * 100);

  // Format remaining time estimate
  const getTimeEstimate = () => {
    const remainingSeconds = Math.max(0, ESTIMATED_TOTAL_TIME - elapsedSeconds);
    if (remainingSeconds <= 0) return "Almost done...";
    if (remainingSeconds < 60) return `~${remainingSeconds}s left`;
    const mins = Math.ceil(remainingSeconds / 60);
    return `~${mins}m left`;
  };

  const currentStatus = STATUS_MESSAGES[statusIndex];

  return (
    <div className="w-full h-full bg-gradient-to-br from-white/5 to-white/[0.02] flex flex-col items-center justify-center p-4 gap-3">
      {/* Animated sparkle icon */}
      <div className="relative">
        <svg
          className="w-10 h-10 text-white/40 animate-pulse"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
          />
        </svg>
        {/* Orbiting dot */}
        <div
          className="absolute w-2 h-2 bg-white/60 rounded-full"
          style={{
            animation: "orbit 2s linear infinite",
            top: "50%",
            left: "50%",
          }}
        />
      </div>

      {/* Status text with fade transition */}
      <div className="text-center min-h-[40px] flex flex-col justify-center">
        <p
          key={statusIndex}
          className="text-white/70 text-xs animate-fade-in"
        >
          {currentStatus.text}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-[120px]">
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/40 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-white/30 text-[10px] mt-1.5 text-center">
          {getTimeEstimate()}
        </p>
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes orbit {
          from {
            transform: translate(-50%, -50%) rotate(0deg) translateX(20px) rotate(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(360deg) translateX(20px) rotate(-360deg);
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
