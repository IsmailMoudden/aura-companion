import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { GlassPanel } from "@/components/aura/glass-panel";
import { Orb } from "@/components/aura/orb";
import { Send, Plus, Search, LogOut, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "Aura — Conversations" }] }),
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

      // Placeholder soft assistant reply (no AI call yet)
      const reply = "I'm here, listening. Tell me a little more — what's underneath that?";
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

  const filtered = convos.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));
  const activeConvo = convos.find((c) => c.id === activeId);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Orb size={120} />
      </main>
    );
  }

  return (
    <main className="relative pt-28 pb-10 px-4 sm:px-6">
      <div className="mx-auto h-[calc(100vh-9rem)] max-w-4xl">
        {/* Conversation */}
        <GlassPanel className="relative flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-8 py-5">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Conversation</p>
              <h1 className="text-display truncate text-2xl">{activeConvo?.title ?? "A new beginning"}</h1>
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
