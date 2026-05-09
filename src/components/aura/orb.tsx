import { cn } from "@/lib/utils";

interface OrbProps {
  size?: number;
  state?: "idle" | "listening" | "thinking";
  variant?: "default" | "overlay";
  className?: string;
}

export function Orb({ size = 200, state = "idle", variant = "default", className }: OrbProps) {
  const isOverlay = variant === "overlay";

  const orbGradient = isOverlay
    ? "radial-gradient(circle at 35% 30%, oklch(0.95 0.04 225), oklch(0.72 0.12 232) 45%, oklch(0.52 0.14 240) 85%)"
    : "var(--gradient-orb)";

  const haloColor = isOverlay
    ? "radial-gradient(circle, oklch(0.75 0.12 232 / 0.7), transparent 60%)"
    : "radial-gradient(circle, oklch(0.7 0.16 300 / 0.6), transparent 60%)";

  const glowShadow = isOverlay
    ? "0 0 60px oklch(0.72 0.14 232 / 0.5), 0 0 20px oklch(0.72 0.14 232 / 0.3), inset -20px -30px 60px oklch(0.2 0.08 250 / 0.5), inset 20px 20px 40px oklch(1 0 0 / 0.18)"
    : "var(--shadow-glow), inset -20px -30px 60px oklch(0.2 0.1 285 / 0.6), inset 20px 20px 40px oklch(1 0 0 / 0.15)";

  const ringColor = isOverlay ? "oklch(0.75 0.14 232)" : "var(--glow)";
  const dotColor = isOverlay ? "oklch(0.85 0.1 228)" : "var(--glow)";

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      {/* Outer halo */}
      <div
        className="absolute inset-[-30%] rounded-full blur-3xl animate-glow-pulse"
        style={{ background: haloColor }}
      />
      {/* Core orb */}
      <div
        className="absolute inset-0 rounded-full animate-breathe"
        style={{ background: orbGradient, boxShadow: glowShadow }}
      />
      {/* Highlight */}
      <div
        className="absolute left-[18%] top-[15%] h-[35%] w-[35%] rounded-full opacity-70 blur-md"
        style={{ background: "radial-gradient(circle, oklch(1 0 0 / 0.6), transparent 70%)" }}
      />
      {/* Listening rings */}
      {state === "listening" && (
        <>
          <div className="absolute inset-[-12%] rounded-full border opacity-40 animate-glow-pulse" style={{ borderColor: ringColor }} />
          <div className="absolute inset-[-22%] rounded-full border opacity-25 animate-glow-pulse" style={{ borderColor: ringColor, animationDelay: "0.6s" }} />
        </>
      )}
      {/* Thinking orbit */}
      {state === "thinking" && (
        <div className="absolute inset-[-15%] animate-orbit">
          <div className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full" style={{ background: dotColor, boxShadow: `0 0 20px ${dotColor}` }} />
        </div>
      )}
    </div>
  );
}
