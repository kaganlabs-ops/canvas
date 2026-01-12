"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SpotifyAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface SpotifyTrack {
  name: string;
  artist: string;
  album: string;
  albumArt?: string;
  uri: string;
  externalUrl: string;
}

interface ClickAction {
  type: "showImage" | "showText" | "playSound" | "navigate" | "addElements" | "removeThis" | "transform";
  payload?: string;
}

interface SceneElement {
  id: string;
  type: "emoji" | "text" | "shape" | "image";
  content: string;
  position: { x: number; y: number };
  size: number;
  color: string;
  animation?: "float" | "pulse" | "spin" | "bounce" | "none";
  rotation?: number;
  opacity?: number;
  draggable?: boolean;
  clickAction?: ClickAction | null;
}

interface SceneAction {
  type: "add" | "remove" | "modify" | "duplicate" | "finish" | "attachCapability" | "replaceWithImage" | "startGenerating" | "stopGenerating" | "modifyBackground";
  data: Record<string, unknown>;
}

interface BackgroundConfig {
  type: "grid" | "dots" | "none" | "image";
  color: string;
  secondaryColor?: string;
  size: number;
  opacity: number;
  imageUrl?: string;
}

interface AttachedCapability {
  elementId: string;
  trigger: "click" | "hover" | "load" | "interval" | "drag";
  code: string;
}

