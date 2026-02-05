"use client";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step, index) => (
        <div key={step} className="flex items-center">
          {/* Step circle */}
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
              step < currentStep
                ? "bg-[#33ff00] text-black"
                : step === currentStep
                ? "bg-white text-black"
                : "bg-white/20 text-white/50"
            }`}
          >
            {step < currentStep ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              step
            )}
          </div>

          {/* Connector line */}
          {index < totalSteps - 1 && (
            <div
              className={`w-8 h-0.5 mx-1 transition-all ${
                step < currentStep ? "bg-[#33ff00]" : "bg-white/20"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
