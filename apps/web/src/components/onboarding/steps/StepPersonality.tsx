"use client";

import type { OnboardingData } from "../OnboardingModal";

interface StepPersonalityProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export function StepPersonality({
  data,
  onNext,
  onBack,
}: StepPersonalityProps) {
  if (!data.personality) {
    return (
      <div className="text-center py-8">
        <p className="text-white/60">No personality data available</p>
        <button
          onClick={onBack}
          className="mt-4 px-6 py-2 border border-white/20 rounded-lg text-white/70 hover:text-white"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-white text-lg font-medium mb-1">
          Here&apos;s how you talk
        </h3>
        <p className="text-white/50 text-sm">
          We extracted this from your WhatsApp messages
        </p>
      </div>

      {/* Personality cards */}
      <div className="space-y-3">
        {/* Tone */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🎭</span>
            <span className="text-white/60 text-sm font-medium">Tone</span>
          </div>
          <p className="text-white">{data.personality.tone}</p>
        </div>

        {/* Message length */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">📏</span>
            <span className="text-white/60 text-sm font-medium">
              Message length
            </span>
          </div>
          <p className="text-white">{data.personality.messageLength}</p>
        </div>

        {/* Signature phrases */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">💬</span>
            <span className="text-white/60 text-sm font-medium">
              Signature phrases
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.personality.signaturePhrases.map((phrase, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-white/10 rounded-full text-white text-sm"
              >
                &quot;{phrase}&quot;
              </span>
            ))}
          </div>
        </div>

        {/* Emoji usage */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">😊</span>
            <span className="text-white/60 text-sm font-medium">
              Emoji usage
            </span>
          </div>
          <p className="text-white">{data.personality.emojiUsage}</p>
        </div>
      </div>

      {/* Confirmation message */}
      <div className="bg-[#33ff00]/10 border border-[#33ff00]/30 rounded-xl p-4">
        <p className="text-[#33ff00] text-sm">
          Does this sound like you? If something&apos;s off, you can go back and
          try a different chat export.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 rounded-xl border border-white/20 text-white/70 hover:bg-white/5 hover:text-white transition-all"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 py-3 rounded-xl font-medium bg-[#33ff00] text-black hover:bg-[#33ff00]/90 transition-all"
        >
          Looks good!
        </button>
      </div>
    </div>
  );
}
