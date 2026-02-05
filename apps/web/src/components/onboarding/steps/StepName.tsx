"use client";

import { useRef } from "react";
import type { OnboardingData } from "../OnboardingModal";

interface StepNameProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
}

export function StepName({ data, updateData, onNext }: StepNameProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      updateData({
        photo: file,
        photoPreview: URL.createObjectURL(file),
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (data.name.trim()) {
      onNext();
    }
  };

  const canProceed = data.name.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name input */}
      <div>
        <label className="block text-white/70 text-sm mb-2">
          What&apos;s your name?
        </label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => updateData({ name: e.target.value })}
          placeholder="Enter your name"
          className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
          autoFocus
        />
      </div>

      {/* Photo upload */}
      <div>
        <label className="block text-white/70 text-sm mb-2">
          Add your photo <span className="text-white/40">(optional)</span>
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full bg-white/5 border border-white/20 border-dashed rounded-xl p-6 flex flex-col items-center gap-3 hover:bg-white/10 hover:border-white/30 transition-all group"
        >
          {data.photoPreview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.photoPreview}
                alt="Preview"
                className="w-20 h-20 rounded-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-xs">Change</span>
              </div>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-white/40"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
              <span className="text-white/40 text-sm">
                Take a pic or upload
              </span>
            </>
          )}
        </button>
      </div>

      {/* Next button */}
      <button
        type="submit"
        disabled={!canProceed}
        className={`w-full py-3 rounded-xl font-medium transition-all ${
          canProceed
            ? "bg-white/90 text-black hover:bg-white"
            : "bg-white/20 text-white/40 cursor-not-allowed"
        }`}
      >
        Next
      </button>
    </form>
  );
}
