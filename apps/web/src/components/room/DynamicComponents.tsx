"use client";

import React, { ReactNode } from "react";

// Component types that NUTZ can create
export type ComponentType =
  | "text"
  | "heading"
  | "card"
  | "list"
  | "timer"
  | "counter"
  | "progress"
  | "image"
  | "quote"
  | "alert"
  | "badge"
  | "divider"
  | "spacer"
  | "grid"
  | "flex"
  | "animated-text"
  | "floating-emoji"
  | "presentation-slide"
  | "sticky-note"
  | "chat-bubble"
  // New learning-focused components
  | "split-screen"
  | "lesson-card"
  | "key-point"
  | "concept-diagram"
  | "live-transcript"
  | "topic-badge"
  | "learning-progress"
  | "flashcard"
  | "definition"
  | "example-box"
  | "quiz-question"
  | "summary-panel";

export interface RoomComponent {
  id: string;
  type: ComponentType;
  props: Record<string, unknown>;
  position?: {
    x?: string; // e.g., "50%", "100px", "left", "center", "right"
    y?: string; // e.g., "50%", "100px", "top", "center", "bottom"
    anchor?: "top-left" | "top-center" | "top-right" | "center-left" | "center" | "center-right" | "bottom-left" | "bottom-center" | "bottom-right";
  };
  style?: Record<string, string | number>;
  animation?: string; // e.g., "fade-in", "slide-up", "pulse", "bounce"
  children?: RoomComponent[];
}

// Position helper
function getPositionStyles(position?: RoomComponent["position"]): React.CSSProperties {
  if (!position) return {};

  const styles: React.CSSProperties = {
    position: "absolute",
  };

  // Handle anchor-based positioning
  if (position.anchor) {
    const [vertical, horizontal] = position.anchor.split("-") as [string, string?];

    if (vertical === "top") styles.top = "20px";
    else if (vertical === "bottom") styles.bottom = "20px";
    else styles.top = "50%";

    if (horizontal === "left") styles.left = "20px";
    else if (horizontal === "right") styles.right = "20px";
    else {
      styles.left = "50%";
      styles.transform = vertical === "center" ? "translate(-50%, -50%)" : "translateX(-50%)";
    }
  } else {
    // Handle explicit x/y
    if (position.x) {
      if (position.x === "left") styles.left = "20px";
      else if (position.x === "right") styles.right = "20px";
      else if (position.x === "center") {
        styles.left = "50%";
        styles.transform = "translateX(-50%)";
      }
      else styles.left = position.x;
    }
    if (position.y) {
      if (position.y === "top") styles.top = "20px";
      else if (position.y === "bottom") styles.bottom = "20px";
      else if (position.y === "center") {
        styles.top = "50%";
        styles.transform = styles.transform ? "translate(-50%, -50%)" : "translateY(-50%)";
      }
      else styles.top = position.y;
    }
  }

  return styles;
}

// Animation classes
function getAnimationClass(animation?: string): string {
  if (!animation) return "";
  const animations: Record<string, string> = {
    "fade-in": "animate-fade-in",
    "slide-up": "animate-slide-up",
    "slide-down": "animate-slide-down",
    "slide-left": "animate-slide-left",
    "slide-right": "animate-slide-right",
    "pulse": "animate-pulse",
    "bounce": "animate-bounce",
    "spin": "animate-spin",
    "ping": "animate-ping",
    "scale-in": "animate-scale-in",
    "pop-in": "animate-pop-in",
    "glow": "animate-glow",
    "shake": "animate-shake",
    "highlight": "animate-highlight",
    // Staggered animations
    "slide-up-1": "animate-slide-up-1",
    "slide-up-2": "animate-slide-up-2",
    "slide-up-3": "animate-slide-up-3",
    "slide-up-4": "animate-slide-up-4",
    "slide-up-5": "animate-slide-up-5",
  };
  return animations[animation] || "";
}

// Individual component renderers
function TextComponent({ props }: { props: Record<string, unknown> }) {
  const { text, size = "base", color = "white", align = "left", weight = "normal" } = props as {
    text: string;
    size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
    color?: string;
    align?: "left" | "center" | "right";
    weight?: "normal" | "medium" | "semibold" | "bold";
  };

  return (
    <p
      className={`text-${size} font-${weight} text-${align}`}
      style={{ color: color.startsWith("#") ? color : undefined }}
    >
      {text}
    </p>
  );
}

