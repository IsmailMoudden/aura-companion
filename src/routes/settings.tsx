import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GlassPanel } from "@/components/aura/glass-panel";
import { Orb } from "@/components/aura/orb";
import { cn } from "@/lib/utils";
import { Sparkles, Keyboard, Brain, Palette, Image as ImageIcon, Lock } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings, Aura" },
      { name: "description", content: "Tune your overlay, memory, and privacy with calm controls." },
      { property: "og:title", content: "Aura, Settings" },
      { property: "og:description", content: "A premium, minimal control surface for your AI companion." },
    ],
  }),
  component: SettingsPage,
});

const sections = [
  { id: "overlay", label: "Overlay", icon: Sparkles },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "memory", label: "AI Memory", icon: Brain },
  { id: "theme", label: "Theme", icon: Palette },
  { id: "screenshots", label: "Screenshots", icon: ImageIcon },
  { id: "privacy", label: "Privacy", icon: Lock },
];

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative h-7 w-12 rounded-full transition-colors",
        on ? "bg-[color:var(--glow)]" : "bg-white/10",
      )}
    >
      <span
        className={cn(
          "absolute top-1 h-5 w-5 rounded-full bg-white transition-all",
          on ? "left-6" : "left-1",
        )}
        style={on ? { boxShadow: "0 0 12px var(--glow)" } : {}}
      />
    </button>
  );
}

