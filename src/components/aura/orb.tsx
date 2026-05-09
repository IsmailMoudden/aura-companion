import { cn } from "@/lib/utils";

interface OrbProps {
  size?: number;
  state?: "idle" | "listening" | "thinking";
  className?: string;
}

export function Orb({ size = 200, state = "idle", className }: OrbProps) {
  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      {/* Outer halo */}
      <div
        className="absolute inset-[-30%] rounded-full blur-3xl animate-glow-pulse"
        style={{ background: "radial-gradient(circle, oklch(0.7 0.16 300 / 0.6), transparent 60%)" }}
      />
      {/* Core orb */}
      <div
        className="absolute inset-0 rounded-full animate-breathe"
        style={{
          background: "var(--gradient-orb)",
          boxShadow: "var(--shadow-glow), inset -20px -30px 60px oklch(0.2 0.1 285 / 0.6), inset 20px 20px 40px oklch(1 0 0 / 0.15)",
        }}
      />
      {/* Highlight */}
      <div
        className="absolute left-[18%] top-[15%] h-[35%] w-[35%] rounded-full opacity-70 blur-md"
        style={{ background: "radial-gradient(circle, oklch(1 0 0 / 0.6), transparent 70%)" }}
      />
      {/* Listening rings */}
      {state === "listening" && (
        <>
          <div className="absolute inset-[-12%] rounded-full border border-[color:var(--glow)] opacity-40 animate-glow-pulse" />
          <div className="absolute inset-[-22%] rounded-full border border-[color:var(--glow)] opacity-25 animate-glow-pulse" style={{ animationDelay: "0.6s" }} />
        </>
      )}
      {/* Thinking orbit */}
      {state === "thinking" && (
        <div className="absolute inset-[-15%] animate-orbit">
          <div className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-[color:var(--glow)] shadow-[0_0_20px_var(--glow)]" />
        </div>
      )}
    </div>
  );
}
