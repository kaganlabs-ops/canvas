// Room Generator - Generates deployable room code based on orchestrator output

interface RoomSpec {
  type: 'conversation' | 'video_conversation' | 'quiz' | 'tutorial' | 'custom'
  title: string
  description: string
  persona?: {
    name: string
    description: string
    imageUrl?: string
    introVideoUrl?: string
    avatarId?: string  // HeyGen streaming avatar ID
  }
  features: string[]
  apiEndpoints: {
    chat?: string
    tts?: string
    video?: string
    heygenToken?: string
  }
}

// Generate a conversation room - a chat interface with a persona
export function generateConversationRoom(spec: RoomSpec): string {
  const personaName = spec.persona?.name || 'Assistant'
  const personaDescription = spec.persona?.description || ''

  return `"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ConversationRoom() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const personaName = "${personaName}";
  const personaDescription = \`${personaDescription.replace(/`/g, '\\`')}\`;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    // Add user message
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaName,
          personaDescription,
          userMessage,
          conversationHistory: messages
        })
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
    } catch (error) {
      console.error("Error:", error);
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-sm border-b border-white/10 p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white">${spec.title}</h1>
          <p className="text-gray-400 text-sm">${spec.description}</p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-xl text-white mb-2">Start a conversation with {personaName}</h2>
              <p className="text-gray-400">Ask anything you'd like to know</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={\`flex \${msg.role === "user" ? "justify-end" : "justify-start"}\`}
            >
              <div
                className={\`max-w-[80%] rounded-2xl px-4 py-3 \${
                  msg.role === "user"
                    ? "bg-purple-600 text-white"
                    : "bg-white/10 text-white border border-white/10"
                }\`}
              >
                {msg.role === "assistant" && (
                  <div className="text-xs text-purple-400 mb-1 font-medium">{personaName}</div>
                )}
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/10 rounded-2xl px-4 py-3 border border-white/10">
                <div className="text-xs text-purple-400 mb-1 font-medium">{personaName}</div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-black/30 backdrop-blur-sm border-t border-white/10 p-4">
        <div className="max-w-4xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={\`Message \${personaName}...\`}
            disabled={isLoading}
            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
`
}

