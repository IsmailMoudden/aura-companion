import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OverlayMock, type OverlayState } from "@/components/overlay/overlay-mock";
import { Section } from "@/components/landing/section";
import { GlassPanel } from "@/components/aura/glass-panel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/overlay")({
  head: () => ({
    meta: [
      { title: "Overlay — Aura" },
      { name: "description", content: "A floating, breathing AI companion that lives gently above your apps." },
      { property: "og:title", content: "Aura Overlay — A floating AI companion" },
      { property: "og:description", content: "Idle, listening, thinking, expanded — a calm presence on your desktop." },
    ],
  }),
  component: OverlayPage,
});

const states: { id: OverlayState; label: string; copy: string }[] = [
  { id: "idle", label: "Idle", copy: "A small breath of light. Aura waits, never demands. You can forget it's there, until you need it." },
  { id: "listening", label: "Listening", copy: "A gentle ring blooms outward. Aura is quietly tuning in to you, not the room around you." },
  { id: "thinking", label: "Thinking", copy: "A soft shimmer. Reasoning happens in the background, with the patience of a good friend." },
  { id: "expanded", label: "Expanded", copy: "When invited, the panel opens — context, screenshot, a tender suggestion. Then it folds away." },
];

const shortcuts = [
  { keys: ["⌥", "Space"], label: "Summon Aura", description: "Open or close the overlay from anywhere on your desktop." },
  { keys: ["⌥", "⇧", "C"], label: "Capture screen", description: "Take a screenshot and attach it to your next message instantly." },
  { keys: ["⌥", "N"], label: "Quick note", description: "Open Aura with a blank input, ready to receive a thought." },
  { keys: ["⌥", "Esc"], label: "Dismiss", description: "Minimise back to the orb without closing the session." },
];

function OverlayPage() {
  const [state, setState] = useState<OverlayState>("expanded");

  return (
    <main className="relative pt-32">
      <Section
        eyebrow="The overlay"
        title={<>A companion that<br /><em className="italic text-muted-foreground/80">floats with you.</em></>}
        description="A whisper of glass on top of any app. Press a key, Aura is there. Look away, it dissolves."
      />

      {/* ── DEMO STAGE ── */}
      <section className="relative px-6 pb-24">
        <div className="mx-auto max-w-6xl">
          <div
            className="relative aspect-[16/10] overflow-hidden rounded-[2rem] shadow-2xl animate-fade-up"
            style={{
              background: "linear-gradient(135deg, oklch(0.32 0.08 280) 0%, oklch(0.2 0.06 270) 60%, oklch(0.16 0.04 250) 100%)",
              boxShadow: "var(--shadow-soft)",
            }}
          >
            {/* Faux desktop content behind */}
            <div className="absolute inset-0 p-16 opacity-40 blur-md pointer-events-none">
              <div className="grid h-full grid-cols-3 gap-8">
                <div className="space-y-3">
                  <div className="h-3 w-3/4 rounded bg-white/10" />
                  <div className="h-2 w-full rounded bg-white/[0.06]" />
                  <div className="h-2 w-5/6 rounded bg-white/[0.06]" />
                  <div className="h-2 w-2/3 rounded bg-white/[0.06]" />
                  <div className="mt-6 h-24 w-full rounded-2xl bg-white/[0.04]" />
                </div>
                <div className="space-y-2">
                  <div className="h-32 w-full rounded-2xl bg-white/[0.04]" />
                  <div className="h-2 w-3/4 rounded bg-white/[0.06]" />
                  <div className="h-2 w-full rounded bg-white/[0.06]" />
                </div>
                <div className="space-y-3">
                  <div className="h-3 w-1/2 rounded bg-white/10" />
                  <div className="h-2 w-full rounded bg-white/[0.06]" />
                  <div className="h-2 w-3/4 rounded bg-white/[0.06]" />
                  <div className="h-2 w-5/6 rounded bg-white/[0.06]" />
                </div>
              </div>
            </div>

            {/* Vignette */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at center, transparent 30%, oklch(0.1 0.03 280 / 0.5) 100%)" }}
            />

            {/* Live mock */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div key={state} className="animate-fade-in">
                <OverlayMock state={state} />
              </div>
            </div>
          </div>

          {/* State picker */}
          <GlassPanel className="mx-auto mt-10 flex max-w-xl items-center justify-between gap-2 rounded-full p-2">
            {states.map((s) => (
              <button
                key={s.id}
                onClick={() => setState(s.id)}
                className={cn(
                  "flex-1 rounded-full px-4 py-2 text-sm font-light transition-all",
                  state === s.id
                    ? "bg-white/[0.08] text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </GlassPanel>

          <p
            className="mx-auto mt-8 max-w-2xl text-center text-lg font-light text-muted-foreground animate-fade-in"
            key={state + "-copy"}
          >
            {states.find((s) => s.id === state)?.copy}
          </p>
        </div>
      </section>

      {/* ── SHORTCUTS ── */}
      <section className="relative px-6 pb-32">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Keyboard</p>
            <h2 className="mt-3 text-display text-4xl sm:text-5xl">A single key away.</h2>
            <p className="mt-4 max-w-lg text-[15px] font-light leading-relaxed text-muted-foreground">
              Every shortcut is global — works while any other app is in focus.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {shortcuts.map((s) => (
              <GlassPanel key={s.label} className="flex items-start gap-5 p-7">
                <div className="flex shrink-0 items-center gap-1 pt-0.5">
                  {s.keys.map((k) => (
                    <kbd
                      key={k}
                      className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg bg-white/[0.07] px-2 text-xs font-light tracking-wider text-foreground/70"
                      style={{ boxShadow: "inset 0 -1px 0 oklch(0 0 0 / 0.2), 0 1px 0 oklch(1 0 0 / 0.06)" }}
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
                <div>
                  <p className="text-[15px] font-light">{s.label}</p>
                  <p className="mt-1 text-sm font-light leading-relaxed text-muted-foreground">{s.description}</p>
                </div>
              </GlassPanel>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUALITIES ── */}
      <Section
        eyebrow="Designed to disappear"
        title="A presence, not an app."
        description="Aura's overlay is built around one principle: respect for your attention. It only arrives when summoned, only stays as long as needed."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <GlassPanel className="p-8">
            <h3 className="text-display text-2xl">Discreet</h3>
            <p className="mt-3 text-[15px] font-light leading-relaxed text-muted-foreground">
              Truly transparent. No window chrome. No tray icon noise. A single
              floating breath you can hide with a tap.
            </p>
          </GlassPanel>
          <GlassPanel className="p-8">
            <h3 className="text-display text-2xl">Alive</h3>
            <p className="mt-3 text-[15px] font-light leading-relaxed text-muted-foreground">
              Subtle motion, organic timing, soft sound. Aura doesn't blink, it
              breathes.
            </p>
          </GlassPanel>
        </div>
      </Section>
    </main>
  );
}