function HeadingComponent({ props }: { props: Record<string, unknown> }) {
  const { text, level = 1, color = "white" } = props as {
    text: string;
    level?: 1 | 2 | 3 | 4;
    color?: string;
  };

  const sizes = { 1: "text-5xl", 2: "text-4xl", 3: "text-3xl", 4: "text-2xl" };

  return (
    <h1
      className={`${sizes[level]} font-bold`}
      style={{ color: color.startsWith("#") ? color : `rgb(var(--${color}))` }}
    >
      {text}
    </h1>
  );
}

function CardComponent({ props, children }: { props: Record<string, unknown>; children?: ReactNode }) {
  const { title, content, variant = "glass" } = props as {
    title?: string;
    content?: string;
    variant?: "glass" | "solid" | "outline";
  };

  const variants = {
    glass: "bg-white/10 backdrop-blur-xl border border-white/20",
    solid: "bg-gray-900",
    outline: "border-2 border-white/30",
  };

  return (
    <div className={`${variants[variant]} rounded-2xl p-6 shadow-xl`}>
      {title && <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>}
      {content && <p className="text-white/80">{content}</p>}
      {children}
    </div>
  );
}

function ListComponent({ props }: { props: Record<string, unknown> }) {
  const { items, ordered = false, icon } = props as {
    items: string[];
    ordered?: boolean;
    icon?: string;
  };

  const Tag = ordered ? "ol" : "ul";

  return (
    <Tag className={`space-y-2 ${ordered ? "list-decimal" : ""} list-inside`}>
      {items?.map((item, i) => (
        <li key={i} className="text-white/90 flex items-start gap-2">
          {icon && <span>{icon}</span>}
          {!icon && !ordered && <span className="text-white/50">•</span>}
          <span>{item}</span>
        </li>
      ))}
    </Tag>
  );
}

function TimerComponent({ props }: { props: Record<string, unknown> }) {
  const { minutes = 5, label } = props as { minutes?: number; label?: string };

  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 text-center">
      {label && <p className="text-white/60 text-sm mb-2">{label}</p>}
      <div className="text-4xl font-mono font-bold text-white">
        {String(minutes).padStart(2, "0")}:00
      </div>
    </div>
  );
}

function ProgressComponent({ props }: { props: Record<string, unknown> }) {
  const { value = 0, max = 100, label, color = "blue" } = props as {
    value?: number;
    max?: number;
    label?: string;
    color?: string;
  };

  const percentage = Math.min(100, (value / max) * 100);

  return (
    <div className="w-full">
      {label && <p className="text-white/80 text-sm mb-2">{label}</p>}
      <div className="h-3 bg-white/20 rounded-full overflow-hidden">
        <div
          className={`h-full bg-${color}-500 transition-all duration-500`}
          style={{ width: `${percentage}%`, backgroundColor: color.startsWith("#") ? color : undefined }}
        />
      </div>
    </div>
  );
}

function QuoteComponent({ props }: { props: Record<string, unknown> }) {
  const { text, author } = props as { text: string; author?: string };

  return (
    <blockquote className="border-l-4 border-white/40 pl-6 py-2">
      <p className="text-xl text-white/90 italic">&ldquo;{text}&rdquo;</p>
      {author && <cite className="text-white/60 text-sm mt-2 block">— {author}</cite>}
    </blockquote>
  );
}

function AlertComponent({ props }: { props: Record<string, unknown> }) {
  const { message, type = "info" } = props as {
    message: string;
    type?: "info" | "success" | "warning" | "error";
  };

  const styles = {
    info: "bg-blue-500/20 border-blue-400 text-blue-100",
    success: "bg-green-500/20 border-green-400 text-green-100",
    warning: "bg-yellow-500/20 border-yellow-400 text-yellow-100",
    error: "bg-red-500/20 border-red-400 text-red-100",
  };

  const icons = {
    info: "ℹ️",
    success: "✅",
    warning: "⚠️",
    error: "❌",
  };

  return (
    <div className={`${styles[type]} border rounded-xl px-4 py-3 flex items-center gap-3`}>
      <span>{icons[type]}</span>
      <p>{message}</p>
    </div>
  );
}