// Generate a video conversation room - real-time video chat with HeyGen Streaming Avatar
export function generateVideoConversationRoom(spec: RoomSpec): string {
  const personaName = spec.persona?.name || 'Assistant'
  const personaDescription = spec.persona?.description || ''
  const personaImageUrl = spec.persona?.imageUrl || ''

  return `"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import StreamingAvatar, { AvatarQuality, StreamingEvents, TaskType } from "@heygen/streaming-avatar";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "speaking";

export default function VideoConversationRoom() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [avatar, setAvatar] = useState<StreamingAvatar | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const personaName = "${personaName}";
  const personaDescription = \`${personaDescription.replace(/`/g, '\\`')}\`;
  const personaImageUrl = "${personaImageUrl}";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize HeyGen Streaming Avatar
  const initializeAvatar = useCallback(async () => {
    if (avatar || connectionStatus !== "disconnected") return;

    setConnectionStatus("connecting");

    try {
      // Get HeyGen access token from our API
      const tokenRes = await fetch("/api/heygen-token");
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || tokenData.error) {
        throw new Error(tokenData.error || "Failed to get HeyGen token");
      }
      const { token } = tokenData;

      // Initialize StreamingAvatar
      const newAvatar = new StreamingAvatar({ token });

      // Set up event listeners
      newAvatar.on(StreamingEvents.STREAM_READY, (event: { detail: MediaStream }) => {
        if (videoRef.current) {
          videoRef.current.srcObject = event.detail;
          videoRef.current.play().catch(console.error);
        }
        setConnectionStatus("connected");
      });

      newAvatar.on(StreamingEvents.AVATAR_START_TALKING, () => {
        setConnectionStatus("speaking");
      });

      newAvatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
        setConnectionStatus("connected");
      });

      newAvatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        setConnectionStatus("disconnected");
        setAvatar(null);
      });

      // Start avatar session
      await newAvatar.createStartAvatar({
        quality: AvatarQuality.High,
        avatarName: personaImageUrl || "default",
        voice: {
          voiceId: "1bd001e7e50f421d891986aad5158bc8" // Default voice, can be customized
        }
      });

      setAvatar(newAvatar);
    } catch (error) {
      console.error("Failed to initialize avatar:", error);
      setConnectionStatus("disconnected");
    }
  }, [avatar, connectionStatus, personaImageUrl]);

  // Cleanup on unmount (don't auto-connect - requires user interaction for video autoplay)
  useEffect(() => {
    return () => {
      if (avatar) {
        avatar.stopAvatar();
      }
    };
  }, [avatar]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !avatar) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    // Add user message
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);

    try {
      // Get Claude's response as the persona
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaName,
          personaDescription,
          userMessage,
          conversationHistory: messages
        })
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      const assistantMessage = data.response;

      // Add assistant message to chat
      setMessages(prev => [...prev, { role: "assistant", content: assistantMessage }]);

      // Make the avatar speak the response
      await avatar.speak({
        text: assistantMessage,
        taskType: TaskType.REPEAT
      });
    } catch (error) {
      console.error("Error:", error);
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case "connected": return "bg-green-500";
      case "connecting": return "bg-yellow-500 animate-pulse";
      case "speaking": return "bg-purple-500 animate-pulse";
      default: return "bg-gray-500";
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case "connected": return "Connected";
      case "connecting": return "Connecting...";
      case "speaking": return "Speaking...";
      default: return "Disconnected";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-sm border-b border-white/10 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">${spec.title}</h1>
            <p className="text-gray-400 text-sm">${spec.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={\`w-3 h-3 rounded-full \${getStatusColor()}\`} />
            <span className="text-white text-sm">{getStatusText()}</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-6xl mx-auto w-full">
        {/* Video area */}
        <div className="lg:w-1/2 flex flex-col">
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-white/10">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {connectionStatus === "disconnected" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <button
                  onClick={initializeAvatar}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
                >
                  Start Video Chat
                </button>
              </div>
            )}
            {connectionStatus === "connecting" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-white text-center">
                  <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p>Connecting to {personaName}...</p>
                </div>
              </div>
            )}
          </div>
          <div className="mt-2 text-center text-gray-400 text-sm">
            {personaName} • Live Video Chat
          </div>
        </div>

        {/* Chat area */}
        <div className="lg:w-1/2 flex flex-col bg-black/20 rounded-2xl border border-white/10">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">🎥</div>
                <h2 className="text-lg text-white mb-2">Video chat with {personaName}</h2>
                <p className="text-gray-400 text-sm">Type a message to start the conversation</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={\`flex \${msg.role === "user" ? "justify-end" : "justify-start"}\`}
              >
                <div
                  className={\`max-w-[85%] rounded-2xl px-4 py-2 \${
                    msg.role === "user"
                      ? "bg-purple-600 text-white"
                      : "bg-white/10 text-white border border-white/10"
                  }\`}
                >
                  {msg.role === "assistant" && (
                    <div className="text-xs text-purple-400 mb-1 font-medium">{personaName}</div>
                  )}
                  <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/10 rounded-2xl px-4 py-2 border border-white/10">
                  <div className="text-xs text-purple-400 mb-1 font-medium">{personaName}</div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/10 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder={\`Message \${personaName}...\`}
                disabled={isLoading || connectionStatus === "disconnected"}
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 text-sm"
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim() || connectionStatus === "disconnected"}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl font-medium transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`
}

