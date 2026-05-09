import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { GlassPanel } from "@/components/aura/glass-panel";
import { Orb } from "@/components/aura/orb";
import { Send, Plus, LogOut, Sparkles, Search, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "Aura, Conversations" }] }),
  component: ChatPage,
});

type Conversation = { id: string; title: string; updated_at: string };
type Message = { id: string; role: "user" | "assistant" | "system"; content: string; created_at: string };

function ChatPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("conversations")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) return toast.error(error.message);
        setConvos(data ?? []);
        if (data && data.length && !activeId) setActiveId(data[0].id);
      });
  }, [user]);

  useEffect(() => {
    if (!activeId) return setMessages([]);
    supabase
      .from("messages")
      .select("id,role,content,created_at")
      .eq("conversation_id", activeId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) return toast.error(error.message);
        setMessages((data as Message[]) ?? []);
      });
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const newConversation = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: "New conversation" })
      .select("id,title,updated_at")
      .single();
    if (error) return toast.error(error.message);
    setConvos((c) => [data as Conversation, ...c]);
    setActiveId(data.id);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;
    setBusy(true);
    let convoId = activeId;
    try {
      if (!convoId) {
        const title = input.slice(0, 40);
        const { data, error } = await supabase
          .from("conversations")
          .insert({ user_id: user.id, title })
          .select("id,title,updated_at")
          .single();
        if (error) throw error;
        convoId = data.id;
        setConvos((c) => [data as Conversation, ...c]);
        setActiveId(convoId);
      }

      const userMsg = { conversation_id: convoId, user_id: user.id, role: "user" as const, content: input.trim() };
      const { data: inserted, error: e1 } = await supabase
        .from("messages")
        .insert(userMsg)
        .select("id,role,content,created_at")
        .single();
      if (e1) throw e1;
      setMessages((m) => [...m, inserted as Message]);
      setInput("");

      // Build history for context (last 20 messages)
      const history = [...messages, inserted as Message]
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      // Call Kimi via Edge Function
      const { data: { session } } = await supabase.auth.getSession();
      const fnRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ messages: history, conversationId: convoId }),
        },
      );
      const fnJson = await fnRes.json() as { reply?: string; error?: string };
      const reply = fnJson.reply ?? "I'm here — something went quiet. Try again?";
      const { data: aiInserted } = await supabase
        .from("messages")
        .insert({ conversation_id: convoId, user_id: user.id, role: "assistant", content: reply })
        .select("id,role,content,created_at")
        .single();
      if (aiInserted) setMessages((m) => [...m, aiInserted as Message]);

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", convoId);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const activeConvo = convos.find((c) => c.id === activeId);
  const filtered = convos.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Orb size={120} />
      </main>
    );
  }

  const lgGridCols = sidebarOpen ? "300px 1fr" : "0px 1fr";
  return (
    <main className="relative pt-24 pb-4 px-3 sm:px-6 sm:pt-28 sm:pb-10">
      <div
        className="mx-auto grid h-[calc(100svh-7rem)] sm:h-[calc(100vh-9rem)] max-w-7xl gap-4 transition-[grid-template-columns] duration-300 grid-cols-1"
        style={{ ['--lg-cols' as any]: lgGridCols }}
      >
        <style>{`@media (min-width: 1024px){ main > div { grid-template-columns: var(--lg-cols) !important; } }`}</style>
        {/* Sidebar */}
        <GlassPanel
          className={`hidden flex-col overflow-hidden p-5 lg:flex ${
            sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          } transition-opacity duration-200`}
        >
          <button
            onClick={newConversation}
            className="mb-5 flex w-full items-center gap-3 rounded-2xl bg-white/[0.07] px-4 py-3 text-sm font-light hover:bg-white/[0.12] transition-colors"
          >
            <Plus className="h-4 w-4" /> New conversation
          </button>
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-2xl bg-white/[0.06] py-2.5 pl-9 pr-3 text-sm font-light placeholder:text-muted-foreground focus:outline-none focus:bg-white/[0.09]"
            />
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto">
            <p className="px-2 pt-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Recent</p>
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-sm font-light text-muted-foreground">No conversations yet.</p>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full truncate rounded-xl px-3 py-2.5 text-left text-sm font-light transition-colors ${
                  c.id === activeId ? "bg-white/[0.1] text-foreground" : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                }`}
              >
                {c.title}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
            <span className="truncate text-xs font-light text-muted-foreground">{user.email}</span>
            <button onClick={signOut} className="rounded-full p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </GlassPanel>

        {/* Conversation */}
        <GlassPanel className="relative flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-8 py-5">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                className="hidden rounded-full p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground lg:inline-flex"
                title={sidebarOpen ? "Hide history" : "Show history"}
              >
                {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </button>
              <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Conversation</p>
              <h1 className="text-display truncate text-2xl">{activeConvo?.title ?? "A new beginning"}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={newConversation}
                className="rounded-full p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                title="New conversation"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={signOut}
                className="rounded-full p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
              <Orb size={36} />
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-10 py-10">
            <div className="mx-auto max-w-2xl space-y-8">
              {messages.length === 0 && (
                <div className="text-center">
                  <p className="text-display text-3xl">What's on your mind?</p>
                  <p className="mt-3 text-sm font-light text-muted-foreground">Aura listens, remembers, and stays soft.</p>
                </div>
              )}
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="ml-auto max-w-md">
                    <div className="rounded-3xl rounded-tr-md bg-white/[0.1] px-5 py-4 text-[15px] font-light">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="max-w-xl">
                    <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      <Sparkles className="h-3 w-3" /> Aura
                    </p>
                    <p className="whitespace-pre-wrap text-[17px] font-light leading-relaxed">{m.content}</p>
                  </div>
                )
              )}
            </div>
          </div>

          <form onSubmit={sendMessage} className="px-4 pb-5 sm:px-8">
            <div className="mx-auto max-w-2xl">
              <GlassPanel strong className="flex items-center gap-2 rounded-full p-2 pl-5">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask softly…"
                  className="flex-1 bg-transparent py-2 text-[15px] font-light placeholder:text-muted-foreground focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="rounded-full p-3 text-[color:var(--primary-foreground)] transition-opacity disabled:opacity-40"
                  style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-glow)" }}
                >
                  <Send className="h-4 w-4" />
                </button>
              </GlassPanel>
            </div>
          </form>
        </GlassPanel>
      </div>
    </main>
  );
}
