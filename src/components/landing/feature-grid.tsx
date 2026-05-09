import { GlassPanel } from "@/components/aura/glass-panel";
import { ReactNode } from "react";
import { Reveal } from "@/components/aura/reveal";
import { Orb } from "@/components/aura/orb";

export function FeatureGrid({
  items,
}: {
  items: { icon: ReactNode; title: string; description: string; image?: string; imageAlt?: string; video?: string }[];
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map((it, i) => (
        <Reveal key={it.title} variant="scale" delay={0.1 * i}>
          <GlassPanel
            strong
            className="group relative h-full overflow-hidden rounded-3xl p-6 transition-all duration-700 hover:-translate-y-1"
          >
            <div
              aria-hidden
              className="absolute -right-24 -top-24 h-56 w-56 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-60"
              style={{ background: "radial-gradient(circle, var(--glow), transparent 70%)" }}
            />

            {/* Mini overlay header */}
            <div className="relative flex items-center gap-3">
              <Orb size={36} variant="overlay" noHalo className="shrink-0" />
              <div className="flex flex-1 flex-col leading-tight">
                <span className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/80">
                  Aura
                </span>
                <span className="text-[13px] font-light text-foreground/90">
                  {it.title}
                </span>
              </div>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[color:var(--glow-soft)]">
                {it.icon}
              </div>
            </div>

            {/* Illustrative "screen" */}
            {(it.image || it.video) && (
              <div className="relative mt-5 overflow-hidden rounded-2xl ring-1 ring-inset ring-white/[0.08]">
                <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-white/[0.03] px-3 py-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                  <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                  <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                </div>
                <div className="relative aspect-[16/10] w-full">
                  {it.video ? (
                    <video
                      src={it.video}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <img
                      src={it.image}
                      alt={it.imageAlt ?? it.title}
                      loading="lazy"
                      width={768}
                      height={512}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-[1.04]"
                    />
                  )}
                  <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(180deg, transparent 40%, oklch(0.2 0.06 250 / 0.55) 100%)",
                    }}
                  />
                </div>
              </div>
            )}

            {/* AI "voice" message */}
            <div className="relative mt-5 rounded-2xl bg-white/[0.04] px-4 py-4 ring-1 ring-inset ring-white/[0.06]">
              <p className="text-display text-[17px] font-light leading-relaxed text-foreground/95">
                {it.description}
              </p>
            </div>
          </GlassPanel>
        </Reveal>
      ))}
    </div>
  );
}
