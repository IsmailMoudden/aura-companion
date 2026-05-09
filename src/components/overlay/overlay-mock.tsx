import { Orb } from "@/components/aura/orb";
import { GlassPanel } from "@/components/aura/glass-panel";
import { Camera, Sparkles, Languages, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export type OverlayState = "idle" | "listening" | "thinking" | "expanded";

export function OverlayMock({ state }: { state: OverlayState }) {
  if (state === "idle") {
    return (
      <div className="flex items-center justify-center">
        <Orb size={120} />
      </div>
    );
  }
  if (state === "listening") {
    return (
      <GlassPanel strong className="flex items-center gap-5 rounded-full px-6 py-4">
        <Orb size={56} state="listening" />
        <div className="flex items-end gap-1 h-10">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-[color:var(--glow)] animate-wave"
              style={{ animationDelay: `${i * 0.08}s`, height: "100%" }}
            />
          ))}
        </div>
        <span className="text-sm font-light text-muted-foreground pr-2">Listening…</span>
      </GlassPanel>
    );
  }
  if (state === "thinking") {
    return (
      <GlassPanel strong className="flex items-center gap-4 rounded-full px-6 py-4">
        <Orb size={56} state="thinking" />
        <span
          className="bg-clip-text text-transparent text-sm font-light"
          style={{
            backgroundImage: "linear-gradient(90deg, oklch(0.7 0 0), oklch(1 0 0), oklch(0.7 0 0))",
            backgroundSize: "200% 100%",
            animation: "shimmer 2.4s linear infinite",
          }}
        >
          Thinking through your screen…
        </span>
      </GlassPanel>
    );
  }
  // expanded
  return (
    <GlassPanel strong className="w-[420px] max-w-full rounded-3xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Orb size={36} />
        <div className="flex-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Aura</p>
          <p className="text-sm font-light">Looking at your screen</p>
        </div>
        <Camera className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="rounded-2xl bg-white/[0.06] p-3 border border-white/10">
        <div className="aspect-[16/9] rounded-xl"
          style={{ background: "linear-gradient(135deg, oklch(0.88 0.08 225 / 0.5), oklch(0.78 0.1 245 / 0.4))" }}
        />
        <p className="mt-2 text-xs text-muted-foreground">Screenshot · 3:42 PM</p>
      </div>
      <p className="text-[15px] font-light leading-relaxed">
        This looks like a quarterly report. Want me to summarize the revenue section
        or compare it with last quarter's notes?
      </p>
      <div className="flex flex-wrap gap-2">
        {[
          { icon: Sparkles, label: "Summarize" },
          { icon: BookOpen, label: "Explain" },
          { icon: Languages, label: "Translate" },
        ].map((a) => (
          <button
            key={a.label}
            className={cn(
              "inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-light",
              "transition-colors hover:bg-white/[0.1]",
            )}
          >
            <a.icon className="h-3 w-3" /> {a.label}
          </button>
        ))}
      </div>
    </GlassPanel>
  );
}
