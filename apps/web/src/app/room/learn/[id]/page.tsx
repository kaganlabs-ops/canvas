"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { useParams, useRouter } from "next/navigation";
import { DynamicComponentRenderer, RoomComponent } from "@/components/room/DynamicComponents";

interface Character {
  id: string;
  name: string;
  avatar: string;
  background: string;
  videoSources: {
    idle: string;
    listening: string;
    speaking: string;
  };
  topics: string[];
  agentId: string | null;
  knowledge?: string;
  systemPrompt?: string;
}

interface Room {
  id: string;
  type: string;
  config: {
    characterIds: string[];
  };
  creatorId?: string;
  parentRoomId?: string;
  createdAt: string;
}

interface Customizations {
  components: RoomComponent[];
}

type VideoState = "idle" | "listening" | "speaking";

// Memory types
interface VisitRecord {
  timestamp: number;
  characterId: string;
}

interface ConversationRecord {
  date: string;
  topic: string;
  emotionalState: string;
  steveAdvice?: string;
}

interface Commitment {
  text: string;
  madeOn: string;
  status: "open" | "done" | "abandoned";
  timesReminded: number;
}

interface SteveObservations {
  notes: string[];
  consolidated: string[];
  importantTopics: string[];
}

interface Relationship {
  sessionsCount: number;
  firstMet: string;
  memorableMoments: string[];
}

interface UserMemory {
  visits: VisitRecord[];
  userFacts: Record<string, string>;
  recentConversations: ConversationRecord[];
  commitments: Commitment[];
  steveObservations: SteveObservations;
  relationship: Relationship;
}

function getEmptyMemory(): UserMemory {
  return {
    visits: [],
    userFacts: {},
    recentConversations: [],
    commitments: [],
    steveObservations: {
      notes: [],
      consolidated: [],
      importantTopics: [],
    },
    relationship: {
      sessionsCount: 0,
      firstMet: new Date().toISOString(),
      memorableMoments: [],
    },
  };
}

function loadMemory(characterId: string): UserMemory {
  const key = `steve_memory_${characterId}`;
  const stored = localStorage.getItem(key);
  if (!stored) return getEmptyMemory();
  try {
    return JSON.parse(stored) as UserMemory;
  } catch {
    return getEmptyMemory();
  }
}

function saveMemory(characterId: string, memory: UserMemory): void {
  const key = `steve_memory_${characterId}`;
  localStorage.setItem(key, JSON.stringify(memory));
}

function buildDynamicVariables(memory: UserMemory): Record<string, string> {
  const vars: Record<string, string> = {};

  // Level 1: Visit info
  const lastVisit = memory.visits[memory.visits.length - 1];
  vars.visit_count = String(memory.visits.length + 1);
  vars.time_since_last = formatTimeSince(lastVisit?.timestamp);
  const pattern = analyzeVisitPattern(memory.visits);
  if (pattern) vars.visit_pattern = pattern;

  // Level 2: Last conversation
  const lastConvo = memory.recentConversations[memory.recentConversations.length - 1];
  if (lastConvo) {
    vars.last_topic = lastConvo.topic;
    vars.last_emotional_state = lastConvo.emotionalState;
    if (lastConvo.steveAdvice) vars.last_steve_advice = lastConvo.steveAdvice;
  }

  // Level 3: User facts
  if (Object.keys(memory.userFacts).length > 0) {
    vars.user_facts = Object.entries(memory.userFacts)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  }

  // Level 4: Open commitments
  const openCommitments = memory.commitments.filter((c) => c.status === "open");
  if (openCommitments.length > 0) {
    vars.open_commitments = openCommitments
      .map((c) => `"${c.text}" (reminded ${c.timesReminded}x)`)
      .join("; ");
  }

  // Level 4: Steve's observations
  const recentNotes = memory.steveObservations.notes.slice(-5);
  const consolidated = memory.steveObservations.consolidated.slice(-3);
  const allObservations = [...consolidated, ...recentNotes];
  if (allObservations.length > 0) {
    vars.steve_observations = allObservations.join("; ");
  }

  // Level 5: Relationship
  vars.sessions_count = String(memory.relationship.sessionsCount);
  if (memory.relationship.memorableMoments.length > 0) {
    vars.memorable_moments = memory.relationship.memorableMoments.slice(-3).join("; ");
  }

  // Important topics for proactivity
  if (memory.steveObservations.importantTopics.length > 0) {
    vars.important_topics = memory.steveObservations.importantTopics.join(", ");
  }

  return vars;
}