// Generate the HeyGen token API route
export function generateHeygenTokenRoute(): string {
  return `import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;

    if (!apiKey) {
      console.error("HEYGEN_API_KEY is not set in environment variables");
      return new Response(JSON.stringify({ error: "HEYGEN_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("Requesting HeyGen streaming token...");

    const response = await fetch("https://api.heygen.com/v1/streaming.create_token", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json"
      }
    });

    const responseText = await response.text();
    console.log("HeyGen API response status:", response.status);
    console.log("HeyGen API response body:", responseText);

    if (!response.ok) {
      throw new Error(\`HeyGen API error (status \${response.status}): \${responseText}\`);
    }

    const data = JSON.parse(responseText);

    // HeyGen returns error: null for success
    if (data.error !== null) {
      throw new Error(\`HeyGen API error: \${JSON.stringify(data.error)}\`);
    }

    return new Response(JSON.stringify({ token: data.data.token }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("HeyGen token error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
`
}

// Generate the API route for chat
export function generateChatApiRoute(_spec: RoomSpec): string {
  return `import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const { personaName, personaDescription, userMessage, conversationHistory } = await request.json();

  if (!userMessage) {
    return new Response(JSON.stringify({ error: "Message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: \`You are \${personaName}. \${personaDescription}

IMPORTANT GUIDELINES:
- Stay completely in character at all times
- Respond as \${personaName} would, using their known speech patterns, vocabulary, and perspectives
- Draw from their known beliefs, experiences, and way of thinking
- Keep responses conversational and natural, as if in a real conversation
- Avoid breaking character or acknowledging that you're an AI
- If asked about events after your time, gracefully acknowledge your perspective is from your era
- Be engaging, thoughtful, and authentic to the persona\`,
        messages: [
          ...(conversationHistory || []),
          { role: "user", content: userMessage }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    const data = await response.json();
    const textContent = data.content.find((block: { type: string }) => block.type === "text");
    const responseText = textContent?.text || "";

    return new Response(JSON.stringify({ response: responseText }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
`
}

// Generate room files based on spec
export function generateRoomFiles(spec: RoomSpec): Map<string, string> {
  const files = new Map<string, string>()

  switch (spec.type) {
    case 'video_conversation':
      files.set('app/page.tsx', generateVideoConversationRoom(spec))
      files.set('app/api/chat/route.ts', generateChatApiRoute(spec))
      files.set('app/api/heygen-token/route.ts', generateHeygenTokenRoute())
      break

    case 'conversation':
      files.set('app/page.tsx', generateConversationRoom(spec))
      files.set('app/api/chat/route.ts', generateChatApiRoute(spec))
      break

    // TODO: Add other room types
    case 'quiz':
    case 'tutorial':
    case 'custom':
    default:
      // For now, default to conversation room
      files.set('app/page.tsx', generateConversationRoom(spec))
      files.set('app/api/chat/route.ts', generateChatApiRoute(spec))
  }

  return files
}

// Generate the prompt for Claude Code to create the room
export function generateClaudeCodePrompt(spec: RoomSpec): string {
  const files = generateRoomFiles(spec)

  let prompt = `Create a Next.js app with the following files:\n\n`

  for (const [path, content] of files) {
    prompt += `File: ${path}\n\`\`\`tsx\n${content}\n\`\`\`\n\n`
  }

  if (spec.type === 'video_conversation') {
    prompt += `Make sure to:
1. Use "use client" directive for components with hooks
2. Use only Tailwind CSS for styling
3. Install @heygen/streaming-avatar and livekit-client packages: npm install @heygen/streaming-avatar livekit-client
4. Create all the API routes as specified
5. The ANTHROPIC_API_KEY and HEYGEN_API_KEY will be provided as environment variables`
  } else {
    prompt += `Make sure to:
1. Use "use client" directive for components with hooks
2. Use only Tailwind CSS for styling
3. Create the api/chat/route.ts file for the chat endpoint
4. The ANTHROPIC_API_KEY will be provided as an environment variable`
  }

  return prompt
}
