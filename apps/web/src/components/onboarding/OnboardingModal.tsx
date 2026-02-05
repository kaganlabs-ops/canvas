"use client";

import { useState, useCallback } from "react";
import { StepIndicator } from "./StepIndicator";
import { StepName } from "./steps/StepName";
import { StepWhatsApp } from "./steps/StepWhatsApp";
import { StepPersonality } from "./steps/StepPersonality";
import { StepTest } from "./steps/StepTest";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface OnboardingData {
  name: string;
  photo: File | null;
  photoPreview: string | null;
  whatsappFile: File | null;
  whatsappSender: string | null;
  detectedSenders: { name: string; messageCount: number }[];
  personality: {
    tone: string;
    messageLength: string;
    signaturePhrases: string[];
    emojiUsage: string;
  } | null;
  personalityMd: string | null;
  agentSlug: string | null;
}

const TOTAL_STEPS = 4;

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<OnboardingData>({
    name: "",
    photo: null,
    photoPreview: null,
    whatsappFile: null,
    whatsappSender: null,
    detectedSenders: [],
    personality: null,
    personalityMd: null,
    agentSlug: null,
  });

  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  const nextStep = useCallback(() => {
    setError(null);
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  }, []);

  const prevStep = useCallback(() => {
    setError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleClose = useCallback(() => {
    // Reset state when closing
    setCurrentStep(1);
    setError(null);
    setData({
      name: "",
      photo: null,
      photoPreview: null,
      whatsappFile: null,
      whatsappSender: null,
      detectedSenders: [],
      personality: null,
      personalityMd: null,
      agentSlug: null,
    });
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm font-mono">
      <div className="bg-[#111] border border-white/20 rounded-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-white text-xl font-semibold">Become Infinite</h2>
            <button
              onClick={handleClose}
              className="text-white/40 hover:text-white/80 transition-colors p-1"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-white/50 text-sm">
            Create an agent that speaks, behaves, and thinks like you
          </p>

          {/* Step Indicator */}
          <StepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {currentStep === 1 && (
            <StepName
              data={data}
              updateData={updateData}
              onNext={nextStep}
            />
          )}

          {currentStep === 2 && (
            <StepWhatsApp
              data={data}
              updateData={updateData}
              onNext={nextStep}
              onBack={prevStep}
              setIsLoading={setIsLoading}
              setError={setError}
            />
          )}

          {currentStep === 3 && (
            <StepPersonality
              data={data}
              updateData={updateData}
              onNext={nextStep}
              onBack={prevStep}
              setIsLoading={setIsLoading}
              setError={setError}
            />
          )}

          {currentStep === 4 && (
            <StepTest
              data={data}
              onBack={prevStep}
              onFinish={handleClose}
            />
          )}
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#33ff00]/30 border-t-[#33ff00] rounded-full animate-spin" />
              <span className="text-[#33ff00] text-sm">Processing...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