function Row({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-8 border-b border-white/[0.05] py-6 last:border-0">
      <div>
        <p className="text-[15px] font-light">{title}</p>
        <p className="mt-1 text-sm font-light text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SettingsPage() {
  const [active, setActive] = useState("overlay");
  const [toggles, setToggles] = useState({ alwaysOn: true, breathe: true, sound: false, autoCapture: true, history: true });
  const t = (k: keyof typeof toggles) => setToggles({ ...toggles, [k]: !toggles[k] });

  return (
    <main className="relative px-4 pb-16 pt-32 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 flex items-end justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Settings</p>
            <h1 className="mt-3 text-display text-5xl sm:text-6xl">Tune your companion.</h1>
          </div>
          <Orb size={80} className="hidden sm:block opacity-80" />
        </div>

        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <GlassPanel className="h-fit p-3">
            <ul className="space-y-1">
              {sections.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setActive(s.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-light transition-colors",
                      active === s.id
                        ? "bg-white/[0.07] text-foreground"
                        : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                    )}
                  >
                    <s.icon className="h-4 w-4" /> {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </GlassPanel>

          <GlassPanel className="p-8 sm:p-12">
            {active === "overlay" && (
              <div>
                <h2 className="text-display text-3xl">Overlay</h2>
                <p className="mt-2 text-sm font-light text-muted-foreground">
                  How Aura appears on your desktop.
                </p>
                <div className="mt-8">
                  <Row title="Always visible" description="Keep a soft breathing orb on screen at all times.">
                    <Toggle on={toggles.alwaysOn} onClick={() => t("alwaysOn")} />
                  </Row>
                  <Row title="Breathing motion" description="Organic scale and glow animations.">
                    <Toggle on={toggles.breathe} onClick={() => t("breathe")} />
                  </Row>
                  <Row title="Soft sound" description="A whisper when Aura starts listening.">
                    <Toggle on={toggles.sound} onClick={() => t("sound")} />
                  </Row>
                  <Row title="Position" description="Where the orb rests when idle.">
                    <div className="flex gap-2 rounded-full bg-white/[0.04] p-1">
                      {["TL", "TR", "BL", "BR"].map((p, i) => (
                        <button
                          key={p}
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-light",
                            i === 3 ? "bg-white/[0.08] text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </Row>
                </div>
              </div>
            )}
            {active === "shortcuts" && (
              <div>
                <h2 className="text-display text-3xl">Shortcuts</h2>
                <p className="mt-2 text-sm font-light text-muted-foreground">A single key away.</p>
                <div className="mt-8">
                  {[
                    { t: "Summon Aura", k: "⌥ Space" },
                    { t: "Capture screen", k: "⌥ ⇧ C" },
                    { t: "Quick note", k: "⌥ N" },
                    { t: "Hide overlay", k: "⌥ Esc" },
                  ].map((row) => (
                    <Row key={row.t} title={row.t} description="Click to rebind">
                      <kbd className="rounded-xl bg-white/[0.06] px-4 py-2 text-xs font-light tracking-wider">{row.k}</kbd>
                    </Row>
                  ))}
                </div>
              </div>
            )}
            {active === "memory" && (
              <div>
                <h2 className="text-display text-3xl">AI Memory</h2>
                <p className="mt-2 text-sm font-light text-muted-foreground">What Aura remembers, and forgets.</p>
                <div className="mt-8">
                  <Row title="Conversation history" description="Threads remain searchable across devices.">
                    <Toggle on={toggles.history} onClick={() => t("history")} />
                  </Row>
                  <Row title="Auto-save important moments" description="Aura quietly pins what feels meaningful.">
                    <Toggle on={toggles.autoCapture} onClick={() => t("autoCapture")} />
                  </Row>
                  <Row title="Forget after" description="Memory horizon for casual chats.">
                    <select className="rounded-full bg-white/[0.06] px-4 py-2 text-sm font-light focus:outline-none">
                      <option>30 days</option>
                      <option>90 days</option>
                      <option>Never</option>
                    </select>
                  </Row>
                </div>
              </div>
            )}
            {active === "theme" && (
              <div>
                <h2 className="text-display text-3xl">Theme</h2>
                <p className="mt-2 text-sm font-light text-muted-foreground">Set the mood of your companion.</p>
                <div className="mt-10 grid gap-4 sm:grid-cols-3">
                  {[
                    { name: "Aura (default)", g: "linear-gradient(135deg, oklch(0.5 0.15 295), oklch(0.3 0.1 270))" },
                    { name: "Dawn", g: "linear-gradient(135deg, oklch(0.7 0.12 30), oklch(0.5 0.1 320))" },
                    { name: "Pine", g: "linear-gradient(135deg, oklch(0.5 0.12 170), oklch(0.25 0.06 220))" },
                  ].map((th, i) => (
                    <button
                      key={th.name}
                      className={cn(
                        "group relative h-40 overflow-hidden rounded-3xl text-left transition-all",
                        i === 0 && "ring-1 ring-[color:var(--glow)]",
                      )}
                      style={{ background: th.g }}
                    >
                      <div className="absolute inset-x-4 bottom-4 flex items-center justify-between">
                        <span className="text-sm font-light">{th.name}</span>
                        <span className="h-6 w-6 rounded-full" style={{ background: "var(--gradient-orb)" }} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {active === "screenshots" && (
              <div>
                <h2 className="text-display text-3xl">Connected screenshots</h2>
                <p className="mt-2 text-sm font-light text-muted-foreground">Visual moments Aura has woven into memory.</p>
                <div className="mt-10 grid grid-cols-3 gap-4 sm:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-2xl"
                      style={{
                        background: `linear-gradient(${130 + i * 25}deg, oklch(0.45 0.1 ${260 + i * 12}), oklch(0.22 0.06 ${280 + i * 6}))`,
                        boxShadow: "var(--shadow-soft)",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            {active === "privacy" && (
              <div>
                <h2 className="text-display text-3xl">Privacy</h2>
                <p className="mt-2 text-sm font-light text-muted-foreground">
                  Your screen and your memory belong to you.
                </p>
                <div className="mt-8">
                  <Row title="Local-first processing" description="Sensitive content never leaves this device.">
                    <Toggle on onClick={() => {}} />
                  </Row>
                  <Row title="End-to-end encryption" description="Synced memories are encrypted with your key.">
                    <Toggle on onClick={() => {}} />
                  </Row>
                  <Row title="Clear all memory" description="Delete every conversation, screenshot, and note.">
                    <button className="rounded-full bg-white/[0.06] px-5 py-2 text-sm font-light text-muted-foreground hover:bg-white/[0.1] hover:text-foreground transition-colors">
                      Clear…
                    </button>
                  </Row>
                </div>
              </div>
            )}
          </GlassPanel>
        </div>
      </div>
    </main>
  );
}
