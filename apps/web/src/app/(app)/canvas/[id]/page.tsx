"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useCanvasState } from "@/hooks/canvas/useCanvasState";
import { useAuthState } from "@/hooks/canvas/useAuthState";
import { useOneThing } from "@/hooks/canvas/useOneThing";
import {
  ChatPanel,
  CanvasArea,
  ControlBar,
  Background,
  PopupModal,
  StoryPlayer,
  OneThingModal,
  OneThingOverlay,
} from "@/components/canvas";
import { OnboardingModal } from "@/components/onboarding";
import type {
  Message,
  SceneElement,
  AttachedCapability,
  CreatedRoom,
  BuildingRoom,
  Popup,
  SpotifyContext,
} from "@/components/canvas/types";

// SpeechRecognition types for browser API
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export default function CanvasPage() {
  const router = useRouter();
  const params = useParams();
  const canvasId = params.id as string;

  // Popup state (needs to be here for auth hook)
  const [popup, setPopup] = useState<Popup | null>(null);
  const [lastClickedElement, setLastClickedElement] = useState<{ element: SceneElement; position: { x: number; y: number } } | null>(null);

  // Canvas state hook
  const {
    elements,
    setElements,
    background,
    capabilities,
    setCapabilities,
    generatingElements,
    setGeneratingElements,
    setGenerationStatus,
    isBackgroundGenerating,
    processActions,
  } = useCanvasState({ canvasId });

  // Auth state hook
  const {
    spotifyAuth,
    spotifyTrack,
    isSpotifyConnecting,
    connectSpotify,
    fetchNowPlaying,
    controlSpotify,
    googleAuth,
    isGoogleConnecting,
    connectGoogle,
  } = useAuthState({ setPopup });

  // Chat state
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Helper mode state
  const [isHelperMode, setIsHelperMode] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Story mode state
  const [isStoryMode, setIsStoryMode] = useState(false);

  // Onboarding modal state
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // One Thing (todo) mode state
  const [isOneThingMode, setIsOneThingMode] = useState(false);
  const [oneThingPosition, setOneThingPosition] = useState<{ x: number; y: number } | null>(null);
  const {
    todos: oneThingTodos,
    addTodo: addOneThingTodo,
    toggleTodo: toggleOneThingTodo,
    removeTodo: removeOneThingTodo,
    clearCompleted: clearOneThingCompleted,
    firstPendingTodo,
    pendingCount,
  } = useOneThing();

  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Clarification state
  const [pendingClarification, setPendingClarification] = useState<{
    originalPrompt: string;
    targetElementId: string;
    targetContent: string;
  } | null>(null);

  // Rooms state
  const [createdRooms, setCreatedRooms] = useState<CreatedRoom[]>([]);
  const [buildingRooms, setBuildingRooms] = useState<BuildingRoom[]>([]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const windowWithSpeech = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionInstance;
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
      };
      const SpeechRecognitionClass = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0].transcript)
            .join("");
          setInput(transcript);
        };

        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInput("");
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  // ESC key to close helper mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isHelperMode) {
        setIsHelperMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHelperMode]);

  // Load created rooms from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("nutz_created_rooms");
    if (stored) {
      try {
        setCreatedRooms(JSON.parse(stored) as CreatedRoom[]);
      } catch {
        localStorage.removeItem("nutz_created_rooms");
      }
    }
  }, []);

  // Clear building rooms on mount
  useEffect(() => {
    localStorage.removeItem("nutz_building_rooms");
    setBuildingRooms([]);
  }, []);

  // Room management callbacks
  const addCreatedRoom = useCallback((room: CreatedRoom) => {
    setCreatedRooms(prev => {
      const filtered = prev.filter(r => r.url !== room.url);
      const updated = [room, ...filtered].slice(0, 5);
      localStorage.setItem("nutz_created_rooms", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeCreatedRoom = useCallback((url: string) => {
    setCreatedRooms(prev => {
      const updated = prev.filter(r => r.url !== url);
      localStorage.setItem("nutz_created_rooms", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Listen for room creation events
  useEffect(() => {
    const handleRoomCreated = (event: CustomEvent<CreatedRoom>) => {
      addCreatedRoom(event.detail);
      setBuildingRooms(prev => {
        const updated = prev.filter(r => r.prompt !== event.detail.title);
        localStorage.setItem("nutz_building_rooms", JSON.stringify(updated));
        return updated;
      });
    };

    const handleRoomBuilding = (event: CustomEvent<BuildingRoom>) => {
      setBuildingRooms(prev => {
        const existing = prev.find(r => r.id === event.detail.id);
        const updated = existing
          ? prev.map(r => r.id === event.detail.id ? event.detail : r)
          : [...prev, event.detail];
        localStorage.setItem("nutz_building_rooms", JSON.stringify(updated));
        return updated;
      });
    };

    const handleRoomBuildingComplete = (event: CustomEvent<{ id: string }>) => {
      setBuildingRooms(prev => {
        const updated = prev.filter(r => r.id !== event.detail.id);
        localStorage.setItem("nutz_building_rooms", JSON.stringify(updated));
        return updated;
      });
    };

    window.addEventListener("room-created" as keyof WindowEventMap, handleRoomCreated as EventListener);
    window.addEventListener("room-building" as keyof WindowEventMap, handleRoomBuilding as EventListener);
    window.addEventListener("room-building-complete" as keyof WindowEventMap, handleRoomBuildingComplete as EventListener);
    return () => {
      window.removeEventListener("room-created" as keyof WindowEventMap, handleRoomCreated as EventListener);
      window.removeEventListener("room-building" as keyof WindowEventMap, handleRoomBuilding as EventListener);
      window.removeEventListener("room-building-complete" as keyof WindowEventMap, handleRoomBuildingComplete as EventListener);
    };
  }, [addCreatedRoom]);

  // Initial greeting
  useEffect(() => {
    if (!hasStarted) {
      setHasStarted(true);
      setMessages([
        {
          role: "assistant",
          content: "This is your space. Tell me what you want to see and I'll create it. Try anything - \"add a mushroom\", \"fill the sky with stars\", \"write hello in purple\"...",
        },
      ]);
    }
  }, [hasStarted]);

  // Food-related keywords for showing eat out / cook options
  const foodKeywords = ["pizza", "burger", "sushi", "taco", "pasta", "salad", "sandwich", "steak", "chicken", "fish", "curry", "ramen", "pho", "soup", "bread", "cake", "ice cream", "donut", "cookie", "pie", "food", "meal", "dish"];

  const isFoodElement = useCallback((description: string) => {
    const lower = description.toLowerCase();
    return foodKeywords.some(keyword => lower.includes(keyword));
  }, []);

  // Check if element is the help button (pink tilted element)
  const isHelpButton = useCallback((element: SceneElement) => {
    const desc = (element.description || element.content).toLowerCase();
    // Check for common help button indicators
    return desc.includes("help") || desc.includes("?") || desc.includes("assistant") || desc.includes("helper");
  }, []);

  // Check if element is the story button
  const isStoryButton = useCallback((element: SceneElement) => {
    const desc = (element.description || element.content).toLowerCase();
    return desc.includes("story") || desc.includes("book") || desc.includes("tale") || desc.includes("narrative");
  }, []);

  // Check if element is the ONE THING todo button
  const isOneThingButton = useCallback((element: SceneElement) => {
    const desc = (element.description || element.content).toLowerCase();
    return desc.includes("one thing") || desc.includes("onething") || desc.includes("todo") || desc.includes("goals") || desc.includes("☝️");
  }, []);

  // Trigger AI reaction for element click
  const triggerAIReaction = useCallback(async (element: SceneElement, clickPosition: { x: number; y: number }, action?: string) => {
    const description = element.description || element.content;

    // Store for regeneration
    setLastClickedElement({ element, position: clickPosition });

    // Check if this is the help button - activate helper mode
    if (isHelpButton(element)) {
      setIsHelperMode(true);
      // Focus the chat input after a short delay
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 100);
      return;
    }

    // Check if this is the story button - activate story mode
    if (isStoryButton(element)) {
      setIsStoryMode(true);
      return;
    }

    // Check if this is the ONE THING button - activate todo mode
    if (isOneThingButton(element)) {
      setOneThingPosition(clickPosition);
      setIsOneThingMode(true);
      return;
    }

    // If it's a food item and no action specified yet, show options first
    if (isFoodElement(description) && !action) {
      setPopup({
        type: "options",
        content: "",
        elementDescription: description,
        position: clickPosition,
        options: [
          { label: "Eat out", icon: "🍽️", action: "eat_out" },
          { label: "Cook at home", icon: "👨‍🍳", action: "cook" },
        ],
      });
      return;
    }

    // Show loading popup near the element
    setPopup({
      type: "ai-response",
      content: "",
      isLoading: true,
      elementDescription: description,
      position: clickPosition,
    });

    // Build the prompt based on the action
    let promptContext = "";
    if (action === "eat_out") {
      promptContext = "The user wants to EAT OUT. Give restaurant recommendations near their location for this food. Include 2-3 specific restaurant types or chains that serve this well. Keep it short and actionable.";
    } else if (action === "cook") {
      promptContext = "The user wants to COOK this at home. Give a quick, simple recipe with ingredients and steps. Keep it concise - 5 ingredients max, 5 steps max.";
    }

    try {
      const response = await fetch("/api/canvas/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elementDescription: description,
          elementType: element.type,
          promptContext,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setPopup({
          type: "ai-response",
          content: data.response,
          isLoading: false,
          elementDescription: description,
          position: clickPosition,
        });
      } else {
        setPopup(null);
      }
    } catch (error) {
      console.error("AI reaction error:", error);
      setPopup(null);
    }
  }, [isFoodElement, isHelpButton, isStoryButton, isOneThingButton]);

  // Handle option selection from popup
  const handleOptionSelect = useCallback((action: string) => {
    if (lastClickedElement) {
      triggerAIReaction(lastClickedElement.element, lastClickedElement.position, action);
    }
  }, [lastClickedElement, triggerAIReaction]);

  // Execute capability code safely (or trigger AI reaction if no capability)
  const executeCapability = useCallback((elementId: string, trigger: AttachedCapability["trigger"], event?: React.MouseEvent) => {
    const element = elements.find((el) => el.id === elementId);
    if (!element) return;

    const cap = capabilities.find((c) => c.elementId === elementId && c.trigger === trigger);

    // If no capability attached, trigger AI reaction on click
    if (!cap) {
      if (trigger === "click" && event) {
        // Get click position for popup placement
        const clickPosition = {
          x: event.clientX - 144, // Center popup (288px / 2)
          y: event.clientY,
        };
        triggerAIReaction(element, clickPosition);
      }
      return;
    }

    const spotifyContext: SpotifyContext = {
      isConnected: !!spotifyAuth,
      track: spotifyTrack,
      connect: connectSpotify,
      fetchNowPlaying: spotifyAuth ? () => fetchNowPlaying(spotifyAuth.accessToken) : null,
      control: controlSpotify,
    };

    try {
      let cleanCode = cap.code;
      cleanCode = cleanCode.replace(/^```(?:javascript|js)?\s*\n?/i, '');
      cleanCode = cleanCode.replace(/\n?```\s*$/i, '');
      cleanCode = cleanCode.trim();

      const stableSetElements: typeof setElements = (update) => {
        const currentSetElements = (window as unknown as { __canvasSetElements: typeof setElements }).__canvasSetElements;
        if (currentSetElements) {
          currentSetElements(update);
        }
      };

      const fn = new Function(
        "element",
        "elements",
        "setElements",
        "event",
        "setPopup",
        "spotify",
        cleanCode
      );
      fn(element, elements, stableSetElements, event, setPopup, spotifyContext);
    } catch (error) {
      console.error("Capability execution error:", error);
    }
  }, [capabilities, elements, spotifyAuth, spotifyTrack, connectSpotify, fetchNowPlaying, controlSpotify, setElements, triggerAIReaction]);

  // Save room
  const saveRoom = useCallback(async (roomName: string) => {
    try {
      await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "generated",
          config: {
            prompt: roomName,
            elements: elements,
            status: "ready",
          },
        }),
      });

      localStorage.setItem("nutz_onboarded", "true");
      window.dispatchEvent(new Event("room-created"));
      router.push("/world");
    } catch (error) {
      console.error("Failed to save room:", error);
    }
  }, [elements, router]);

  // Stream capability generation with progress updates
  const generateCapabilityWithProgress = useCallback(async (
    prompt: string,
    targetElementId: string,
    targetContent: string,
    currentElements: SceneElement[],
    conversationHistory: Message[],
    planningResponse?: string
  ) => {
    setGeneratingElements((prev) => new Set([...prev, targetElementId]));
    setGenerationStatus((prev) => new Map(prev).set(targetElementId, "Starting..."));

    try {
      const response = await fetch("/api/canvas/generate-capability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          elementInfo: { id: targetElementId, content: targetContent },
          targetElement: targetContent,
          canvasElements: currentElements,
          conversationHistory: conversationHistory,
          planningResponse,
        }),
      });

      if (!response.ok) throw new Error("Failed to start generation");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.event === "status") {
                setGenerationStatus((prev) =>
                  new Map(prev).set(targetElementId, parsed.message)
                );
              } else if (parsed.event === "needs_clarification") {
                const questions = parsed.questions as string[];
                const context = parsed.context as string | undefined;

                setGeneratingElements((prev) => {
                  const next = new Set(prev);
                  next.delete(targetElementId);
                  return next;
                });
                setGenerationStatus((prev) => {
                  const next = new Map(prev);
                  next.delete(targetElementId);
                  return next;
                });

                const questionText = context
                  ? `${context}\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
                  : questions.join("\n");

                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: `🤔 ${questionText}` },
                ]);

                return { needsClarification: true, questions, targetElementId, targetContent };
              } else if (parsed.event === "complete" && parsed.capability) {
                setCapabilities((caps) => [
                  ...caps,
                  {
                    elementId: targetElementId,
                    trigger: parsed.capability.trigger || "click",
                    code: parsed.capability.code,
                  },
                ]);

                setGeneratingElements((prev) => {
                  const next = new Set(prev);
                  next.delete(targetElementId);
                  return next;
                });
                setGenerationStatus((prev) => {
                  const next = new Map(prev);
                  next.delete(targetElementId);
                  return next;
                });

                return parsed.capability;
              } else if (parsed.event === "error") {
                throw new Error(parsed.message);
              }
            } catch {
              // Not valid JSON, skip
            }
          }
        }
      }
    } catch (error) {
      console.error("Capability generation error:", error);
      setGeneratingElements((prev) => {
        const next = new Set(prev);
        next.delete(targetElementId);
        return next;
      });
      setGenerationStatus((prev) => {
        const next = new Map(prev);
        next.delete(targetElementId);
        return next;
      });
      throw error;
    }
  }, [setCapabilities, setGeneratingElements, setGenerationStatus]);

  // Handle form submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setIsLoading(true);

    // Check if user is answering a clarification question
    if (pendingClarification) {
      const { originalPrompt, targetElementId, targetContent } = pendingClarification;
      setPendingClarification(null);

      generateCapabilityWithProgress(
        originalPrompt,
        targetElementId,
        targetContent,
        elements,
        [...messages, { role: "user", content: userMessage }],
        userMessage
      )
        .then((result) => {
          if (result && !("needsClarification" in result)) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: "✨ Done! Click it to try!" },
            ]);
          } else if (result && "needsClarification" in result) {
            setPendingClarification({
              originalPrompt,
              targetElementId,
              targetContent,
            });
          }
        })
        .catch((err) => {
          console.error("Capability generation failed:", err);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Something went wrong. Try again?" },
          ]);
        });

      setIsLoading(false);
      return;
    }

    // Detect if requesting interactive capability
    const capabilityKeywords = [
      "game", "interactive", "click", "tracker", "app", "when i click",
      "when you click", "counter", "list", "workout", "timer", "clicker"
    ];
    const isRequestingCapability = capabilityKeywords.some((kw) =>
      userMessage.toLowerCase().includes(kw)
    ) && elements.length > 0;

    // Show loading bar on any element that's referenced in the message
    const msgLower = userMessage.toLowerCase();
    const imageElements = elements.filter(el => el.type === "image");

    // Find element that's mentioned by name/description
    const referencedElement = imageElements.find(el =>
      el.description && msgLower.includes(el.description.toLowerCase())
    );

    if (referencedElement) {
      // Message mentions a specific element - show loading on it
      setGeneratingElements(new Set([referencedElement.id]));
    } else if (elements.length > 0) {
      // Check for keywords that imply working on existing elements
      const editKeywords = ["give it", "give the", "make it", "make the", "change it", "change the", "edit", "modify", "turn it", "turn the", "to it", "on it"];
      const isEditingLast = editKeywords.some((kw) => msgLower.includes(kw));

      if (isEditingLast) {
        const lastImage = [...elements].reverse().find(el => el.type === "image");
        if (lastImage) {
          setGeneratingElements(new Set([lastImage.id]));
        }
      }
    }

    if (isRequestingCapability) {
      const lastElement = elements[elements.length - 1];

      generateCapabilityWithProgress(
        userMessage,
        lastElement.id,
        lastElement.content,
        elements,
        messages
      )
        .then((result) => {
          if (result && !("needsClarification" in result)) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: "✨ Done! Click it to try!" },
            ]);
          } else if (result && "needsClarification" in result) {
            setPendingClarification({
              originalPrompt: userMessage,
              targetElementId: lastElement.id,
              targetContent: lastElement.content,
            });
          }
        })
        .catch((err) => {
          console.error("Background capability generation failed:", err);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Generation failed. Try again?" },
          ]);
        });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Working on it! You can keep chatting while I build this..." },
      ]);
      setIsLoading(false);
      return;
    }

    // Standard flow
    try {
      const response = await fetch("/api/canvas/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          history: messages,
          currentElements: elements,
          googleAccessToken: googleAuth?.accessToken,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.actions && data.actions.length > 0) {
          processActions(data.actions);

          // Handle finish action
          const finishAction = data.actions.find((a: { type: string }) => a.type === "finish");
          if (finishAction) {
            setTimeout(() => saveRoom(finishAction.data.roomName), 1000);
          }
        }

        if (data.response) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.response },
          ]);
        }

        // Clear any remaining generating state as safety net
        setGeneratingElements(new Set());
      }
    } catch (error) {
      console.error("Failed to process:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Try again?" },
      ]);
      setGeneratingElements(new Set());
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, pendingClarification, elements, messages, googleAuth, generateCapabilityWithProgress, processActions, saveRoom, setGeneratingElements]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-mono overflow-hidden">
      <Background
        background={background}
        isBackgroundGenerating={isBackgroundGenerating}
      />

      <ControlBar
        spotifyAuth={spotifyAuth}
        spotifyTrack={spotifyTrack}
        isSpotifyConnecting={isSpotifyConnecting}
        onConnectSpotify={connectSpotify}
        onFetchNowPlaying={() => spotifyAuth && fetchNowPlaying(spotifyAuth.accessToken)}
        googleAuth={googleAuth}
        isGoogleConnecting={isGoogleConnecting}
        onConnectGoogle={connectGoogle}
        createdRooms={createdRooms}
        buildingRooms={buildingRooms}
        onRemoveCreatedRoom={removeCreatedRoom}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
      />

      <CanvasArea
        elements={elements}
        setElements={setElements}
        generatingElements={generatingElements}
        onExecuteCapability={executeCapability}
      />

      <PopupModal
        popup={popup}
        onClose={() => setPopup(null)}
        onRegenerate={lastClickedElement ? () => triggerAIReaction(lastClickedElement.element, lastClickedElement.position) : undefined}
        onSelectOption={handleOptionSelect}
      />

      <ChatPanel
        messages={messages}
        input={input}
        setInput={setInput}
        isLoading={isLoading}
        isListening={isListening}
        onSubmit={handleSubmit}
        onToggleListening={toggleListening}
        isHelperMode={isHelperMode}
        onCloseHelper={() => setIsHelperMode(false)}
        inputRef={chatInputRef}
      />

      <StoryPlayer
        isOpen={isStoryMode}
        onClose={() => setIsStoryMode(false)}
      />

      <OneThingModal
        isOpen={isOneThingMode}
        onClose={() => {
          setIsOneThingMode(false);
          setOneThingPosition(null);
        }}
        position={oneThingPosition ?? undefined}
        todos={oneThingTodos}
        onAddTodo={addOneThingTodo}
        onToggleTodo={toggleOneThingTodo}
        onRemoveTodo={removeOneThingTodo}
        onClearCompleted={clearOneThingCompleted}
      />

      <OneThingOverlay
        elements={elements}
        firstPendingTodo={firstPendingTodo}
        pendingCount={pendingCount}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />
    </div>
  );
}
