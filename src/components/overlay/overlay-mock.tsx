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
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/70">Aura</p>
          <p className="text-sm font-light text-foreground">Looking at your screen</p>
        </div>
        <Camera className="h-4 w-4 text-foreground/80" />
      </div>
      <div className="rounded-2xl bg-foreground/[0.08] p-3 border border-foreground/15">
        <div className="aspect-[16/9] rounded-xl"
          style={{ background: "linear-gradient(135deg, oklch(0.5 0.13 265 / 0.6), oklch(0.38 0.1 275 / 0.55))" }}
        />
        <p className="mt-2 text-xs text-foreground/75">Screenshot · 3:42 PM</p>
      </div>
      <p className="text-[15px] font-light leading-relaxed text-foreground">
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
              "inline-flex items-center gap-2 rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-light text-foreground",
              "transition-colors hover:bg-foreground/20",
            )}
          >
            <a.icon className="h-3 w-3" /> {a.label}
          </button>
        ))}
      </div>
    </GlassPanel>
  );
}