function formatTimeSince(timestamp: number | undefined): string {
  if (!timestamp) return "first time";

  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
}

function analyzeVisitPattern(visits: VisitRecord[]): string | null {
  if (visits.length < 3) return null;

  const hours = visits.map(v => new Date(v.timestamp).getHours());
  const lateNightCount = hours.filter(h => h >= 22 || h < 5).length;
  const morningCount = hours.filter(h => h >= 5 && h < 12).length;

  if (lateNightCount / visits.length > 0.5) return "night owl - usually shows up late";
  if (morningCount / visits.length > 0.5) return "early bird - usually here in the morning";

  // Check for daily pattern
  const daysBetween = visits.slice(1).map((v, i) =>
    Math.floor((v.timestamp - visits[i].timestamp) / 86400000)
  );
  const avgDays = daysBetween.reduce((a, b) => a + b, 0) / daysBetween.length;
  if (avgDays < 1.5) return "regular - shows up daily";

  return null;
}

export default function LearnRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  // Room data
  const [room, setRoom] = useState<Room | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customizations, setCustomizations] = useState<Customizations | null>(null);

  // UI state
  const [showModal, setShowModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNutzModal, setShowNutzModal] = useState(false);
  const [topic, setTopic] = useState("");
  const [isInCall, setIsInCall] = useState(false);
  const [videoState, setVideoState] = useState<VideoState>("idle");
  const [copied, setCopied] = useState(false);
  const [isRemixing, setIsRemixing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // NUTZ button drag state - start far on the right side
  const [nutzPosition, setNutzPosition] = useState({ x: 350, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const nutzButtonRef = useRef<HTMLButtonElement>(null);

  // NUTZ chat state
  const [nutzMessages, setNutzMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [nutzInput, setNutzInput] = useState("");
  const [isNutzLoading, setIsNutzLoading] = useState(false);
  const nutzChatRef = useRef<HTMLDivElement>(null);
  const nutzModalRef = useRef<HTMLDivElement>(null);

  // Create character form state
  const [createName, setCreateName] = useState("");
  const [createTopics, setCreateTopics] = useState("");
  const [createPhoto, setCreatePhoto] = useState<File | null>(null);
  const [createAudio, setCreateAudio] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Conversation transcript for NUTZ context
  const [conversationTranscript, setConversationTranscript] = useState<
    Array<{ role: "user" | "agent"; text: string; timestamp: number }>
  >([]);

  // Fetch customizations
  const fetchCustomizations = useCallback(async () => {
    try {
      const response = await fetch(`/api/rooms/customizations?id=${roomId}`);
      if (response.ok) {
        const data = await response.json();
        setCustomizations(data.customizations);
      }
    } catch (err) {
      console.error("Failed to fetch customizations:", err);
    }
  }, [roomId]);

  // Fetch room data
  useEffect(() => {
    async function fetchRoom() {
      try {
        const response = await fetch(`/api/rooms?id=${roomId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Room not found");
          } else {
            setError("Failed to load room");
          }
          return;
        }
        const data = await response.json();
        setRoom(data.room);
        setCharacters(data.characters);
        if (data.characters.length > 0) {
          setSelectedCharacter(data.characters[0]);
        }
        // Also fetch customizations
        fetchCustomizations();
      } catch (err) {
        console.error("Failed to fetch room:", err);
        setError("Failed to load room");
      } finally {
        setIsLoading(false);
      }
    }

    if (roomId) {
      fetchRoom();
    }
  }, [roomId, fetchCustomizations]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioFile = new File([audioBlob], "voice-recording.webm", { type: "audio/webm" });
        setCreateAudio(audioFile);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected to ElevenLabs");
      setVideoState("listening");
      // Clear transcript on new conversation
      setConversationTranscript([]);
    },
    onDisconnect: () => {
      console.log("Disconnected from ElevenLabs");
      setIsInCall(false);
      setVideoState("idle");
    },
    onModeChange: ({ mode }) => {
      if (mode === "listening") {
        setVideoState("listening");
      } else if (mode === "speaking") {
        setVideoState("speaking");
      }
    },
    onMessage: (message) => {
      // Capture both user and agent messages
      console.log("ConvAI message:", message);
      if (message.message) {
        setConversationTranscript((prev) => [
          ...prev,
          {
            role: message.source === "user" ? "user" : "agent",
            text: message.message,
            timestamp: Date.now(),
          },
        ]);
      }
    },
    onError: (error) => {
      console.error("Conversation error:", error);
    },
  });

  // Change video when state changes
  useEffect(() => {
    if (videoRef.current && isInCall && selectedCharacter) {
      const newSrc = selectedCharacter.videoSources[videoState];
      const currentSrc = videoRef.current.src;

      if (!currentSrc.endsWith(newSrc)) {
        videoRef.current.src = newSrc;
        videoRef.current.load();
        videoRef.current.play().catch(console.error);
      }
    }
  }, [videoState, selectedCharacter, isInCall]);

  const handleJoinCall = () => {
    if (!selectedCharacter) return;
    if (!selectedCharacter.agentId) {
      alert(`${selectedCharacter.name} is not available yet.`);
      return;
    }
    setShowModal(true);
  };

  const startConversation = useCallback(async () => {
    if (!selectedCharacter?.agentId) return;

    try {
      const response = await fetch(`/api/poc-convai-token?agentId=${selectedCharacter.agentId}`);
      if (!response.ok) {
        throw new Error("Failed to get conversation token");
      }
      const { signedUrl } = await response.json();

      // Load full memory
      const memory = loadMemory(selectedCharacter.id);

      // Build dynamic variables from memory (all levels)
      const dynamicVariables = buildDynamicVariables(memory);

      // Log what we're passing to Steve (for debugging)
      console.log("Memory context for Steve:", dynamicVariables);

      // Start session with full memory context
      await conversation.startSession({
        signedUrl,
        dynamicVariables,
      });

      // Record this visit in memory
      memory.visits.push({
        timestamp: Date.now(),
        characterId: selectedCharacter.id,
      });
      saveMemory(selectedCharacter.id, memory);

      setShowModal(false);
      setIsInCall(true);
    } catch (error) {
      console.error("Failed to start conversation:", error);
    }
  }, [conversation, selectedCharacter]);

  const endConversation = useCallback(async () => {
    // Save transcript before ending session
    const transcript = [...conversationTranscript];

    await conversation.endSession();
    setIsInCall(false);
    setVideoState("idle");

    // Process memory in background (don't block UI)
    if (selectedCharacter && transcript.length > 0) {
      (async () => {
        try {
          const memory = loadMemory(selectedCharacter.id);

          // Call API to extract memory from conversation
          const response = await fetch("/api/memory/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transcript: transcript.map((t) => ({ role: t.role, text: t.text })),
              existingMemory: memory,
              characterName: selectedCharacter.name,
            }),
          });

          if (!response.ok) {
            console.error("Failed to summarize conversation");
            return;
          }

          const { extraction } = await response.json();
          console.log("Memory extraction:", extraction);

          // Update memory with extraction
          // Add conversation summary (keep last 5)
          memory.recentConversations.push({
            date: new Date().toISOString(),
            topic: extraction.topic || "general chat",
            emotionalState: extraction.emotionalState || "neutral",
            steveAdvice: extraction.steveAdvice,
          });
          if (memory.recentConversations.length > 5) {
            memory.recentConversations = memory.recentConversations.slice(-5);
          }

          // Merge new facts
          if (extraction.newFacts) {
            memory.userFacts = { ...memory.userFacts, ...extraction.newFacts };
          }

          // Add new commitments
          if (extraction.newCommitments) {
            for (const text of extraction.newCommitments) {
              memory.commitments.push({
                text,
                madeOn: new Date().toISOString(),
                status: "open",
                timesReminded: 0,
              });
            }
          }

          // Mark completed commitments
          if (extraction.completedCommitments) {
            for (const completed of extraction.completedCommitments) {
              const commitment = memory.commitments.find(
                (c) => c.status === "open" && c.text.toLowerCase().includes(completed.toLowerCase())
              );
              if (commitment) {
                commitment.status = "done";
              }
            }
          }

          // Add observations
          if (extraction.observations) {
            memory.steveObservations.notes.push(...extraction.observations);
            // Keep notes from growing too large (compress every 5 sessions)
            if (memory.steveObservations.notes.length > 15) {
              // Move older notes to consolidated (simplified - full compression would use Claude)
              const toConsolidate = memory.steveObservations.notes.slice(0, -10);
              memory.steveObservations.consolidated.push(...toConsolidate);
              memory.steveObservations.notes = memory.steveObservations.notes.slice(-10);
            }
          }

          // Add important topics
          if (extraction.importantTopics) {
            const existingTopics = new Set(memory.steveObservations.importantTopics);
            for (const topic of extraction.importantTopics) {
              existingTopics.add(topic);
            }
            memory.steveObservations.importantTopics = Array.from(existingTopics);
          }

          // Update relationship
          memory.relationship.sessionsCount += 1;
          if (extraction.memorableMoment) {
            memory.relationship.memorableMoments.push(extraction.memorableMoment);
          }

          // Save updated memory
          saveMemory(selectedCharacter.id, memory);
          console.log("Memory saved:", memory);
        } catch (error) {
          console.error("Failed to process memory:", error);
        }
      })();
    }
  }, [conversation, conversationTranscript, selectedCharacter]);

  const handleTopicClick = (t: string) => {
    setTopic(t);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startConversation();
  };

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemix = async () => {
    if (!room) return;
    setIsRemixing(true);
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: room.type,
          config: room.config,
          parentRoomId: room.id,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to create room");
      }
      const data = await response.json();
      router.push(`/room/learn/${data.room.id}`);
    } catch (error) {
      console.error("Failed to remix:", error);
      alert("Failed to create remix");
    } finally {
      setIsRemixing(false);
      setShowNutzModal(false);
    }
  };

  // NUTZ button drag handlers
  const handleNutzMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (nutzButtonRef.current) {
      const rect = nutzButtonRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left - rect.width / 2,
        y: e.clientY - rect.top - rect.height / 2,
      });
      setIsDragging(true);
      setHasDragged(false);
    }
  };

  const handleNutzMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        setHasDragged(true);
        setNutzPosition({
          x: e.clientX - dragOffset.x - window.innerWidth / 2,
          y: e.clientY - dragOffset.y - window.innerHeight + 60,
        });
      }
    },
    [isDragging, dragOffset]
  );

  const handleNutzMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleNutzClick = () => {
    if (!hasDragged) {
      setShowNutzModal(true);
    }
  };

  const handleNutzChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nutzInput.trim() || isNutzLoading) return;

    const userMessage = nutzInput.trim();
    setNutzInput("");
    setNutzMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsNutzLoading(true);

    try {
      // Build full room context for NUTZ
      const roomContext = {
        roomId,
        roomType: room?.type || "learn",
        character: selectedCharacter ? {
          name: selectedCharacter.name,
          topics: selectedCharacter.topics,
          knowledge: selectedCharacter.knowledge,
        } : null,
        isInCall,
        conversationTranscript: conversationTranscript.map((t) => ({
          speaker: t.role === "agent" ? selectedCharacter?.name || "Agent" : "User",
          text: t.text,
        })),
      };

      const response = await fetch("/api/nutz/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          message: userMessage,
          history: nutzMessages,
          roomContext,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      setNutzMessages((prev) => [...prev, { role: "assistant", content: data.response }]);

      // Refresh customizations if NUTZ made changes
      if (data.edited) {
        fetchCustomizations();
      }

      // Scroll to bottom
      setTimeout(() => {
        nutzChatRef.current?.scrollTo({ top: nutzChatRef.current.scrollHeight, behavior: "smooth" });
      }, 100);
    } catch (error) {
      console.error("NUTZ chat error:", error);
      setNutzMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Try again!" }]);
    } finally {
      setIsNutzLoading(false);
    }
  };

  // Attach global mouse listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleNutzMouseMove);
      window.addEventListener("mouseup", handleNutzMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleNutzMouseMove);
      window.removeEventListener("mouseup", handleNutzMouseUp);
    };
  }, [isDragging, handleNutzMouseMove, handleNutzMouseUp]);

  // Click outside to close NUTZ modal
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showNutzModal &&
        nutzModalRef.current &&
        !nutzModalRef.current.contains(e.target as Node) &&
        nutzButtonRef.current &&
        !nutzButtonRef.current.contains(e.target as Node)
      ) {
        setShowNutzModal(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNutzModal]);

  const handleCreateCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName || !createPhoto || !createAudio) {
      alert("Please provide a name, photo, and audio sample");
      return;
    }

    setIsCreating(true);
    setCreateProgress("Uploading files...");

    try {
      const formData = new FormData();
      formData.append("name", createName);
      formData.append("photo", createPhoto);
      formData.append("audio", createAudio);
      formData.append("topics", createTopics);

      setCreateProgress("Creating character (this may take 1-2 minutes)...");

      const response = await fetch("/api/characters", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || "Failed to create character");
      }

      const data = await response.json();
      console.log("Character created:", data.character);

      // Add new character to list and select it
      setCharacters((prev) => [...prev, data.character]);
      setSelectedCharacter(data.character);

      // Reset form and close modal
      setCreateName("");
      setCreateTopics("");
      setCreatePhoto(null);
      setCreateAudio(null);
      setShowCreateModal(false);
      setCreateProgress("");
    } catch (error) {
      console.error("Failed to create character:", error);
      alert(`Failed to create character: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsCreating(false);
    }
  };

  const isVideo = selectedCharacter?.background.endsWith(".mp4");

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading room...</div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="text-white text-xl">{error || "Room not found"}</div>
        <a href="/" className="text-white/60 hover:text-white underline">
          Go home
        </a>
      </div>
    );
  }

  if (!selectedCharacter) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-white">No characters in this room</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Full-screen background */}
      {isVideo ? (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          src={
            isInCall
              ? selectedCharacter.videoSources[videoState]
              : selectedCharacter.background
          }
        />
      ) : (
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center"
          style={{ backgroundImage: `url(${selectedCharacter.background})` }}
        />
      )}

      {/* Gradient overlays - top and bottom */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-black/80 to-transparent" />

      {/* Dynamic components from NUTZ */}
      {customizations?.components && customizations.components.length > 0 && (
        <div className="absolute inset-0 z-30 pointer-events-none">
          <DynamicComponentRenderer components={customizations.components} />
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-5 z-40">
        {/* Back button and room name */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/world")}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-white/80 text-sm">Learn Room</span>
        </div>

        {/* Share button - glass icon */}
        <button
          onClick={copyLink}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            copied
              ? "bg-green-500 text-white"
              : "bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white"
          }`}
        >
          {copied ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          )}
        </button>
      </div>

      {/* In-call status indicator */}
      {isInCall && (
        <div className="absolute top-20 left-6 flex items-center gap-3 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2">
          <div
            className={`w-3 h-3 rounded-full ${
              videoState === "listening"
                ? "bg-green-500 animate-pulse"
                : videoState === "speaking"
                  ? "bg-blue-500 animate-pulse"
                  : "bg-gray-500"
            }`}
          />
          <span className="text-white text-sm">
            {videoState === "listening"
              ? "Listening..."
              : videoState === "speaking"
                ? "Speaking..."
                : "Connected"}
          </span>
        </div>
      )}

      {/* Character name */}
      <div className="absolute bottom-44 left-1/2 -translate-x-1/2">
        <span className="text-white/80 text-lg">{selectedCharacter.name}</span>
      </div>

      {/* Avatar selector */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-3">
        {/* Add button */}
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={isInCall}
          className={`w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center hover:bg-white/20 transition-colors ${
            isInCall ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>

        {/* Character avatars */}
        {characters.map((char) => (
          <button
            key={char.id}
            onClick={() => !isInCall && setSelectedCharacter(char)}
            className={`relative flex flex-col items-center transition-all ${
              isInCall ? "opacity-50 cursor-not-allowed" : ""
            }`}
            disabled={isInCall}
          >
            <div
              className={`w-14 h-14 rounded-full overflow-hidden transition-all ${
                selectedCharacter.id === char.id
                  ? "ring-2 ring-white ring-offset-2 ring-offset-black scale-110"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              <img
                src={char.avatar}
                alt={char.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  const parent = img.parentElement;
                  if (parent) {
                    img.style.display = "none";
                    parent.style.background = "#4B5563";
                    parent.style.display = "flex";
                    parent.style.alignItems = "center";
                    parent.style.justifyContent = "center";
                    const initials = char.name.split(" ").map((n) => n[0]).join("");
                    const span = document.createElement("span");
                    span.className = "text-white text-lg font-semibold";
                    span.textContent = initials;
                    parent.appendChild(span);
                  }
                }}
              />
            </div>
            <span
              className={`mt-1 text-xs ${
                selectedCharacter.id === char.id ? "text-white" : "text-white/60"
              }`}
            >
              {char.name.split(" ")[0]}
            </span>
          </button>
        ))}
      </div>

      {/* Join/End call button */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        {isInCall ? (
          <button
            onClick={endConversation}
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-medium transition-colors"
          >
            End call
          </button>
        ) : (
          <button
            onClick={handleJoinCall}
            className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-8 py-3 rounded-full font-medium transition-colors border border-white/30"
          >
            Join the call
          </button>
        )}
      </div>

      {/* Draggable NUTZ button */}
      <button
        ref={nutzButtonRef}
        onMouseDown={handleNutzMouseDown}
        onClick={handleNutzClick}
        className={`absolute z-40 transition-transform ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{
          left: `calc(50% + ${nutzPosition.x}px)`,
          bottom: `calc(60px + ${-nutzPosition.y}px)`,
          // Scale up dramatically as it moves left (x becomes more negative)
          // At x=350 (start), scale=1. At x=0 (center), scale~1.5. At x=-350 (far left), scale~3.5.
          transform: `translateX(-50%) scale(${1 + Math.max(0, 350 - nutzPosition.x) / 140})`,
        }}
        title="NUTZ - Remix this room"
      >
        <img
          src="/nutz-button.png"
          alt="NUTZ"
          className="w-16 h-16 object-contain drop-shadow-lg"
          draggable={false}
        />
      </button>

      {/* Pre-call modal */}
      {showModal && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <h2 className="text-2xl font-semibold text-gray-900 text-center mb-2">
              Ask anything
            </h2>
            <p className="text-gray-500 text-center mb-6">
              What do you want to learn from {selectedCharacter.name}?
            </p>

            {/* Topic chips */}
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {selectedCharacter.topics.map((t) => (
                <button
                  key={t}
                  onClick={() => handleTopicClick(t)}
                  className={`px-4 py-2 rounded-full text-sm transition-colors ${
                    topic === t
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="relative">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Teach me about..."
                className="w-full bg-gray-100 rounded-full px-5 py-3 pr-12 outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors"
              >
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                  />
                </svg>
              </button>
            </form>

            <button
              onClick={() => setShowModal(false)}
              className="mt-4 w-full text-gray-500 hover:text-gray-700 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Create Character Modal */}
      {showCreateModal && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-semibold text-gray-900 text-center mb-2">
              Create Character
            </h2>
            <p className="text-gray-500 text-center mb-6">
              Upload a photo and voice sample to create a new AI mentor
            </p>

            <form onSubmit={handleCreateCharacter} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g., Albert Einstein"
                  className="w-full bg-gray-100 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  required
                  disabled={isCreating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Topics (comma-separated)</label>
                <input
                  type="text"
                  value={createTopics}
                  onChange={(e) => setCreateTopics(e.target.value)}
                  placeholder="e.g., Physics, Relativity"
                  className="w-full bg-gray-100 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  disabled={isCreating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Photo</label>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCreatePhoto(e.target.files?.[0] || null)}
                  className="hidden"
                  disabled={isCreating}
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isCreating}
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-gray-300 transition-colors"
                >
                  {createPhoto ? (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700">{createPhoto.name}</span>
                    </div>
                  ) : (
                    <div className="text-gray-500">Click to upload photo</div>
                  )}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Voice Sample</label>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setCreateAudio(e.target.files?.[0] || null)}
                  className="hidden"
                  disabled={isCreating || isRecording}
                />

                {createAudio && !isRecording ? (
                  <div className="border-2 border-green-200 bg-green-50 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 text-sm">{createAudio.name}</span>
                      <button type="button" onClick={() => setCreateAudio(null)} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : isRecording ? (
                  <div className="border-2 border-red-300 bg-red-50 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-red-700 font-medium">Recording: {formatTime(recordingTime)}</span>
                      <button type="button" onClick={stopRecording} className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm">
                        Stop
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => audioInputRef.current?.click()}
                      disabled={isCreating}
                      className="flex-1 border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-gray-300"
                    >
                      Upload
                    </button>
                    <button
                      type="button"
                      onClick={startRecording}
                      disabled={isCreating}
                      className="flex-1 border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-red-300"
                    >
                      Record
                    </button>
                  </div>
                )}
              </div>

              {isCreating && createProgress && (
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <span className="text-blue-700 text-sm">{createProgress}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isCreating || !createName || !createPhoto || !createAudio}
                className="w-full bg-gray-900 text-white py-3 rounded-full font-medium hover:bg-gray-800 disabled:bg-gray-300"
              >
                {isCreating ? "Creating..." : "Create Character"}
              </button>

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={isCreating}
                className="w-full text-gray-500 hover:text-gray-700 text-sm"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* NUTZ Chat Modal - attached to button */}
      {showNutzModal && (
        <div
          ref={nutzModalRef}
          className="absolute z-50 w-80"
          style={{
            left: `calc(50% + ${nutzPosition.x}px)`,
            bottom: `calc(140px + ${-nutzPosition.y}px)`,
            transform: "translateX(-50%)",
          }}
        >
          {/* Glass morphic chat container */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <img src="/nutz-button.png" alt="NUTZ" className="w-6 h-6 object-contain" />
                <span className="text-white text-sm font-medium">Go NUTZ</span>
              </div>
              <button
                onClick={() => setShowNutzModal(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div
              ref={nutzChatRef}
              className="h-64 overflow-y-auto p-3 space-y-3"
            >
              {nutzMessages.length === 0 && (
                <div className="text-white/40 text-sm text-center py-8">
                  Ask me to modify this room!
                  <br />
                  <span className="text-xs">e.g. "Add a leaderboard" or "Change the background"</span>
                </div>
              )}
              {nutzMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                      msg.role === "user"
                        ? "bg-white text-gray-900 rounded-br-sm"
                        : "bg-white/20 text-white rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isNutzLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/20 text-white px-3 py-2 rounded-2xl rounded-bl-sm text-sm">
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleNutzChat} className="p-3 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nutzInput}
                  onChange={(e) => setNutzInput(e.target.value)}
                  placeholder="What do you want to change?"
                  className="flex-1 bg-white/10 text-white placeholder-white/40 px-4 py-2 rounded-full text-sm outline-none focus:ring-1 focus:ring-white/30 border border-white/10"
                  disabled={isNutzLoading}
                />
                <button
                  type="submit"
                  disabled={isNutzLoading || !nutzInput.trim()}
                  className="w-9 h-9 bg-white rounded-full flex items-center justify-center hover:bg-white/90 disabled:bg-white/30 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </button>
              </div>
            </form>
          </div>

          {/* Arrow pointing to button */}
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-4 h-4 bg-white/10 backdrop-blur-xl border-r border-b border-white/20 rotate-45"
          />
        </div>
      )}
    </div>
  );
}
