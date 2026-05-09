import { createFileRoute } from "@tanstack/react-router";
import { GlassPanel } from "@/components/aura/glass-panel";
import { Orb } from "@/components/aura/orb";
import { Send, Mic, Paperclip, Plus, Search, Pin, Image as ImageIcon, Sparkles } from "lucide-react";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Aura — Conversations" },
      { name: "description", content: "A calm conversational space with your ambient AI." },
      { property: "og:title", content: "Aura — Conversations" },
      { property: "og:description", content: "Threads, memories, and screenshots — woven together." },
    ],
  }),
  component: ChatPage,
});

const conversations = [
  "Quarterly report read-through",
  "Naming the new product",
  "Designing a calmer Monday",
  "Letter to my sister",
  "Reading list — late spring",
];

const memories = [
  "Sister's birthday — May 22",
  "Prefers em-dashes",
  "Working title: 'Aura'",
];

function ChatPage() {
  return (
    <main className="relative pt-28 pb-10 px-4 sm:px-6">
      <div className="mx-auto grid h-[calc(100vh-9rem)] max-w-7xl gap-4 lg:grid-cols-[300px_1fr]">
        {/* Sidebar */}
        <GlassPanel className="hidden flex-col overflow-hidden p-5 lg:flex">
          <button className="mb-5 flex w-full items-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-3 text-sm font-light hover:bg-white/[0.08] transition-colors">
            <Plus className="h-4 w-4" /> New conversation
          </button>
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search memory…"
              className="w-full rounded-2xl bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm font-light placeholder:text-muted-foreground focus:outline-none focus:bg-white/[0.06]"
            />
          </div>
          <div className="space-y-1 overflow-y-auto">
            <p className="px-2 pt-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Recent</p>
            {conversations.map((c, i) => (
              <button
                key={c}
                className={`w-full truncate rounded-xl px-3 py-2.5 text-left text-sm font-light transition-colors ${
                  i === 0 ? "bg-white/[0.07] text-foreground" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
            <p className="mt-6 px-2 pt-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Pinned memories</p>
            {memories.map((m) => (
              <div key={m} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-light text-muted-foreground">
                <Pin className="h-3 w-3" /> {m}
              </div>
            ))}
            <p className="mt-6 px-2 pt-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Screenshots</p>
            <div className="grid grid-cols-3 gap-2 px-2 pt-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg"
                  style={{ background: `linear-gradient(${135 + i * 20}deg, oklch(0.4 0.1 ${260 + i * 10}), oklch(0.25 0.06 ${280 + i * 5}))` }}
                />
              ))}
            </div>
          </div>
        </GlassPanel>

        {/* Conversation */}
        <GlassPanel className="relative flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.05] px-8 py-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Conversation</p>
              <h1 className="text-display text-2xl">Quarterly report read-through</h1>
            </div>
            <Orb size={36} />
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-10 py-10">
            <div className="mx-auto max-w-2xl space-y-10">
              {/* User */}
              <div className="ml-auto max-w-md">
                <div className="rounded-3xl rounded-tr-md bg-white/[0.06] px-5 py-4 text-[15px] font-light">
                  Can you read this report and tell me what's actually being said
                  between the lines?
                </div>
              </div>

              {/* Screenshot attachment */}
              <div className="ml-auto max-w-sm">
                <div
                  className="aspect-[16/10] rounded-2xl"
                  style={{
                    background: "linear-gradient(135deg, oklch(0.4 0.08 280), oklch(0.25 0.06 260))",
                    boxShadow: "var(--shadow-soft)",
                  }}
                />
                <p className="mt-2 text-right text-xs text-muted-foreground">Q2-report.pdf · 18 pages</p>
              </div>

              {/* Aura */}
              <div className="max-w-xl">
                <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <Sparkles className="h-3 w-3" /> Aura
                </p>
                <div className="space-y-4 text-[17px] font-light leading-relaxed">
                  <p>
                    On the surface, this is a confident quarter. Underneath it,
                    three quieter currents:
                  </p>
                  <ul className="space-y-2 pl-1">
                    <li>— Revenue strength leans heavily on two enterprise accounts.</li>
                    <li>— EU margin compression isn't named, but the table tells.</li>
                    <li>— Hiring language has shifted from "expanding" to "selective".</li>
                  </ul>
                  <p>
                    Want me to draft a soft note to your team about what to watch
                    next quarter?
                  </p>
                </div>
              </div>

              {/* Memory card */}
              <GlassPanel className="mx-auto max-w-md p-4">
                <div className="flex items-center gap-3 text-sm font-light">
                  <Pin className="h-3.5 w-3.5 text-[color:var(--glow-soft)]" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Memory saved</p>
                    <p>Three risks for Q2 — flagged for next review</p>
                  </div>
                </div>
              </GlassPanel>
            </div>
          </div>

          {/* Suggestions + Input */}
          <div className="px-4 pb-5 sm:px-8">
            <div className="mx-auto max-w-2xl">
              <div className="mb-3 flex flex-wrap gap-2">
                {["Draft the note", "Compare with Q1", "List action items"].map((s) => (
                  <button key={s} className="rounded-full bg-white/[0.04] px-4 py-1.5 text-xs font-light text-muted-foreground hover:bg-white/[0.08] hover:text-foreground transition-colors">
                    {s}
                  </button>
                ))}
              </div>
              <GlassPanel strong className="flex items-center gap-2 rounded-full p-2 pl-5">
                <input
                  placeholder="Ask softly…"
                  className="flex-1 bg-transparent py-2 text-[15px] font-light placeholder:text-muted-foreground focus:outline-none"
                />
                <button className="rounded-full p-2 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors">
                  <Paperclip className="h-4 w-4" />
                </button>
                <button className="rounded-full p-2 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors">
                  <ImageIcon className="h-4 w-4" />
                </button>
                <button className="rounded-full p-2 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors">
                  <Mic className="h-4 w-4" />
                </button>
                <button
                  className="rounded-full p-3 text-[color:var(--primary-foreground)]"
                  style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-glow)" }}
                >
                  <Send className="h-4 w-4" />
                </button>
              </GlassPanel>
            </div>
          </div>
        </GlassPanel>
      </div>
    </main>
  );
}