export default function CanvasPage() {
  const router = useRouter();
  const params = useParams();
  const canvasId = params.id as string;
  const storageKey = `nutz_canvas_${canvasId}`;

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [elements, setElements] = useState<SceneElement[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [draggedElement, setDraggedElement] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [popup, setPopup] = useState<{ type: "text" | "image"; content: string } | null>(null);
  const [capabilities, setCapabilities] = useState<AttachedCapability[]>([]);
  const [generatingElements, setGeneratingElements] = useState<Set<string>>(new Set());
  const [didDrag, setDidDrag] = useState(false);
  const [background, setBackground] = useState<BackgroundConfig>({
    type: "grid",
    color: "#33ff00",
    size: 40,
    opacity: 0.05,
  });
  const [isBackgroundGenerating, setIsBackgroundGenerating] = useState(false);
  const [spotifyAuth, setSpotifyAuth] = useState<SpotifyAuth | null>(null);
  const [spotifyTrack, setSpotifyTrack] = useState<SpotifyTrack | null>(null);
  const [isSpotifyConnecting, setIsSpotifyConnecting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load canvas state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const state = JSON.parse(stored);
        if (state.elements) setElements(state.elements);
        if (state.background) setBackground(state.background);
        if (state.capabilities) setCapabilities(state.capabilities);
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
    setIsLoaded(true);
  }, [storageKey]);

  // Save canvas state to localStorage (debounced)
  useEffect(() => {
    if (!isLoaded) return; // Don't save until we've loaded first

    const timeout = setTimeout(() => {
      const hasContent = elements.length > 0 || capabilities.length > 0 || background.type !== "grid";
      if (hasContent) {
        const state = {
          elements,
          background,
          capabilities,
          savedAt: Date.now(),
        };
        localStorage.setItem(storageKey, JSON.stringify(state));
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [elements, background, capabilities, storageKey, isLoaded]);

  // Load Spotify auth from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("spotify_auth");
    if (stored) {
      try {
        const auth = JSON.parse(stored) as SpotifyAuth;
        if (auth.expiresAt > Date.now()) {
          setSpotifyAuth(auth);
        } else {
          // Token expired, try to refresh
          refreshSpotifyToken(auth.refreshToken);
        }
      } catch {
        localStorage.removeItem("spotify_auth");
      }
    }
  }, []);

  // Handle Spotify OAuth callback (tokens in URL hash)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    if (hash.includes("spotify_access_token")) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("spotify_access_token");
      const refreshToken = params.get("spotify_refresh_token");
      const expiresIn = params.get("spotify_expires_in");

      if (accessToken && refreshToken && expiresIn) {
        const auth: SpotifyAuth = {
          accessToken,
          refreshToken,
          expiresAt: Date.now() + parseInt(expiresIn) * 1000,
        };
        setSpotifyAuth(auth);
        localStorage.setItem("spotify_auth", JSON.stringify(auth));

        // Clear hash from URL
        window.history.replaceState(null, "", window.location.pathname);

        // Fetch now playing
        fetchNowPlaying(accessToken);
      }
    }

    // Check for errors
    const error = searchParams.get("spotify_error");
    if (error) {
      console.error("Spotify auth error:", error);
    }
  }, [searchParams]);

  const refreshSpotifyToken = async (refreshToken: string) => {
    try {
      const response = await fetch("/api/spotify/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        const auth: SpotifyAuth = {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: Date.now() + data.expiresIn * 1000,
        };
        setSpotifyAuth(auth);
        localStorage.setItem("spotify_auth", JSON.stringify(auth));
      } else {
        localStorage.removeItem("spotify_auth");
        setSpotifyAuth(null);
      }
    } catch (err) {
      console.error("Failed to refresh Spotify token:", err);
      localStorage.removeItem("spotify_auth");
      setSpotifyAuth(null);
    }
  };

  const fetchNowPlaying = useCallback(async (token: string) => {
    try {
      const response = await fetch("/api/spotify/now-playing", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.track) {
          setSpotifyTrack(data.track);
        }
      } else if (response.status === 401) {
        // Token expired, try refresh
        const stored = localStorage.getItem("spotify_auth");
        if (stored) {
          const auth = JSON.parse(stored) as SpotifyAuth;
          await refreshSpotifyToken(auth.refreshToken);
        }
      }
    } catch (err) {
      console.error("Failed to fetch now playing:", err);
    }
  }, []);

  const connectSpotify = async () => {
    setIsSpotifyConnecting(true);
    try {
      const response = await fetch("/api/spotify/auth");
      const data = await response.json();

      if (!response.ok) {
        console.error("Spotify auth error:", data.error);
        setPopup({ type: "text", content: data.error || "Spotify not configured" });
        setIsSpotifyConnecting(false);
        return;
      }

      // Store state for CSRF verification
      localStorage.setItem("spotify_auth_state", data.state);
      // Redirect to Spotify auth
      window.location.href = data.authUrl;
    } catch (err) {
      console.error("Failed to start Spotify auth:", err);
      setPopup({ type: "text", content: "Failed to connect to Spotify" });
      setIsSpotifyConnecting(false);
    }
  };

  const controlSpotify = async (action: string, params?: Record<string, unknown>) => {
    if (!spotifyAuth) return;

    try {
      const response = await fetch("/api/spotify/play", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${spotifyAuth.accessToken}`,
        },
        body: JSON.stringify({ action, ...params }),
      });

      if (response.status === 401) {
        await refreshSpotifyToken(spotifyAuth.refreshToken);
      } else if (response.ok) {
        // Refresh now playing after control action
        setTimeout(() => fetchNowPlaying(spotifyAuth.accessToken), 500);
      }

      return response.ok;
    } catch (err) {
      console.error("Spotify control error:", err);
      return false;
    }
  };

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

  const processActions = (actions: SceneAction[]) => {
    console.log("Processing actions:", actions);
    for (const action of actions) {
      console.log("Processing action:", action);
      if (action.type === "add") {
        console.log("Adding element:", action.data);
        const newElement: SceneElement = {
          id: action.data.id as string,
          type: action.data.type as SceneElement["type"],
          content: action.data.content as string,
          position: action.data.position as { x: number; y: number },
          size: action.data.size as number,
          color: action.data.color as string,
          animation: action.data.animation as SceneElement["animation"],
          rotation: action.data.rotation as number | undefined,
          opacity: action.data.opacity as number | undefined,
          draggable: action.data.draggable as boolean | undefined ?? true,
          clickAction: action.data.clickAction as ClickAction | null | undefined,
        };
        setElements((prev) => {
          console.log("Setting elements, prev count:", prev.length, "new element:", newElement);
          return [...prev, newElement];
        });
      } else if (action.type === "remove") {
        const target = action.data.target as string;
        const match = action.data.match as string | undefined;

        if (target === "all") {
          setElements([]);
        } else if (target === "last") {
          setElements((prev) => prev.slice(0, -1));
        } else if (target === "matching" && match) {
          setElements((prev) =>
            prev.filter((el) => !el.content.includes(match))
          );
        }
      } else if (action.type === "modify") {
        const target = action.data.target as string;
        const match = action.data.match as string | undefined;
        const changes = action.data.changes as Partial<SceneElement> & { x?: number; y?: number };

        setElements((prev) => {
          let lastIndex = prev.length - 1;
          return prev.map((el, index) => {
            const shouldModify =
              target === "all" ||
              (target === "last" && index === lastIndex) ||
              (target === "matching" && match && el.content.includes(match));

            if (shouldModify) {
              // Handle x/y as position updates
              const positionUpdate = (changes.x !== undefined || changes.y !== undefined)
                ? { position: { x: changes.x ?? el.position.x, y: changes.y ?? el.position.y } }
                : {};
              const { x, y, ...otherChanges } = changes;
              return { ...el, ...otherChanges, ...positionUpdate };
            }
            return el;
          });
        });
      } else if (action.type === "duplicate") {
        const target = action.data.target as string;
        const match = action.data.match as string | undefined;
        const count = (action.data.count as number) || 1;
        const scatter = action.data.scatter !== false;

        setElements((prev) => {
          let sourceElement: SceneElement | undefined;

          if (target === "last") {
            sourceElement = prev[prev.length - 1];
          } else if (target === "matching" && match) {
            sourceElement = prev.find((el) => el.content.includes(match));
          }

          if (!sourceElement) return prev;

          const newElements: SceneElement[] = [];
          for (let i = 0; i < count; i++) {
            const offset = scatter
              ? { x: (Math.random() - 0.5) * 30, y: (Math.random() - 0.5) * 30 }
              : { x: 2 * (i + 1), y: 2 * (i + 1) };

            newElements.push({
              ...sourceElement,
              id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              position: {
                x: Math.max(0, Math.min(100, sourceElement.position.x + offset.x)),
                y: Math.max(0, Math.min(65, sourceElement.position.y + offset.y)),
              },
            });
          }

          return [...prev, ...newElements];
        });
      } else if (action.type === "attachCapability") {
        const trigger = action.data.trigger as AttachedCapability["trigger"];
        const code = action.data.code as string;
        const targetElement = action.data.targetElement as string;

        // Find the target element
        setElements((prev) => {
          let targetId: string | undefined;
          if (targetElement === "last") {
            targetId = prev[prev.length - 1]?.id;
          } else {
            const found = prev.find((el) => el.content.includes(targetElement));
            targetId = found?.id;
          }

          if (targetId) {
            setCapabilities((caps) => [
              ...caps,
              { elementId: targetId!, trigger, code },
            ]);
          }
          return prev;
        });
      } else if (action.type === "startGenerating") {
        const target = action.data.target as string;
        const match = action.data.match as string | undefined;

        setElements((prev) => {
          const lastIndex = prev.length - 1;
          const targetIds: string[] = [];
          prev.forEach((el, index) => {
            const shouldMark =
              (target === "last" && index === lastIndex) ||
              (target === "matching" && match && el.content.includes(match));
            if (shouldMark) targetIds.push(el.id);
          });
          setGeneratingElements((prev) => new Set([...prev, ...targetIds]));
          return prev;
        });
      } else if (action.type === "stopGenerating") {
        const elementId = action.data.elementId as string;
        setGeneratingElements((prev) => {
          const next = new Set(prev);
          next.delete(elementId);
          return next;
        });
      } else if (action.type === "replaceWithImage") {
        const target = action.data.target as string;
        const match = action.data.match as string | undefined;
        const imageUrl = action.data.imageUrl as string;
        const size = (action.data.size as number) || 150;

        setElements((prev) => {
          const lastIndex = prev.length - 1;
          return prev.map((el, index) => {
            const shouldReplace =
              (target === "last" && index === lastIndex) ||
              (target === "matching" && match && el.content.includes(match));

            if (shouldReplace) {
              // Clear generating state for this element
              setGeneratingElements((genSet) => {
                const next = new Set(genSet);
                next.delete(el.id);
                return next;
              });
              return {
                ...el,
                type: "image" as const,
                content: imageUrl,
                size: size,
              };
            }
            return el;
          });
        });
      } else if (action.type === "finish") {
        const roomName = action.data.roomName as string;
        setTimeout(() => {
          // Save the room
          saveRoom(roomName);
        }, 1000);
      } else if (action.type === "modifyBackground") {
        const changes = action.data as Partial<BackgroundConfig> & { generating?: boolean };

        if (changes.generating !== undefined) {
          setIsBackgroundGenerating(changes.generating);
        }

        setBackground((prev) => ({
          ...prev,
          ...(changes.type !== undefined && { type: changes.type }),
          ...(changes.color !== undefined && { color: changes.color }),
          ...(changes.secondaryColor !== undefined && { secondaryColor: changes.secondaryColor }),
          ...(changes.size !== undefined && { size: changes.size }),
          ...(changes.opacity !== undefined && { opacity: changes.opacity }),
          ...(changes.imageUrl !== undefined && { imageUrl: changes.imageUrl }),
        }));
      }
    }
  };

  // Execute capability code safely
  const executeCapability = (elementId: string, trigger: AttachedCapability["trigger"], event?: React.MouseEvent) => {
    const cap = capabilities.find((c) => c.elementId === elementId && c.trigger === trigger);
    if (!cap) return;

    const element = elements.find((el) => el.id === elementId);
    if (!element) return;

    // Build Spotify context for capabilities
    const spotifyContext = {
      isConnected: !!spotifyAuth,
      track: spotifyTrack,
      connect: connectSpotify,
      fetchNowPlaying: spotifyAuth ? () => fetchNowPlaying(spotifyAuth.accessToken) : null,
      control: controlSpotify,
    };

    try {
      // Create a safe execution context
      const fn = new Function(
        "element",
        "elements",
        "setElements",
        "event",
        "setPopup",
        "spotify",
        cap.code
      );
      fn(element, elements, setElements, event, setPopup, spotifyContext);
    } catch (error) {
      console.error("Capability execution error:", error);
    }
  };

  const saveRoom = async (roomName: string) => {
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setIsLoading(true);

    // Detect if user is asking for realistic image generation
    const realisticKeywords = ["realistic", "real", "actual", "photo", "image", "generate"];
    const isRequestingImage = realisticKeywords.some((kw) =>
      userMessage.toLowerCase().includes(kw)
    );

    // If requesting image, show loading on last element or all matching elements
    if (isRequestingImage && elements.length > 0) {
      const lastElement = elements[elements.length - 1];
      setGeneratingElements(new Set([lastElement.id]));
    }

    try {
      const response = await fetch("/api/canvas/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          history: messages,
          currentElements: elements,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.actions && data.actions.length > 0) {
          processActions(data.actions);
        }

        if (data.response) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.response },
          ]);
        }
      }
    } catch (error) {
      console.error("Failed to process:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Try again?" },
      ]);
      // Clear generating state on error
      setGeneratingElements(new Set());
    } finally {
      setIsLoading(false);
    }
  };

  const getAnimationClass = (animation?: string, isDragging?: boolean) => {
    if (isDragging) return ""; // No animation while dragging
    switch (animation) {
      case "float":
        return "animate-bounce";
      case "pulse":
        return "animate-pulse";
      case "spin":
        return "animate-spin";
      case "bounce":
        return "animate-bounce";
      default:
        return "";
    }
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent, elementId: string) => {
    const el = elements.find((e) => e.id === elementId);
    if (!el || el.draggable === false) return;

    e.preventDefault();
    setDraggedElement(elementId);
    setDidDrag(false); // Reset drag flag on start

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const elementX = (el.position.x / 100) * rect.width;
      const elementY = (el.position.y / 100) * rect.height;
      setDragOffset({
        x: clientX - rect.left - elementX,
        y: clientY - rect.top - elementY,
      });
    }
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!draggedElement || !canvasRef.current) return;

    setDidDrag(true); // User is actually dragging

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const rect = canvasRef.current.getBoundingClientRect();
    const newX = ((clientX - rect.left - dragOffset.x) / rect.width) * 100;
    const newY = ((clientY - rect.top - dragOffset.y) / rect.height) * 100;

    setElements((prev) =>
      prev.map((el) =>
        el.id === draggedElement
          ? {
              ...el,
              position: {
                x: Math.max(0, Math.min(100, newX)),
                y: Math.max(0, Math.min(100, newY)),
              },
            }
          : el
      )
    );
  };

  const handleDragEnd = () => {
    setDraggedElement(null);
  };

  const renderElement = (el: SceneElement) => {
    const isDragging = draggedElement === el.id;
    const canDrag = el.draggable !== false;
    const hasClickCapability = capabilities.some((c) => c.elementId === el.id && c.trigger === "click");
    const isGenerating = generatingElements.has(el.id);

    const baseStyle: React.CSSProperties = {
      left: `${el.position.x}%`,
      top: `${el.position.y}%`,
      fontSize: `${el.size}px`,
      color: el.color,
      opacity: el.opacity ?? 1,
      transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
      // Draggable + clickable = grab cursor, clickable only = pointer, draggable only = grab
      cursor: isDragging ? "grabbing" : canDrag ? "grab" : hasClickCapability ? "pointer" : "default",
      userSelect: "none",
      zIndex: isDragging ? 1000 : 1,
    };

    const handleElementClick = (e: React.MouseEvent) => {
      // Only trigger click capability if user didn't drag
      if (hasClickCapability && !didDrag) {
        e.stopPropagation();
        executeCapability(el.id, "click", e);
      }
    };

    const dragProps = canDrag
      ? {
          onMouseDown: (e: React.MouseEvent) => {
            handleDragStart(e, el.id);
          },
          onTouchStart: (e: React.TouchEvent) => {
            handleDragStart(e, el.id);
          },
          onClick: handleElementClick,
        }
      : { onClick: handleElementClick };

    if (el.type === "emoji") {
      return (
        <div
          key={el.id}
          className={`absolute transition-all ${isDragging ? "duration-0" : "duration-300"} ${getAnimationClass(el.animation, isDragging)}`}
          style={baseStyle}
          {...dragProps}
        >
          {el.content}
          {/* Retro loading bar overlay */}
          {isGenerating && (
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
              <div className="w-16 h-2 border border-[#33ff00] bg-[#0a0a0a]">
                <div
                  className="h-full bg-[#33ff00] animate-[loading_2s_ease-in-out_infinite]"
                  style={{
                    boxShadow: "0 0 8px #33ff00",
                  }}
                />
              </div>
              <span
                className="text-[8px] text-[#33ff00] font-mono tracking-wider"
                style={{ textShadow: "0 0 5px rgba(51, 255, 0, 0.5)" }}
              >
                GENERATING
              </span>
            </div>
          )}
        </div>
      );
    }

    if (el.type === "image") {
      return (
        <div
          key={el.id}
          className={`absolute transition-all ${isDragging ? "duration-0" : "duration-300"} ${getAnimationClass(el.animation, isDragging)}`}
          style={{
            left: `${el.position.x}%`,
            top: `${el.position.y}%`,
            width: `${el.size}px`,
            height: `${el.size}px`,
            opacity: el.opacity ?? 1,
            transform: el.rotation ? `rotate(${el.rotation}deg) translate(-50%, -50%)` : "translate(-50%, -50%)",
            cursor: isDragging ? "grabbing" : canDrag ? "grab" : hasClickCapability ? "pointer" : "default",
            userSelect: "none",
            zIndex: isDragging ? 1000 : 1,
          }}
          {...dragProps}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={el.content}
            alt="Generated image"
            className="w-full h-full object-contain pointer-events-none"
            style={{
              filter: `drop-shadow(0 0 10px rgba(51, 255, 0, 0.3))`,
            }}
          />
        </div>
      );
    }

    if (el.type === "text") {
      return (
        <div
          key={el.id}
          className={`absolute font-mono font-bold transition-all ${isDragging ? "duration-0" : "duration-300"} ${getAnimationClass(el.animation, isDragging)}`}
          style={{
            ...baseStyle,
            textShadow: `0 0 ${el.size / 4}px ${el.color}`,
          }}
          {...dragProps}
        >
          {el.content}
        </div>
      );
    }

    if (el.type === "shape") {
      const shapeSize = el.size;
      const shapeStyle: React.CSSProperties = {
        left: `${el.position.x}%`,
        top: `${el.position.y}%`,
        width: `${shapeSize}px`,
        height: `${shapeSize}px`,
        borderColor: el.color,
        boxShadow: `0 0 ${shapeSize / 2}px ${el.color}40`,
        cursor: canDrag ? (isDragging ? "grabbing" : "grab") : "default",
        userSelect: "none",
        zIndex: isDragging ? 1000 : 1,
      };

      if (el.content === "circle") {
        return (
          <div
            key={el.id}
            className={`absolute border-2 rounded-full transition-all ${isDragging ? "duration-0" : "duration-300"} ${getAnimationClass(el.animation, isDragging)}`}
            style={shapeStyle}
            {...dragProps}
          />
        );
      }

      if (el.content === "triangle") {
        return (
          <div
            key={el.id}
            className={`absolute transition-all ${isDragging ? "duration-0" : "duration-300"} ${getAnimationClass(el.animation, isDragging)}`}
            style={{
              left: `${el.position.x}%`,
              top: `${el.position.y}%`,
              width: 0,
              height: 0,
              borderLeft: `${shapeSize / 2}px solid transparent`,
              borderRight: `${shapeSize / 2}px solid transparent`,
              borderBottom: `${shapeSize}px solid ${el.color}`,
              filter: `drop-shadow(0 0 ${shapeSize / 4}px ${el.color})`,
              cursor: canDrag ? (isDragging ? "grabbing" : "grab") : "default",
              userSelect: "none",
              zIndex: isDragging ? 1000 : 1,
            }}
            {...dragProps}
          />
        );
      }

      // Default square
      return (
        <div
          key={el.id}
          className={`absolute border-2 transition-all ${isDragging ? "duration-0" : "duration-300"} ${getAnimationClass(el.animation, isDragging)}`}
          style={shapeStyle}
          {...dragProps}
        />
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-mono overflow-hidden">
      {/* CRT Scanlines */}
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.03]"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.3) 1px, rgba(0,0,0,0.3) 2px)",
        }}
      />

      {/* Dynamic Background */}
      {background.type === "grid" && (
        <div
          className="fixed inset-0 pointer-events-none transition-all duration-500"
          style={{
            backgroundImage: `linear-gradient(${background.color} 1px, transparent 1px), linear-gradient(90deg, ${background.color} 1px, transparent 1px)`,
            backgroundSize: `${background.size}px ${background.size}px`,
            opacity: background.opacity,
          }}
        />
      )}
      {background.type === "dots" && (
        <div
          className="fixed inset-0 pointer-events-none transition-all duration-500"
          style={{
            backgroundImage: `radial-gradient(circle, ${background.color} 1px, transparent 1px)`,
            backgroundSize: `${background.size}px ${background.size}px`,
            opacity: background.opacity,
          }}
        />
      )}
      {background.type === "image" && background.imageUrl && (
        <div
          className="fixed inset-0 pointer-events-none transition-all duration-500"
          style={{
            backgroundImage: `url(${background.imageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: background.opacity,
          }}
        />
      )}

      {/* Background Loading Animation */}
      {isBackgroundGenerating && (
        <div className="fixed inset-0 pointer-events-none z-[5] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-32 h-3 border border-[#33ff00] bg-[#0a0a0a]">
              <div
                className="h-full bg-[#33ff00] animate-[loading_2s_ease-in-out_infinite]"
                style={{
                  boxShadow: "0 0 12px #33ff00",
                }}
              />
            </div>
            <span
              className="text-[10px] text-[#33ff00] font-mono tracking-wider"
              style={{ textShadow: "0 0 5px rgba(51, 255, 0, 0.5)" }}
            >
              GENERATING BACKGROUND
            </span>
          </div>
        </div>
      )}

      {/* Top Right Buttons */}
      <div className="fixed top-4 right-4 z-30 flex flex-col gap-2">
        {/* Steve Jobs Room Button */}
        <button
          onClick={() => router.push("/room/learn/steve-jobs-room")}
          className="px-3 py-1.5 text-[10px] font-mono border border-[#ffb000]/40 text-[#ffb000]/60 hover:border-[#ffb000] hover:text-[#ffb000] hover:bg-[#ffb000]/10 transition-all"
          style={{ textShadow: "0 0 5px rgba(255, 176, 0, 0.3)" }}
        >
          [TALK TO STEVE]
        </button>

        {/* Cyberpunk Room Button */}
        <button
          onClick={() => router.push("/rooms/cyberpunk-kreuzberg/index.html")}
          className="px-3 py-1.5 text-[10px] font-mono border border-[#00ffff]/40 text-[#00ffff]/60 hover:border-[#00ffff] hover:text-[#00ffff] hover:bg-[#00ffff]/10 transition-all"
          style={{ textShadow: "0 0 5px rgba(0, 255, 255, 0.3)" }}
        >
          [CYBERPUNK DEN]
        </button>

        {/* Spotify Button */}
        <button
          onClick={spotifyAuth ? () => fetchNowPlaying(spotifyAuth.accessToken) : connectSpotify}
          disabled={isSpotifyConnecting}
          className={`px-3 py-1.5 text-[10px] font-mono border transition-all ${
            spotifyAuth
              ? "border-[#1DB954] text-[#1DB954] hover:bg-[#1DB954]/10"
              : "border-[#33ff00]/40 text-[#33ff00]/60 hover:border-[#33ff00] hover:text-[#33ff00]"
          } ${isSpotifyConnecting ? "opacity-50 cursor-wait" : ""}`}
          style={{
            textShadow: spotifyAuth ? "0 0 5px rgba(29, 185, 84, 0.5)" : "0 0 5px rgba(51, 255, 0, 0.3)",
          }}
        >
          {isSpotifyConnecting ? "[CONNECTING...]" : spotifyAuth ? "[SPOTIFY: ON]" : "[SPOTIFY: OFF]"}
        </button>
        {/* Now Playing Display */}
        {spotifyAuth && spotifyTrack && (
          <div
            className="mt-2 px-3 py-2 border border-[#1DB954]/40 bg-[#0a0a0a]/90 max-w-[200px]"
            style={{ textShadow: "0 0 5px rgba(29, 185, 84, 0.3)" }}
          >
            <div className="flex items-center gap-2">
              {spotifyTrack.albumArt && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={spotifyTrack.albumArt}
                  alt="Album art"
                  className="w-10 h-10 object-cover"
                  style={{ filter: "drop-shadow(0 0 5px rgba(29, 185, 84, 0.3))" }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[#1DB954] text-[10px] font-mono truncate">{spotifyTrack.name}</p>
                <p className="text-[#1DB954]/60 text-[8px] font-mono truncate">{spotifyTrack.artist}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Elements */}
      <div
        ref={canvasRef}
        className="fixed inset-0 z-10"
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        {elements.map(renderElement)}
      </div>

      {/* Popup Modal */}
      {popup && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setPopup(null)}
        >
          <div className="max-w-md p-6 border border-[#33ff00]/40 bg-[#0a0a0a]/95">
            {popup.type === "text" && (
              <p className="text-[#33ff00] text-lg font-mono" style={{ textShadow: "0 0 10px rgba(51, 255, 0, 0.5)" }}>
                {popup.content}
              </p>
            )}
            {popup.type === "image" && (
              <div className="text-center">
                <span className="text-6xl">{popup.content}</span>
              </div>
            )}
            <p className="text-[#33ff00]/50 text-xs mt-4 text-center">[click to close]</p>
          </div>
        </div>
      )}

      {/* Chat Container - Bottom Center */}
      <div className="fixed bottom-20 left-0 right-0 z-20 px-4">
        <div className="max-w-xl mx-auto">
          {/* Messages */}
          <div className="max-h-48 overflow-y-auto mb-3 space-y-2 px-1">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 text-xs ${
                    msg.role === "user"
                      ? "bg-[#33ff00] text-[#0a0a0a]"
                      : "border border-[#33ff00]/40 text-[#33ff00]"
                  }`}
                  style={{
                    textShadow:
                      msg.role === "assistant"
                        ? "0 0 5px rgba(51, 255, 0, 0.3)"
                        : "none",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="border border-[#33ff00]/40 px-3 py-2">
                  <span className="text-[#33ff00] text-xs animate-pulse">
                    [...]
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit}>
            <div className="border border-[#33ff00]/40 bg-[#0a0a0a]/90 backdrop-blur-sm">
              <div className="flex items-center">
                <span
                  className="text-[#33ff00] pl-3 text-sm"
                  style={{ textShadow: "0 0 5px rgba(51, 255, 0, 0.5)" }}
                >
                  &gt;
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe what you want to see..."
                  disabled={isLoading}
                  className="flex-1 bg-transparent px-2 py-3 text-[#33ff00] text-sm outline-none placeholder-[#33ff00]/30"
                  style={{ textShadow: "0 0 5px rgba(51, 255, 0, 0.3)" }}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="px-3 py-3 text-[#33ff00] text-xs hover:bg-[#33ff00]/10 disabled:opacity-30 transition-colors"
                  style={{ textShadow: "0 0 5px rgba(51, 255, 0, 0.5)" }}
                >
                  [SEND]
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
