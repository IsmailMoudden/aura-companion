import { GlassPanel } from "@/components/aura/glass-panel";
import { ReactNode } from "react";

export function FeatureGrid({
  items,
}: {
  items: { icon: ReactNode; title: string; description: string }[];
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map((it, i) => (
        <GlassPanel
          key={it.title}
          className="group relative overflow-hidden p-8 transition-all duration-700 hover:-translate-y-1 animate-fade-up"
          style={{ animationDelay: `${0.1 * i}s` }}
        >
          <div
            aria-hidden
            className="absolute -right-20 -top-20 h-48 w-48 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-60"
            style={{ background: "radial-gradient(circle, var(--glow), transparent 70%)" }}
          />
          <div className="relative">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] text-[color:var(--glow-soft)]">
              {it.icon}
            </div>
            <h3 className="text-display text-2xl">{it.title}</h3>
            <p className="mt-3 text-[15px] font-light leading-relaxed text-muted-foreground">
              {it.description}
            </p>
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}
