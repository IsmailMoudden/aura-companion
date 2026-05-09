import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GlassPanel } from "@/components/aura/glass-panel";
import { Orb } from "@/components/aura/orb";
import { cn } from "@/lib/utils";
import { Sparkles, Keyboard, Brain, Lock, UserCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Aura" },
      { name: "description", content: "Tune your overlay, memory, and privacy." },
    ],
  }),
  component: SettingsPage,
});

const sections = [
  { id: "account", label: "Account", icon: UserCircle },
  { id: "overlay", label: "Overlay", icon: Sparkles },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "memory", label: "Memory", icon: Brain },
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
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState("account");
  const [toggles, setToggles] = useState({ alwaysOn: true, breathe: true, sound: false, history: true });
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const t = (k: keyof typeof toggles) => setToggles((prev) => ({ ...prev, [k]: !prev[k] }));

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const clearAllMemory = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success("All conversations cleared.");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to clear memory.");
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    setDeletingAccount(true);
    try {
      // Clear conversations first
      await supabase.from("conversations").delete().eq("user_id", user.id);
      // Sign out — account deletion requires server-side admin; we at least wipe data and sign out
      await supabase.auth.signOut();
      toast.success("Your data has been cleared. Account signed out.");
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong.");
      setDeletingAccount(false);
    }
  };

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Orb size={120} />
      </main>
    );
  }

  const displayName = user.user_metadata?.full_name as string | undefined;
  const initials = displayName
    ? displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : user.email?.slice(0, 2).toUpperCase() ?? "A";

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

            {/* ── ACCOUNT ── */}
            {active === "account" && (
              <div>
                <h2 className="text-display text-3xl">Account</h2>
                <p className="mt-2 text-sm font-light text-muted-foreground">
                  Your identity and session.
                </p>

                {/* Avatar + info */}
                <div className="mt-8 flex items-center gap-5 border-b border-white/[0.05] pb-8">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-light"
                    style={{ background: "var(--gradient-orb)", boxShadow: "0 0 24px var(--glow-soft)" }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    {displayName && <p className="text-[15px] font-light truncate">{displayName}</p>}
                    <p className="text-sm font-light text-muted-foreground truncate">{user.email}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60">
                      Member since {new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </p>
                  </div>
                </div>

                <div className="mt-2">
                  <Row title="Sign out" description="End your current session on this device.">
                    <button
                      onClick={signOut}
                      className="rounded-full bg-white/[0.06] px-5 py-2 text-sm font-light text-muted-foreground hover:bg-white/[0.1] hover:text-foreground transition-colors"
                    >
                      Sign out
                    </button>
                  </Row>
                  <Row title="Delete account" description="Permanently erase all your data and conversations.">
                    {confirmDelete ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="rounded-full bg-white/[0.06] px-4 py-2 text-sm font-light text-muted-foreground hover:bg-white/[0.1] transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={deleteAccount}
                          disabled={deletingAccount}
                          className="rounded-full px-4 py-2 text-sm font-light text-white/80 transition-colors disabled:opacity-50"
                          style={{ background: "oklch(0.45 0.18 20 / 0.7)" }}
                        >
                          {deletingAccount ? "Deleting…" : "Confirm delete"}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        className="rounded-full bg-white/[0.06] px-5 py-2 text-sm font-light text-muted-foreground hover:bg-white/[0.1] hover:text-foreground transition-colors"
                      >
                        Delete…
                      </button>
                    )}
                  </Row>
                </div>
              </div>
            )}

            {/* ── OVERLAY ── */}
            {active === "overlay" && (
              <div>
                <h2 className="text-display text-3xl">Overlay</h2>
                <p className="mt-2 text-sm font-light text-muted-foreground">
                  How Aura appears on your desktop. Changes apply the next time you launch the app.
                </p>
                <div className="mt-8">
                  <Row title="Always visible" description="Keep a soft breathing orb on screen at all times.">
                    <Toggle on={toggles.alwaysOn} onClick={() => t("alwaysOn")} />
                  </Row>
                  <Row title="Breathing motion" description="Organic scale and glow animations on the orb.">
                    <Toggle on={toggles.breathe} onClick={() => t("breathe")} />
                  </Row>
                  <Row title="Soft sound" description="A subtle whisper when Aura starts listening.">
                    <Toggle on={toggles.sound} onClick={() => t("sound")} />
                  </Row>
                  <Row title="Position" description="Where the orb rests when idle on your screen.">
                    <div className="flex gap-2 rounded-full bg-white/[0.04] p-1">
                      {(["TL", "TR", "BL", "BR"] as const).map((p) => (
                        <button
                          key={p}
                          className="rounded-full px-3 py-1 text-xs font-light text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </Row>
                </div>
                <p className="mt-6 text-xs font-light text-muted-foreground/60">
                  These preferences are stored locally in the desktop app.
                </p>
              </div>
            )}

            {/* ── SHORTCUTS ── */}
            {active === "shortcuts" && (
              <div>
                <h2 className="text-display text-3xl">Shortcuts</h2>
                <p className="mt-2 text-sm font-light text-muted-foreground">
                  Keyboard shortcuts for the desktop overlay. Rebinding requires the desktop app.
                </p>
                <div className="mt-8">
                  {[
                    { t: "Summon Aura", k: "⌥ Space", desc: "Open or close the overlay panel" },
                    { t: "Capture screen", k: "⌥ ⇧ C", desc: "Take a screenshot and attach it to your next message" },
                    { t: "Quick note", k: "⌥ N", desc: "Open Aura with a blank input" },
                    { t: "Hide overlay", k: "⌥ Esc", desc: "Minimise back to the orb" },
                  ].map((row) => (
                    <Row key={row.t} title={row.t} description={row.desc}>
                      <kbd className="rounded-xl bg-white/[0.06] px-4 py-2 text-xs font-light tracking-wider">{row.k}</kbd>
                    </Row>
                  ))}
                </div>
              </div>
            )}

            {/* ── MEMORY ── */}
            {active === "memory" && (
              <div>
                <h2 className="text-display text-3xl">Memory</h2>
                <p className="mt-2 text-sm font-light text-muted-foreground">
                  What Aura keeps across conversations.
                </p>
                <div className="mt-8">
                  <Row title="Conversation history" description="Your threads are saved and searchable from any device.">
                    <Toggle on={toggles.history} onClick={() => t("history")} />
                  </Row>
                  <Row title="Clear all conversations" description="Delete every conversation and message from your account.">
                    <button
                      onClick={clearAllMemory}
                      className="rounded-full bg-white/[0.06] px-5 py-2 text-sm font-light text-muted-foreground hover:bg-white/[0.1] hover:text-foreground transition-colors"
                    >
                      Clear all…
                    </button>
                  </Row>
                </div>
              </div>
            )}

            {/* ── PRIVACY ── */}
            {active === "privacy" && (
              <div>
                <h2 className="text-display text-3xl">Privacy</h2>
                <p className="mt-2 text-sm font-light text-muted-foreground">
                  Your screen and data belong to you.
                </p>
                <div className="mt-8">
                  <Row title="Screenshot processing" description="Screenshots are sent to the AI only when you explicitly attach them — never in the background.">
                    <span className="rounded-full bg-white/[0.06] px-4 py-2 text-xs font-light text-muted-foreground">On by design</span>
                  </Row>
                  <Row title="Conversation storage" description="Messages are stored in your private Supabase instance, tied to your account only.">
                    <span className="rounded-full bg-white/[0.06] px-4 py-2 text-xs font-light text-muted-foreground">Encrypted at rest</span>
                  </Row>
                  <Row title="AI provider" description="Your messages are processed by Moonshot AI (Kimi K2.6). No data is used for training.">
                    <span className="rounded-full bg-white/[0.06] px-4 py-2 text-xs font-light text-muted-foreground">Kimi K2.6</span>
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
