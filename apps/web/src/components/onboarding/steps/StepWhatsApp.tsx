"use client";

import { useRef, useState, useCallback } from "react";
import type { OnboardingData } from "../OnboardingModal";

interface StepWhatsAppProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export function StepWhatsApp({
  data,
  updateData,
  onNext,
  onBack,
  setIsLoading,
  setError,
}: StepWhatsAppProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  // Parse WhatsApp file to detect senders
  const parseWhatsAppFile = useCallback(
    async (file: File) => {
      setIsParsing(true);
      setError(null);

      try {
        const content = await file.text();

        // Parse senders client-side (simple regex matching)
        const senderCounts: Record<string, number> = {};

        // WhatsApp format patterns
        const patterns = [
          /^\[?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\]?\s*-?\s*([^:]+):/gim,
        ];

        for (const pattern of patterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const sender = match[1].trim();
            // Skip system messages
            if (
              sender.toLowerCase().includes("messages and calls are end-to-end encrypted") ||
              sender.length > 50
            ) {
              continue;
            }
            senderCounts[sender] = (senderCounts[sender] || 0) + 1;
          }
        }

        const senders = Object.entries(senderCounts)
          .map(([name, messageCount]) => ({ name, messageCount }))
          .filter((s) => s.messageCount > 10) // Only show senders with meaningful message counts
          .sort((a, b) => b.messageCount - a.messageCount);

        if (senders.length === 0) {
          setError(
            "Could not detect any senders in this file. Make sure it's a WhatsApp export (.txt)"
          );
          setIsParsing(false);
          return;
        }

        // Try to auto-match by name
        const userName = data.name.toLowerCase();
        const matchedSender = senders.find(
          (s) =>
            s.name.toLowerCase().includes(userName) ||
            userName.includes(s.name.toLowerCase())
        );

        updateData({
          whatsappFile: file,
          detectedSenders: senders,
          whatsappSender: matchedSender?.name || null,
        });
      } catch (err) {
        setError("Failed to parse WhatsApp file");
        console.error(err);
      } finally {
        setIsParsing(false);
      }
    },
    [data.name, updateData, setError]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseWhatsAppFile(file);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".txt")) {
        parseWhatsAppFile(file);
      } else {
        setError("Please upload a .txt file (WhatsApp export)");
      }
    },
    [parseWhatsAppFile, setError]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleNext = async () => {
    if (!data.whatsappFile || !data.whatsappSender) return;

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", data.whatsappFile);
      formData.append("creatorName", data.name);
      formData.append("senderName", data.whatsappSender);

      const response = await fetch("/api/onboarding/personality", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || "Failed to extract personality");
        return;
      }

      updateData({
        personality: result.preview,
        personalityMd: result.personalityMd,
        agentSlug: result.savedTo?.split("/")[2] || null,
      });

      onNext();
    } catch (err) {
      setError("Failed to process WhatsApp data");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = data.whatsappFile && data.whatsappSender;
  const matchedSender = data.detectedSenders.find(
    (s) => s.name === data.whatsappSender
  );

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div>
        <p className="text-white/70 text-sm">
          Export a WhatsApp chat where you sound most like yourself.
        </p>
        <p className="text-white/40 text-xs mt-1">
          The more messages, the better the personality extraction.
        </p>
      </div>

      {/* File upload area */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          onChange={handleFileChange}
          className="hidden"
        />

        {!data.whatsappFile ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            disabled={isParsing}
            className={`w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 transition-all ${
              isDragging
                ? "border-[#33ff00] bg-[#33ff00]/10"
                : "border-white/20 hover:border-white/40 hover:bg-white/5"
            } ${isParsing ? "opacity-50 cursor-wait" : ""}`}
          >
            {isParsing ? (
              <>
                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-white/60 text-sm">Parsing file...</span>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-xl bg-[#25D366]/20 flex items-center justify-center">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="#25D366"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </div>
                <div className="text-center">
                  <span className="text-white/80 text-sm block">
                    Drop .txt file here
                  </span>
                  <span className="text-white/40 text-xs">
                    or click to browse
                  </span>
                </div>
              </>
            )}
          </button>
        ) : (
          <div className="bg-white/5 border border-white/20 rounded-xl p-4">
            {/* File info */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#25D366]/20 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {data.whatsappFile.name}
                </p>
                <p className="text-white/40 text-xs">
                  {(data.whatsappFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={() => {
                  updateData({
                    whatsappFile: null,
                    whatsappSender: null,
                    detectedSenders: [],
                  });
                }}
                className="text-white/40 hover:text-white/80 p-1"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Sender selection */}
            {data.detectedSenders.length > 0 && (
              <div>
                <label className="block text-white/70 text-sm mb-2">
                  Which one is you?
                </label>
                <select
                  value={data.whatsappSender || ""}
                  onChange={(e) =>
                    updateData({ whatsappSender: e.target.value })
                  }
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                >
                  <option value="" className="bg-[#111]">
                    Select your name...
                  </option>
                  {data.detectedSenders.map((sender) => (
                    <option
                      key={sender.name}
                      value={sender.name}
                      className="bg-[#111]"
                    >
                      {sender.name} ({sender.messageCount} messages)
                    </option>
                  ))}
                </select>

                {/* Match confirmation */}
                {matchedSender && (
                  <div className="mt-3 flex items-center gap-2 text-[#33ff00] text-sm">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span>
                      Found {matchedSender.messageCount.toLocaleString()} messages
                      from {matchedSender.name}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
          onClick={handleNext}
          disabled={!canProceed}
          className={`flex-1 py-3 rounded-xl font-medium transition-all ${
            canProceed
              ? "bg-white/90 text-black hover:bg-white"
              : "bg-white/20 text-white/40 cursor-not-allowed"
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
}