function BadgeComponent({ props }: { props: Record<string, unknown> }) {
  const { text, color = "blue" } = props as { text: string; color?: string };

  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-sm font-medium bg-${color}-500/30 text-${color}-100 border border-${color}-400/50`}
      style={{
        backgroundColor: color.startsWith("#") ? `${color}30` : undefined,
        borderColor: color.startsWith("#") ? `${color}80` : undefined,
      }}
    >
      {text}
    </span>
  );
}

function DividerComponent() {
  return <div className="w-full h-px bg-white/20 my-4" />;
}

function SpacerComponent({ props }: { props: Record<string, unknown> }) {
  const { size = "md" } = props as { size?: "sm" | "md" | "lg" | "xl" };
  const sizes = { sm: "h-4", md: "h-8", lg: "h-16", xl: "h-24" };
  return <div className={sizes[size]} />;
}

function AnimatedTextComponent({ props }: { props: Record<string, unknown> }) {
  const { text, effect = "typewriter" } = props as {
    text: string;
    effect?: "typewriter" | "gradient" | "glow" | "wave";
  };

  if (effect === "gradient") {
    return (
      <span className="text-4xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent animate-gradient">
        {text}
      </span>
    );
  }

  if (effect === "glow") {
    return (
      <span className="text-4xl font-bold text-white animate-pulse drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
        {text}
      </span>
    );
  }

  return <span className="text-4xl font-bold text-white">{text}</span>;
}

function FloatingEmojiComponent({ props }: { props: Record<string, unknown> }) {
  const { emoji = "🎉", count = 5 } = props as { emoji?: string; count?: number };

  return (
    <div className="relative w-full h-32 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="absolute text-4xl animate-float"
          style={{
            left: `${(i + 1) * (100 / (count + 1))}%`,
            animationDelay: `${i * 0.2}s`,
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}

function PresentationSlideComponent({ props, children }: { props: Record<string, unknown>; children?: ReactNode }) {
  const { title, subtitle, bullets } = props as {
    title?: string;
    subtitle?: string;
    bullets?: string[];
  };

  return (
    <div className="bg-black/60 backdrop-blur-xl rounded-3xl p-10 border border-white/10 max-w-2xl w-full">
      {title && <h1 className="text-4xl font-bold text-white mb-2">{title}</h1>}
      {subtitle && <p className="text-xl text-white/60 mb-8">{subtitle}</p>}
      {bullets && bullets.length > 0 && (
        <ul className="space-y-4">
          {bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-4 text-xl text-white/90">
              <span className="text-cyan-400 font-bold">{i + 1}.</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}
      {children}
    </div>
  );
}

function StickyNoteComponent({ props }: { props: Record<string, unknown> }) {
  const { text, color = "yellow" } = props as { text: string; color?: string };

  const colors: Record<string, string> = {
    yellow: "bg-yellow-300 text-yellow-900",
    pink: "bg-pink-300 text-pink-900",
    blue: "bg-blue-300 text-blue-900",
    green: "bg-green-300 text-green-900",
    purple: "bg-purple-300 text-purple-900",
  };

  return (
    <div className={`${colors[color] || colors.yellow} p-4 rounded shadow-lg transform rotate-1 hover:rotate-0 transition-transform max-w-xs`}>
      <p className="font-handwriting text-lg">{text}</p>
    </div>
  );
}

function ChatBubbleComponent({ props }: { props: Record<string, unknown> }) {
  const { text, sender, isUser = false } = props as {
    text: string;
    sender?: string;
    isUser?: boolean;
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-xs ${isUser ? "bg-blue-500" : "bg-white/20"} rounded-2xl px-4 py-2`}>
        {sender && <p className="text-xs text-white/60 mb-1">{sender}</p>}
        <p className="text-white">{text}</p>
      </div>
    </div>
  );
}

// === NEW LEARNING-FOCUSED COMPONENTS ===

function SplitScreenComponent({ props, children }: { props: Record<string, unknown>; children?: ReactNode }) {
  const { layout = "left", width = "40%" } = props as {
    layout?: "left" | "right";
    width?: string;
  };

  const panelStyle = layout === "left"
    ? { left: 0, width }
    : { right: 0, width };

  return (
    <div
      className="fixed top-0 bottom-0 bg-black/70 backdrop-blur-xl border-white/10 flex flex-col overflow-hidden z-20"
      style={{ ...panelStyle, borderRight: layout === "left" ? "1px solid rgba(255,255,255,0.1)" : undefined, borderLeft: layout === "right" ? "1px solid rgba(255,255,255,0.1)" : undefined }}
    >
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {children}
      </div>
    </div>
  );
}

