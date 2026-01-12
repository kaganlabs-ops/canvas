"use client";

import { useState, useRef } from "react";

const PRESET_PROMPTS = [
  {
    name: "Listening",
    prompt: "Steve Jobs listening intently, focused expression, occasional subtle nods",
  },
  {
    name: "Thinking",
    prompt: "Steve Jobs pondering deeply, looking slightly upward, contemplative expression",
  },
  {
    name: "Speaking",
    prompt: "Steve Jobs explaining with passion, subtle hand gestures, animated expression",
  },
  {
    name: "Nodding",
    prompt: "Steve Jobs nodding slowly in agreement, thoughtful expression",
  },
  {
    name: "Skeptical",
    prompt: "Steve Jobs with raised eyebrow, skeptical but curious expression",
  },
  {
    name: "Opening",
    prompt: "Steve Jobs ready to engage, confident posture, slight welcoming smile",
  },
];

type ReferenceMode = "image" | "video";

export default function VideoGenPage() {
  const [mode, setMode] = useState<ReferenceMode>("video");
  const [referenceImageUrl, setReferenceImageUrl] = useState(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Steve_Jobs_Headshot_2010-CROP_%28cropped_2%29.jpg/440px-Steve_Jobs_Headshot_2010-CROP_%28cropped_2%29.jpg"
  );
  const [referenceVideoUrl, setReferenceVideoUrl] = useState("");
  const [prompt, setPrompt] = useState(PRESET_PROMPTS[0].prompt);
  const [duration, setDuration] = useState("5");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeStartTime, setYoutubeStartTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadFromYoutube = async () => {
    if (!youtubeUrl) return;

    try {
      setError(null);
      setIsUploading(true);

      const response = await fetch("/api/poc-youtube-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeUrl,
          startTime: youtubeStartTime,
          duration: 8, // 8 seconds for fal.ai (3-10s requirement)
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to download from YouTube");
      }

      setReferenceVideoUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download");
    } finally {
      setIsUploading(false);
    }
  };

  const uploadFile = async (file: File): Promise<string> => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/poc-fal-upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload file");
      }

      return data.url;
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      const url = await uploadFile(file);
      setReferenceVideoUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload");
    }
  };

  const useLocalVideo = async () => {
    try {
      setError(null);
      setIsUploading(true);

      // Fetch the local video file (8-second reference clip)
      const response = await fetch("/steve-jobs-ref.mp4");
      const blob = await response.blob();
      const file = new File([blob], "steve-jobs-ref.mp4", { type: "video/mp4" });

      const url = await uploadFile(file);
      setReferenceVideoUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload local video");
    } finally {
      setIsUploading(false);
    }
  };

  const generateVideo = async () => {
    setIsGenerating(true);
    setError(null);
    setVideoUrl(null);

    try {
      const body: Record<string, string> = {
        prompt,
        duration,
        mode,
      };

      if (mode === "image") {
        body.referenceImageUrl = referenceImageUrl;
      } else {
        body.referenceVideoUrl = referenceVideoUrl;
      }

      const response = await fetch("/api/poc-video-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate video");
      }

      setVideoUrl(data.videoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">
          Video Generation POC
        </h1>
        <p className="text-gray-400 mb-8">
          Generate contextual video clips using fal.ai Kling O1 Reference
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Input Panel */}
          <div className="space-y-6">
            {/* Mode Toggle */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Reference Type
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setMode("video")}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    mode === "video"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  Video Reference
                </button>
                <button
                  onClick={() => setMode("image")}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    mode === "image"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  Image Reference
                </button>
              </div>
            </div>

            {/* Reference Input */}
            {mode === "video" ? (
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Reference Video
                </label>
                <div className="space-y-3">
                  <button
                    onClick={useLocalVideo}
                    disabled={isUploading}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                  >
                    {isUploading ? "Uploading..." : "Use steve-jobs-ref.mp4 (8s clip)"}
                  </button>

                  <div className="text-gray-500 text-center text-sm">or</div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="video/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white px-4 py-3 rounded-lg transition-colors"
                  >
                    Upload Custom Video
                  </button>

                  <div className="text-gray-500 text-center text-sm">or from YouTube</div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="YouTube URL"
                      className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      value={youtubeStartTime || 0}
                      onChange={(e) => setYoutubeStartTime(Number(e.target.value) || 0)}
                      placeholder="Start (s)"
                      className="w-20 bg-gray-800 text-white rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={downloadFromYoutube}
                    disabled={isUploading || !youtubeUrl}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    {isUploading ? "Downloading..." : "Download 8s from YouTube"}
                  </button>

                  {referenceVideoUrl && (
                    <div className="mt-3">
                      <p className="text-green-400 text-sm mb-2">Video uploaded</p>
                      <video
                        src={referenceVideoUrl}
                        controls
                        className="w-full rounded-lg max-h-40"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Reference Image
                </label>
                <div className="space-y-3">
                  <button
                    onClick={async () => {
                      try {
                        setError(null);
                        setIsUploading(true);
                        const response = await fetch("/steve-jobs-frame.jpg");
                        const blob = await response.blob();
                        const file = new File([blob], "steve-jobs-frame.jpg", { type: "image/jpeg" });
                        const url = await uploadFile(file);
                        setReferenceImageUrl(url);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to upload");
                      } finally {
                        setIsUploading(false);
                      }
                    }}
                    disabled={isUploading}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                  >
                    {isUploading ? "Uploading..." : "Use steve-jobs-frame.jpg"}
                  </button>

                  <div className="text-gray-500 text-center text-sm">or enter URL</div>

                  <input
                    type="text"
                    value={referenceImageUrl}
                    onChange={(e) => setReferenceImageUrl(e.target.value)}
                    className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                </div>
                {referenceImageUrl && (
                  <div className="mt-3">
                    <img
                      src={referenceImageUrl}
                      alt="Reference"
                      className="w-32 h-32 object-cover rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Preset Prompts */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Preset Prompts
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_PROMPTS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => setPrompt(preset.prompt)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      prompt === preset.prompt
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Prompt */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Describe the desired video..."
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Duration
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setDuration("5")}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    duration === "5"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  5 seconds
                </button>
                <button
                  onClick={() => setDuration("10")}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    duration === "10"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  10 seconds
                </button>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={generateVideo}
              disabled={
                isGenerating ||
                (mode === "image" && !referenceImageUrl) ||
                (mode === "video" && !referenceVideoUrl) ||
                !prompt
              }
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl font-semibold transition-colors"
            >
              {isGenerating ? "Generating... (this takes ~2-3 min)" : "Generate Video"}
            </button>

            {/* Error Display */}
            {error && (
              <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-200">
                {error}
              </div>
            )}
          </div>

          {/* Output Panel */}
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Generated Video
            </label>
            <div className="bg-gray-800 rounded-xl aspect-video flex items-center justify-center overflow-hidden">
              {isGenerating ? (
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-400">Generating video...</p>
                  <p className="text-gray-500 text-sm mt-1">
                    This usually takes 2-3 minutes
                  </p>
                </div>
              ) : videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full h-full object-contain"
                />
              ) : (
                <p className="text-gray-500">
                  Generated video will appear here
                </p>
              )}
            </div>

            {videoUrl && (
              <div className="mt-4 space-y-3">
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-400 hover:text-blue-300 text-sm break-all"
                >
                  {videoUrl}
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(videoUrl);
                  }}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Copy URL
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Pricing Info */}
        <div className="mt-8 p-4 bg-gray-800 rounded-lg">
          <p className="text-gray-400 text-sm">
            <strong className="text-white">Pricing:</strong>{" "}
            {mode === "video"
              ? "Video-to-Video: ~$0.84 for 5s, ~$1.68 for 10s"
              : "Image-to-Video: ~$0.35-0.70 for 5s"
            }
          </p>
        </div>
      </div>
    </div>
  );
}
