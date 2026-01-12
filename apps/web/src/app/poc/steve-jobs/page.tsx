"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";

type VideoState = "idle" | "listening" | "thinking" | "speaking";

const VIDEO_SOURCES: Record<VideoState, string> = {
  idle: "/listening.mp4",
  listening: "/listening.mp4",
  thinking: "/thinking.mp4",
  speaking: "/speaking.mp4",
};

export default function SteveJobsRoom() {
  const [videoState, setVideoState] = useState<VideoState>("idle");
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [slideBullets, setSlideBullets] = useState<string[]>([]);
  const [isGeneratingSlide, setIsGeneratingSlide] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generate slide bullets from Steve's response
  const generateSlide = useCallback(async (text: string) => {
    if (!text || text.length < 20) return; // Skip short responses

    setIsGeneratingSlide(true);
    try {
      const response = await fetch("/api/poc-slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (response.ok) {
        const { bullets } = await response.json();
        if (bullets && bullets.length > 0) {
          setSlideBullets(bullets);
        }
      }
    } catch (error) {
      console.error("Failed to generate slide:", error);
    } finally {
      setIsGeneratingSlide(false);
    }
  }, []);

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected to ElevenLabs");
      setIsConnected(true);
      setVideoState("listening");
    },
    onDisconnect: () => {
      console.log("Disconnected from ElevenLabs");
      setIsConnected(false);
      setVideoState("idle");
    },
    onModeChange: ({ mode }) => {
      console.log("Mode changed:", mode);
      if (mode === "listening") {
        setVideoState("listening");
      } else if (mode === "speaking") {
        setVideoState("speaking");
      }
    },
    onMessage: (message) => {
      console.log("Message received:", JSON.stringify(message, null, 2));

      // Handle different message formats from ElevenLabs
      // The SDK may send messages in various formats depending on version
      const msg = message as unknown as Record<string, unknown>;

      // Try to extract user transcript
      if (msg.type === "user_transcript" || msg.source === "user") {
        const text = msg.user_transcript || msg.message || msg.text || msg.transcript;
        if (text && typeof text === "string") {
          setTranscript((prev) => [...prev, `You: ${text}`]);
        }
      }

      // Try to extract agent response
      if (msg.type === "agent_response" || msg.source === "ai" || msg.source === "agent") {
        const text = msg.agent_response || msg.message || msg.text || msg.response;
        if (text && typeof text === "string") {
          setTranscript((prev) => [...prev, `Steve: ${text}`]);
          generateSlide(text);
        }
      }

      // Handle transcript events (final transcripts)
      if (msg.type === "transcript" || msg.type === "final_transcript") {
        const role = msg.role || msg.source;
        const text = msg.text || msg.message || msg.transcript;
        if (text && typeof text === "string") {
          if (role === "user") {
            setTranscript((prev) => [...prev, `You: ${text}`]);
          } else if (role === "agent" || role === "assistant" || role === "ai") {
            setTranscript((prev) => [...prev, `Steve: ${text}`]);
            generateSlide(text);
          }
        }
      }
    },
    onError: (error) => {
      console.error("Conversation error:", error);
    },
  });

  // Scroll to bottom when transcript updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Change video when state changes
  useEffect(() => {
    if (videoRef.current) {
      const currentSrc = videoRef.current.src;
      const newSrc = VIDEO_SOURCES[videoState];

      if (!currentSrc.endsWith(newSrc)) {
        videoRef.current.src = newSrc;
        videoRef.current.load();
        videoRef.current.play().catch(console.error);
      }
    }
  }, [videoState]);

  const startConversation = useCallback(async () => {
    try {
      // Get signed URL from our API
      const response = await fetch("/api/poc-convai-token");
      if (!response.ok) {
        throw new Error("Failed to get conversation token");
      }
      const { signedUrl } = await response.json();

      // Start the conversation
      await conversation.startSession({ signedUrl });
    } catch (error) {
      console.error("Failed to start conversation:", error);
    }
  }, [conversation]);

  const endConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  // Get status display
  const getStatus = () => {
    if (!isConnected) {
      return { text: "Click to Start", color: "bg-gray-500" };
    }
    switch (videoState) {
      case "thinking":
        return { text: "Thinking...", color: "bg-yellow-500" };
      case "speaking":
        return { text: "Speaking...", color: "bg-blue-500" };
      case "listening":
        return { text: "Listening...", color: "bg-green-500" };
      default:
        return { text: "Ready", color: "bg-gray-500" };
    }
  };

  const status = getStatus();

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Video Panel - Left Side */}
      <div className="w-1/3 flex flex-col items-center justify-center bg-black p-6">
        <div className="relative w-full max-w-lg aspect-video rounded-2xl overflow-hidden shadow-2xl">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            src={VIDEO_SOURCES[videoState]}
          />

          {/* Status indicator */}
          <div className="absolute bottom-4 left-4 flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${isConnected ? "animate-pulse" : ""} ${status.color}`}
            />
            <span className="text-white text-sm font-medium">
              {status.text}
            </span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="mt-6 flex gap-4">
          {!isConnected ? (
            <button
              onClick={startConversation}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-colors"
            >
              Start Conversation
            </button>
          ) : (
            <button
              onClick={endConversation}
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-colors"
            >
              End Conversation
            </button>
          )}
        </div>

        {/* Instructions */}
        <p className="mt-4 text-gray-400 text-center max-w-sm text-sm">
          {isConnected
            ? "Speak naturally. Steve will respond when you pause."
            : "Click to start a voice conversation with Steve Jobs."}
        </p>
      </div>

      {/* Slide Panel - Center */}
      <div className="w-1/3 flex flex-col items-center justify-center bg-gray-900 p-6">
        {/* White slide card */}
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 min-h-[400px] flex flex-col">
          {/* Slide Header */}
          <div className="border-b border-gray-200 pb-4 mb-6">
            <h2 className="text-gray-900 text-xl font-semibold">Key Takeaways</h2>
          </div>

          {/* Slide Content */}
          <div className="flex-1 flex flex-col justify-center">
            {isGeneratingSlide ? (
              <div className="flex justify-center">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
              </div>
            ) : slideBullets.length > 0 ? (
              <ul className="space-y-4">
                {slideBullets.map((bullet, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3 animate-fade-in"
                    style={{ animationDelay: `${idx * 150}ms` }}
                  >
                    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-gray-900 mt-2" />
                    <span className="text-gray-800 text-lg leading-relaxed">
                      {bullet}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center text-gray-400">
                <p className="text-base">Waiting for Steve to speak...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transcript Panel - Right Side */}
      <div className="w-1/3 flex flex-col bg-gray-800">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700">
          <h1 className="text-xl font-semibold text-white">
            Talk to Steve Jobs
          </h1>
          <p className="text-gray-400 text-sm">
            ElevenLabs Conversational AI POC
          </p>
        </div>

        {/* Transcript */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {transcript.length === 0 && (
            <div className="text-gray-500 text-center py-8">
              Start a conversation to see the transcript here.
            </div>
          )}

          {transcript.map((line, idx) => {
            const isUser = line.startsWith("You:");
            return (
              <div
                key={idx}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    isUser
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-100"
                  }`}
                >
                  {!isUser && (
                    <div className="text-xs text-gray-400 mb-1">Steve Jobs</div>
                  )}
                  <p className="whitespace-pre-wrap">
                    {line.replace(/^(You:|Steve:)\s*/, "")}
                  </p>
                </div>
              </div>
            );
          })}

          {videoState === "thinking" && (
            <div className="flex justify-start">
              <div className="bg-gray-700 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Voice indicator */}
        {isConnected && (
          <div className="p-4 border-t border-gray-700">
            <div className="flex items-center justify-center gap-3 text-gray-400">
              <div
                className={`w-4 h-4 rounded-full ${
                  videoState === "listening" ? "bg-green-500 animate-pulse" : "bg-gray-600"
                }`}
              />
              <span>
                {videoState === "listening"
                  ? "Listening... speak now"
                  : videoState === "speaking"
                    ? "Steve is speaking..."
                    : "Processing..."}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
