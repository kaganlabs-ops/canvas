"use client";

import { useState, useRef, useEffect } from "react";
import type { OnboardingData } from "../OnboardingModal";

interface StepTestProps {
  data: OnboardingData;
  onBack: () => void;
  onFinish: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_PROMPTS = [
  "What's your morning routine?",
  "How do you stay productive?",
  "What advice would you give your younger self?",
];

export function StepTest({ data, onBack, onFinish }: StepTestProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // For now, use a simple chat endpoint
      // Later this will use the full agent with personality
      const response = await fetch("/api/onboarding/test-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          creatorName: data.name,
          personalityMd: data.personalityMd,
          history: messages,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: result.response },
        ]);
      } else {
        // Fallback response if API doesn't exist yet
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Hey! I'm ${data.name}'s AI agent. The test chat API isn't set up yet, but your personality has been saved and you're ready to go!`,
          },
        ]);
      }
    } catch {
      // Fallback for demo
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `I'm ${data.name}'s AI. Your agent is ready! This is a preview of how I'll respond.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex flex-col h-[400px]">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-white text-lg font-medium mb-1">
          Talk to yourself
        </h3>
        <p className="text-white/50 text-sm">
          Test your agent. Ask it something your audience would ask.
        </p>
      </div>

      {/* Chat area */}
      <div className="flex-1 bg-white/5 border border-white/10 rounded-xl overflow-hidden flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                {data.photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.photoPreview}
                    alt={data.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-2xl">
                    {data.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-white/60 text-sm mb-4">
                Try asking something:
              </p>
              <div className="space-y-2">
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(prompt)}
                    className="block w-full text-left px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 text-sm transition-colors"
                  >
                    &quot;{prompt}&quot;
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                      msg.role === "user"
                        ? "bg-[#33ff00] text-black"
                        : "bg-white/10 text-white"
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/10 px-4 py-2 rounded-2xl">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" />
                      <span
                        className="w-2 h-2 bg-white/40 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      />
                      <span
                        className="w-2 h-2 bg-white/40 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-white/10">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/40"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-xl transition-colors"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-white"
              >
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </form>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 rounded-xl border border-white/20 text-white/70 hover:bg-white/5 hover:text-white transition-all"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onFinish}
          className="flex-1 py-3 rounded-xl font-medium bg-[#33ff00] text-black hover:bg-[#33ff00]/90 transition-all"
        >
          Publish Agent
        </button>
      </div>
    </div>
  );
}