function LessonCardComponent({ props }: { props: Record<string, unknown> }) {
  const { title, content, icon, number } = props as {
    title: string;
    content: string;
    icon?: string;
    number?: number;
  };

  return (
    <div className="bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-xl rounded-2xl p-5 border border-white/20 animate-slide-up">
      <div className="flex items-start gap-3">
        {number && (
          <div className="w-8 h-8 rounded-full bg-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold text-sm shrink-0">
            {number}
          </div>
        )}
        {icon && !number && <span className="text-2xl">{icon}</span>}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
          <p className="text-white/70 text-sm leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  );
}

function KeyPointComponent({ props }: { props: Record<string, unknown> }) {
  const { text, emphasis = "normal", icon = "💡" } = props as {
    text: string;
    emphasis?: "normal" | "important" | "critical";
    icon?: string;
  };

  const emphasisStyles = {
    normal: "border-cyan-400/50 bg-cyan-500/10",
    important: "border-yellow-400/50 bg-yellow-500/10",
    critical: "border-red-400/50 bg-red-500/10 animate-pulse",
  };

  return (
    <div className={`${emphasisStyles[emphasis]} border-l-4 rounded-r-xl px-4 py-3 animate-slide-up`}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{icon}</span>
        <p className="text-white/90 font-medium">{text}</p>
      </div>
    </div>
  );
}

function ConceptDiagramComponent({ props }: { props: Record<string, unknown> }) {
  const { title, center, items } = props as {
    title?: string;
    center: string;
    items: string[];
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
      {title && <h4 className="text-white/60 text-sm mb-4 text-center">{title}</h4>}
      <div className="relative flex items-center justify-center min-h-[200px]">
        {/* Center node */}
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-center p-2 text-sm z-10 shadow-lg shadow-purple-500/30">
          {center}
        </div>
        {/* Orbiting items */}
        {items?.map((item, i) => {
          const angle = (i / items.length) * 2 * Math.PI - Math.PI / 2;
          const radius = 90;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          return (
            <div
              key={i}
              className="absolute w-16 h-16 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-white text-xs text-center p-1"
              style={{ transform: `translate(${x}px, ${y}px)` }}
            >
              {item}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LiveTranscriptComponent({ props }: { props: Record<string, unknown> }) {
  const { speaker, text, isLive = true } = props as {
    speaker: string;
    text: string;
    isLive?: boolean;
  };

  return (
    <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
      <div className="flex items-center gap-2 mb-2">
        {isLive && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
        <span className="text-white/60 text-sm font-medium">{speaker}</span>
      </div>
      <p className="text-white/90 leading-relaxed">{text}</p>
    </div>
  );
}

function TopicBadgeComponent({ props }: { props: Record<string, unknown> }) {
  const { topic, status = "current" } = props as {
    topic: string;
    status?: "upcoming" | "current" | "completed";
  };

  const statusStyles = {
    upcoming: "bg-white/10 text-white/50",
    current: "bg-cyan-500/30 text-cyan-300 ring-2 ring-cyan-400/50",
    completed: "bg-green-500/30 text-green-300",
  };

  const icons = {
    upcoming: "○",
    current: "◉",
    completed: "✓",
  };

  return (
    <span className={`${statusStyles[status]} inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium`}>
      <span>{icons[status]}</span>
      {topic}
    </span>
  );
}

function LearningProgressComponent({ props }: { props: Record<string, unknown> }) {
  const { current, total, topics } = props as {
    current: number;
    total: number;
    topics?: string[];
  };

  const percentage = (current / total) * 100;

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/60 text-sm">Learning Progress</span>
        <span className="text-white font-medium">{current}/{total}</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-700"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {topics && (
        <div className="flex flex-wrap gap-2">
          {topics.map((topic, i) => (
            <span
              key={i}
              className={`text-xs px-2 py-1 rounded ${i < current ? "bg-green-500/20 text-green-300" : i === current ? "bg-cyan-500/20 text-cyan-300" : "bg-white/5 text-white/40"}`}
            >
              {topic}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function FlashcardComponent({ props }: { props: Record<string, unknown> }) {
  const { front, back, showBack = false } = props as {
    front: string;
    back: string;
    showBack?: boolean;
  };

  return (
    <div className="relative w-full max-w-sm mx-auto perspective-1000">
      <div className={`bg-gradient-to-br ${showBack ? "from-green-500/20 to-cyan-500/20" : "from-purple-500/20 to-pink-500/20"} backdrop-blur-xl rounded-2xl p-8 border border-white/20 min-h-[200px] flex items-center justify-center transition-all duration-500`}>
        <div className="text-center">
          <p className="text-xs text-white/40 mb-2">{showBack ? "ANSWER" : "QUESTION"}</p>
          <p className="text-xl text-white font-medium">{showBack ? back : front}</p>
        </div>
      </div>
    </div>
  );
}

function DefinitionComponent({ props }: { props: Record<string, unknown> }) {
  const { term, definition, example } = props as {
    term: string;
    definition: string;
    example?: string;
  };

  return (
    <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10 animate-slide-up">
      <h4 className="text-lg font-bold text-cyan-300 mb-2">{term}</h4>
      <p className="text-white/80 mb-3">{definition}</p>
      {example && (
        <div className="bg-white/5 rounded-lg p-3 border-l-2 border-yellow-400/50">
          <p className="text-sm text-white/60"><span className="text-yellow-400">Example:</span> {example}</p>
        </div>
      )}
    </div>
  );
}

function ExampleBoxComponent({ props }: { props: Record<string, unknown> }) {
  const { title, content, type = "example" } = props as {
    title?: string;
    content: string;
    type?: "example" | "code" | "formula" | "analogy";
  };

  const typeStyles = {
    example: { bg: "from-blue-500/20 to-cyan-500/20", icon: "📝", label: "Example" },
    code: { bg: "from-gray-500/20 to-gray-600/20", icon: "💻", label: "Code" },
    formula: { bg: "from-purple-500/20 to-pink-500/20", icon: "🔢", label: "Formula" },
    analogy: { bg: "from-yellow-500/20 to-orange-500/20", icon: "💭", label: "Analogy" },
  };

  const style = typeStyles[type];

  return (
    <div className={`bg-gradient-to-r ${style.bg} backdrop-blur rounded-xl p-4 border border-white/10`}>
      <div className="flex items-center gap-2 mb-2">
        <span>{style.icon}</span>
        <span className="text-white/60 text-sm font-medium">{title || style.label}</span>
      </div>
      <p className={`text-white/90 ${type === "code" ? "font-mono text-sm" : ""}`}>{content}</p>
    </div>
  );
}

function QuizQuestionComponent({ props }: { props: Record<string, unknown> }) {
  const { question, options, correctIndex, showAnswer = false } = props as {
    question: string;
    options: string[];
    correctIndex?: number;
    showAnswer?: boolean;
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
      <p className="text-white font-medium mb-4">{question}</p>
      <div className="space-y-2">
        {options?.map((option, i) => (
          <div
            key={i}
            className={`px-4 py-3 rounded-xl border transition-all ${
              showAnswer && i === correctIndex
                ? "bg-green-500/20 border-green-400/50 text-green-300"
                : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
            }`}
          >
            <span className="font-medium mr-3">{String.fromCharCode(65 + i)}.</span>
            {option}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryPanelComponent({ props }: { props: Record<string, unknown> }) {
  const { title = "Summary", points, conclusion } = props as {
    title?: string;
    points: string[];
    conclusion?: string;
  };

  return (
    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span>📋</span> {title}
      </h3>
      <ul className="space-y-3 mb-4">
        {points?.map((point, i) => (
          <li key={i} className="flex items-start gap-3 text-white/80 animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
            <span className="text-cyan-400 mt-1">✓</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
      {conclusion && (
        <div className="pt-4 border-t border-white/10">
          <p className="text-white/60 text-sm italic">{conclusion}</p>
        </div>
      )}
    </div>
  );
}

function GridComponent({ props, children }: { props: Record<string, unknown>; children?: ReactNode }) {
  const { cols = 2, gap = 4 } = props as { cols?: number; gap?: number };

  return (
    <div className={`grid grid-cols-${cols} gap-${gap}`}>
      {children}
    </div>
  );
}

function FlexComponent({ props, children }: { props: Record<string, unknown>; children?: ReactNode }) {
  const { direction = "row", gap = 4, align = "center", justify = "start" } = props as {
    direction?: "row" | "col";
    gap?: number;
    align?: "start" | "center" | "end";
    justify?: "start" | "center" | "end" | "between";
  };

  return (
    <div className={`flex flex-${direction} gap-${gap} items-${align} justify-${justify}`}>
      {children}
    </div>
  );
}

// Component registry
const componentRegistry: Record<ComponentType, React.ComponentType<{ props: Record<string, unknown>; children?: ReactNode }>> = {
  "text": TextComponent,
  "heading": HeadingComponent,
  "card": CardComponent,
  "list": ListComponent,
  "timer": TimerComponent,
  "counter": TimerComponent, // Reuse timer for now
  "progress": ProgressComponent,
  "image": ({ props }) => <img src={props.src as string} alt={props.alt as string || ""} className="rounded-xl" />,
  "quote": QuoteComponent,
  "alert": AlertComponent,
  "badge": BadgeComponent,
  "divider": DividerComponent,
  "spacer": SpacerComponent,
  "grid": GridComponent,
  "flex": FlexComponent,
  "animated-text": AnimatedTextComponent,
  "floating-emoji": FloatingEmojiComponent,
  "presentation-slide": PresentationSlideComponent,
  "sticky-note": StickyNoteComponent,
  "chat-bubble": ChatBubbleComponent,
  // New learning-focused components
  "split-screen": SplitScreenComponent,
  "lesson-card": LessonCardComponent,
  "key-point": KeyPointComponent,
  "concept-diagram": ConceptDiagramComponent,
  "live-transcript": LiveTranscriptComponent,
  "topic-badge": TopicBadgeComponent,
  "learning-progress": LearningProgressComponent,
  "flashcard": FlashcardComponent,
  "definition": DefinitionComponent,
  "example-box": ExampleBoxComponent,
  "quiz-question": QuizQuestionComponent,
  "summary-panel": SummaryPanelComponent,
};

// Recursive component renderer
export function RenderComponent({ component }: { component: RoomComponent }): React.ReactElement | null {
  const Component = componentRegistry[component.type];

  if (!Component) {
    console.warn(`Unknown component type: ${component.type}`);
    return null;
  }

  const positionStyles = getPositionStyles(component.position);
  const animationClass = getAnimationClass(component.animation);

  // Render children recursively
  const childElements = component.children?.map((child) => (
    <RenderComponent key={child.id} component={child} />
  ));

  return (
    <div
      style={{ ...positionStyles, ...component.style }}
      className={`${animationClass} ${component.position ? "absolute" : ""}`}
    >
      <Component props={component.props} children={childElements} />
    </div>
  );
}

// Main renderer for all components
export function DynamicComponentRenderer({ components }: { components: RoomComponent[] }) {
  if (!components || components.length === 0) return null;

  // Find split-screen component
  const splitScreenIndex = components.findIndex((c) => c.type === "split-screen");

  // If there's a split-screen, render content inside it
  if (splitScreenIndex !== -1) {
    const splitScreen = components[splitScreenIndex];
    const otherComponents = components.filter((c) => c.type !== "split-screen");
    const { layout = "right", width = "40%" } = splitScreen.props as {
      layout?: "left" | "right";
      width?: string;
    };

    const panelStyle = layout === "left"
      ? { left: 0, width }
      : { right: 0, width };

    return (
      <>
        {/* Split-screen panel with all other components inside */}
        <div
          className="fixed top-0 bottom-0 bg-black/80 backdrop-blur-xl flex flex-col overflow-hidden z-20 pointer-events-auto animate-slide-left"
          style={{
            ...panelStyle,
            borderLeft: layout === "right" ? "1px solid rgba(255,255,255,0.15)" : undefined,
            borderRight: layout === "left" ? "1px solid rgba(255,255,255,0.15)" : undefined,
          }}
        >
          {/* Header gradient */}
          <div className="h-16 bg-gradient-to-b from-black/50 to-transparent absolute top-0 left-0 right-0 z-10" />

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto pt-12 pb-20 px-5 space-y-4">
            {otherComponents.map((component) => {
              const Component = componentRegistry[component.type];
              if (!Component) return null;
              const animationClass = getAnimationClass(component.animation);
              return (
                <div key={component.id} className={animationClass}>
                  <Component props={component.props} />
                </div>
              );
            })}
          </div>

          {/* Bottom gradient */}
          <div className="h-20 bg-gradient-to-t from-black/50 to-transparent absolute bottom-0 left-0 right-0" />
        </div>
      </>
    );
  }

  // No split-screen, render components normally with positioning
  return (
    <>
      {components.map((component) => (
        <RenderComponent key={component.id} component={component} />
      ))}
    </>
  );
}
