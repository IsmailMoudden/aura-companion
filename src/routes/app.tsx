import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { GlassPanel } from "@/components/aura/glass-panel";
import { Orb } from "@/components/aura/orb";
import {
  Send, Plus, LogOut, Sparkles, Search,
  PanelLeftClose, PanelLeftOpen, LayoutDashboard,
  MessageSquare, Settings, Brain, Lock, UserCircle,
  ChevronDown, CheckSquare, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { MODELS, LIMIT_CONTACT, getModelLabel, type ModelId } from "@/lib/models";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "Aura, Your workspace" }] }),
  component: AppPage,
});

type View = "dashboard" | "chat" | "settings";
type SettingsTab = "account" | "memory" | "privacy";
type Conversation = { id: string; title: string; updated_at: string };
type Message = { id: string; role: "user" | "assistant" | "system"; content: string; created_at: string };

// Extract tasks from assistant messages (lines starting with - [ ] or numbered)
function extractTasks(messages: Message[]): { text: string; convoTitle: string; convoId: string }[] {
  const tasks: { text: string; convoTitle: string; convoId: string }[] = [];
  return tasks; // placeholder — populated in dashboard via conversation scan
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function AppPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // ── View state ──────────────────────────────────────────────────────────────
  const [view, setView] = useState<View>("dashboard");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("account");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ── Conversations ───────────────────────────────────────────────────────────
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");

  // ── Chat ────────────────────────────────────────────────────────────────────
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>("auto");
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Settings ────────────────────────────────────────────────────────────────
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // ── Load conversations ──────────────────────────────────────────────────────
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

  // ── Load messages for active conversation ───────────────────────────────────
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

  // ── Handlers ────────────────────────────────────────────────────────────────
  const openConvo = useCallback((id: string) => {
    setActiveId(id);
    setView("chat");
    setMobileSidebarOpen(false);
  }, []);

  const newConversation = useCallback(async () => {
    if (!user) return;
    const active = convos.find((c) => c.id === activeId);
    if (active && active.title === "New conversation" && messages.length === 0) {
      setView("chat");
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: "New conversation" })
      .select("id,title,updated_at")
      .single();
    if (error) return toast.error(error.message);
    setConvos((c) => [data as Conversation, ...c]);
    setActiveId(data.id);
    setMessages([]);
    setInput("");
    setView("chat");
    setMobileSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [user, convos, activeId, messages.length]);

  const sendMessage = useCallback(async (e: React.FormEvent) => {
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

      const history = [...messages, inserted as Message]
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      const { data: { session } } = await supabase.auth.getSession();
      const fnRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ messages: history, conversationId: convoId, model: selectedModel }),
      });
      const fnJson = await fnRes.json() as { reply?: string; error?: string };
      if (fnRes.status === 429) {
        toast.error(`Limit reached for ${getModelLabel(selectedModel)}. Contact ${LIMIT_CONTACT.email}.`, { duration: 8000 });
        setBusy(false);
        return;
      }
      const reply = fnJson.reply ?? "Something went quiet. Try again?";
      const { data: aiInserted } = await supabase
        .from("messages")
        .insert({ conversation_id: convoId, user_id: user.id, role: "assistant", content: reply })
        .select("id,role,content,created_at")
        .single();
      if (aiInserted) setMessages((m) => [...m, aiInserted as Message]);
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convoId);
      setConvos((prev) => prev.map((c) => c.id === convoId ? { ...c, updated_at: new Date().toISOString() } : c));
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send");
    } finally {
      setBusy(false);
    }
  }, [input, user, activeId, messages, selectedModel]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }, [navigate]);

  const clearAllMemory = useCallback(async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from("conversations").delete().eq("user_id", user.id);
      if (error) throw error;
      setConvos([]);
      setMessages([]);
      setActiveId(null);
      toast.success("All conversations cleared.");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to clear memory.");
    }
  }, [user]);

  const deleteAccount = useCallback(async () => {
    if (!user) return;
    setDeletingAccount(true);
    try {
      await supabase.from("conversations").delete().eq("user_id", user.id);
      await supabase.auth.signOut();
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong.");
      setDeletingAccount(false);
    }
  }, [user, navigate]);

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
  const activeConvo = convos.find((c) => c.id === activeId);
  const filtered = convos.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));
  const recentConvos = convos.slice(0, 6);

  // Sidebar nav items
  const navItems: { id: View; icon: typeof LayoutDashboard; label: string }[] = [
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { id: "chat", icon: MessageSquare, label: "Chat" },
    { id: "settings", icon: Settings, label: "Settings" },
  ];

  return (
    <main className="relative pt-24 pb-4 px-3 sm:px-6 sm:pt-28 sm:pb-10">
      <div
        className={cn(
          "mx-auto grid h-[calc(100svh-7rem)] sm:h-[calc(100vh-9rem)] max-w-7xl gap-4 grid-cols-1 transition-[grid-template-columns] duration-300",
          sidebarOpen ? "lg:grid-cols-[260px_1fr]" : "lg:grid-cols-[0px_1fr]"
        )}
      >
        {/* ── SIDEBAR ── */}
        <GlassPanel
          className={cn(
            "hidden flex-col overflow-hidden p-4 lg:flex transition-opacity duration-200",
            sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          {/* User avatar + name */}
          <div className="mb-5 flex items-center gap-3 px-2">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-light"
              style={{ background: "var(--gradient-orb)", boxShadow: "0 0 16px var(--glow-soft)" }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-light">{displayName ?? user.email}</p>
              <p className="text-[10px] text-muted-foreground/60 truncate">{user.email}</p>
            </div>
          </div>

          {/* View switcher */}
          <ul className="mb-4 space-y-1">
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setView(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-light transition-colors",
                    view === item.id
                      ? "bg-white/[0.09] text-foreground"
                      : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="mx-2 mb-4 h-px bg-white/[0.06]" />

          {/* New conversation */}
          <button
            onClick={newConversation}
            className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-2.5 text-sm font-light text-muted-foreground hover:bg-white/[0.1] hover:text-foreground transition-colors"
          >
            <Plus className="h-4 w-4" /> New conversation
          </button>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-2xl bg-white/[0.05] py-2.5 pl-9 pr-3 text-sm font-light placeholder:text-muted-foreground focus:outline-none focus:bg-white/[0.08]"
            />
          </div>

          {/* Conversation list */}
          <div className="flex-1 space-y-0.5 overflow-y-auto">
            <p className="px-2 pt-1 pb-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Recent</p>
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-sm font-light text-muted-foreground">No conversations yet.</p>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => openConvo(c.id)}
                className={cn(
                  "w-full truncate rounded-xl px-3 py-2.5 text-left text-sm font-light transition-colors",
                  c.id === activeId && view === "chat"
                    ? "bg-white/[0.1] text-foreground"
                    : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                )}
              >
                {c.title}
              </button>
            ))}
          </div>

          {/* Sign out */}
          <div className="mt-4 border-t border-white/[0.06] pt-4">
            <button
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-light text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </GlassPanel>

        {/* ── MOBILE SIDEBAR ── */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <GlassPanel
              strong
              className="absolute left-3 top-3 bottom-3 flex w-[82vw] max-w-[280px] flex-col overflow-hidden p-4 animate-fade-up"
            >
              <ul className="mb-4 space-y-1">
                {navItems.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => { setView(item.id); setMobileSidebarOpen(false); }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-light transition-colors",
                        view === item.id ? "bg-white/[0.09] text-foreground" : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mx-2 mb-4 h-px bg-white/[0.06]" />
              <button
                onClick={() => { newConversation(); }}
                className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-2.5 text-sm font-light text-muted-foreground hover:bg-white/[0.1] hover:text-foreground transition-colors"
              >
                <Plus className="h-4 w-4" /> New conversation
              </button>
              <div className="flex-1 space-y-0.5 overflow-y-auto">
                {convos.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openConvo(c.id)}
                    className="w-full truncate rounded-xl px-3 py-2.5 text-left text-sm font-light text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors"
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            </GlassPanel>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        <GlassPanel className="relative flex flex-col overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-4 sm:px-6">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="hidden rounded-full p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground lg:inline-flex"
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="inline-flex rounded-full p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground lg:hidden"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {view === "dashboard" ? "Overview" : view === "chat" ? "Conversation" : "Settings"}
              </p>
              <h1 className="text-display truncate text-xl sm:text-2xl">
                {view === "dashboard"
                  ? "Good to see you."
                  : view === "chat"
                  ? (activeConvo?.title ?? "A new beginning")
                  : "Your preferences."}
              </h1>
            </div>

            {view === "chat" && (
              <div className="flex shrink-0 items-center gap-1">
                {/* Model picker */}
                <div className="relative">
                  <button
                    onClick={() => setModelPickerOpen((v) => !v)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-light transition-colors hover:bg-white/10",
                      modelPickerOpen ? "bg-white/10 text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {MODELS.find((m) => m.id === selectedModel)?.label}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  {modelPickerOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setModelPickerOpen(false)} />
                      <div className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-white/[0.08] bg-[oklch(0.18_0.04_250)] shadow-xl animate-fade-in">
                        {MODELS.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => { setSelectedModel(m.id); setModelPickerOpen(false); }}
                            className={cn(
                              "flex w-full items-center px-4 py-2.5 text-left text-sm font-light transition-colors hover:bg-white/[0.06]",
                              selectedModel === m.id ? "text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={newConversation}
                  className="rounded-full p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  title="New conversation"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}

            <Orb size={28} className="hidden sm:block opacity-70 shrink-0" />
          </div>

          {/* ── DASHBOARD VIEW ── */}
          {view === "dashboard" && (
            <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
              <div className="mx-auto max-w-4xl space-y-8">

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {[
                    { label: "Conversations", value: convos.length, icon: MessageSquare },
                    { label: "This week", value: convos.filter(c => Date.now() - new Date(c.updated_at).getTime() < 7 * 86400000).length, icon: Clock },
                    { label: "Model", value: MODELS.find(m => m.id === selectedModel)?.label ?? "Auto", icon: Sparkles },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-3xl border border-white/[0.07] bg-white/[0.04] px-5 py-4"
                    >
                      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.07] text-[color:var(--glow-soft)]">
                        <stat.icon className="h-3.5 w-3.5" />
                      </div>
                      <p className="text-2xl font-light">{stat.value}</p>
                      <p className="mt-0.5 text-xs font-light text-muted-foreground uppercase tracking-[0.15em]">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Recent conversations */}
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Recent conversations</p>
                    <button
                      onClick={() => setView("chat")}
                      className="text-xs font-light text-muted-foreground hover:text-foreground transition-colors"
                    >
                      See all
                    </button>
                  </div>
                  {recentConvos.length === 0 ? (
                    <div className="rounded-3xl border border-white/[0.07] bg-white/[0.03] px-6 py-10 text-center">
                      <p className="text-display text-xl text-foreground/60">No conversations yet.</p>
                      <p className="mt-2 text-sm font-light text-muted-foreground">Start one and Aura will remember everything.</p>
                      <button
                        onClick={newConversation}
                        className="mt-6 rounded-full bg-white/[0.08] px-6 py-2.5 text-sm font-light text-foreground/80 hover:bg-white/[0.12] transition-colors"
                      >
                        Start a conversation
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {recentConvos.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => openConvo(c.id)}
                          className="group flex flex-col gap-2 rounded-3xl border border-white/[0.07] bg-white/[0.03] px-5 py-4 text-left transition-all duration-300 hover:bg-white/[0.07] hover:border-white/[0.12]"
                        >
                          <p className="truncate text-[15px] font-light group-hover:text-foreground transition-colors">{c.title}</p>
                          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                            <Clock className="h-3 w-3" />
                            {timeAgo(c.updated_at)}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick actions */}
                <div>
                  <p className="mb-4 text-xs uppercase tracking-[0.25em] text-muted-foreground">Quick actions</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { label: "New conversation", desc: "Start fresh with Aura", icon: Plus, action: newConversation },
                      { label: "Memory settings", desc: "Manage what Aura keeps", icon: Brain, action: () => { setView("settings"); setSettingsTab("memory"); } },
                    ].map((qa) => (
                      <button
                        key={qa.label}
                        onClick={qa.action}
                        className="flex items-center gap-4 rounded-3xl border border-white/[0.07] bg-white/[0.03] px-5 py-4 text-left transition-all duration-300 hover:bg-white/[0.07] hover:border-white/[0.12]"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[color:var(--glow-soft)]">
                          <qa.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[14px] font-light">{qa.label}</p>
                          <p className="text-[12px] text-muted-foreground">{qa.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── CHAT VIEW ── */}
          {view === "chat" && (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-10 py-6 sm:py-10">
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
                  {busy && (
                    <div className="max-w-xl animate-fade-in">
                      <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        <Sparkles className="h-3 w-3" /> Aura
                      </p>
                      <div className="flex items-center gap-4">
                        <Orb size={28} state="thinking" />
                        <span className="text-[15px] font-light italic text-muted-foreground">Reflecting…</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <form onSubmit={sendMessage} className="px-4 pb-5 sm:px-8">
                <div className="mx-auto max-w-2xl">
                  <GlassPanel strong className="flex items-center gap-2 rounded-full p-2 pl-5">
                    <input
                      ref={inputRef}
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
            </>
          )}

          {/* ── SETTINGS VIEW ── */}
          {view === "settings" && (
            <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
              <div className="mx-auto max-w-2xl">

                {/* Settings tab switcher */}
                <div className="mb-8 flex gap-1 rounded-2xl bg-white/[0.04] p-1">
                  {([
                    { id: "account", label: "Account", icon: UserCircle },
                    { id: "memory", label: "Memory", icon: Brain },
                    { id: "privacy", label: "Privacy", icon: Lock },
                  ] as { id: SettingsTab; label: string; icon: typeof UserCircle }[]).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSettingsTab(tab.id)}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-light transition-colors",
                        settingsTab === tab.id
                          ? "bg-white/[0.1] text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <tab.icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* ACCOUNT */}
                {settingsTab === "account" && (
                  <div className="space-y-px">
                    <div className="mb-6 flex items-center gap-4 rounded-3xl border border-white/[0.07] bg-white/[0.03] px-6 py-5">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-light"
                        style={{ background: "var(--gradient-orb)", boxShadow: "0 0 20px var(--glow-soft)" }}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        {displayName && <p className="text-[15px] font-light">{displayName}</p>}
                        <p className="text-sm font-light text-muted-foreground truncate">{user.email}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
                          Member since {new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </p>
                      </div>
                    </div>

                    <SettingsRow title="Sign out" desc="End your current session on this device.">
                      <button
                        onClick={signOut}
                        className="rounded-full bg-white/[0.06] px-5 py-2 text-sm font-light text-muted-foreground hover:bg-white/[0.1] hover:text-foreground transition-colors"
                      >
                        Sign out
                      </button>
                    </SettingsRow>

                    <SettingsRow title="Delete account" desc="Permanently erase all your data and conversations.">
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
                            className="rounded-full px-4 py-2 text-sm font-light text-white/80 disabled:opacity-50 transition-colors"
                            style={{ background: "oklch(0.45 0.18 20 / 0.7)" }}
                          >
                            {deletingAccount ? "Deleting…" : "Confirm"}
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
                    </SettingsRow>
                  </div>
                )}

                {/* MEMORY */}
                {settingsTab === "memory" && (
                  <div className="space-y-px">
                    <SettingsRow title="Conversation history" desc="Your threads are saved and searchable from any device.">
                      <span className="rounded-full bg-white/[0.06] px-4 py-2 text-xs font-light text-muted-foreground">Always on</span>
                    </SettingsRow>
                    <SettingsRow title={`${convos.length} conversations`} desc="Total threads stored in your account.">
                      <span className="rounded-full bg-white/[0.06] px-4 py-2 text-xs font-light text-muted-foreground tabular-nums">{convos.length}</span>
                    </SettingsRow>
                    <SettingsRow title="Clear all conversations" desc="Delete every conversation and message from your account.">
                      <button
                        onClick={clearAllMemory}
                        className="rounded-full bg-white/[0.06] px-5 py-2 text-sm font-light text-muted-foreground hover:bg-white/[0.1] hover:text-foreground transition-colors"
                      >
                        Clear all…
                      </button>
                    </SettingsRow>
                  </div>
                )}

                {/* PRIVACY */}
                {settingsTab === "privacy" && (
                  <div className="space-y-px">
                    <SettingsRow title="Screenshot processing" desc="Screenshots are sent to the AI only when you explicitly attach them, never in the background.">
                      <span className="rounded-full bg-white/[0.06] px-4 py-2 text-xs font-light text-muted-foreground">On by design</span>
                    </SettingsRow>
                    <SettingsRow title="Conversation storage" desc="Messages are stored in your private Supabase instance, tied to your account only.">
                      <span className="rounded-full bg-white/[0.06] px-4 py-2 text-xs font-light text-muted-foreground">Encrypted at rest</span>
                    </SettingsRow>
                    <SettingsRow title="AI provider" desc="Your messages are processed by Moonshot AI (Kimi K2.6). No data is used for training.">
                      <span className="rounded-full bg-white/[0.06] px-4 py-2 text-xs font-light text-muted-foreground">Kimi K2.6</span>
                    </SettingsRow>
                  </div>
                )}

              </div>
            </div>
          )}
        </GlassPanel>
      </div>
    </main>
  );
}

function SettingsRow({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-8 rounded-2xl px-1 py-5 border-b border-white/[0.05] last:border-0">
      <div>
        <p className="text-[15px] font-light">{title}</p>
        <p className="mt-1 text-sm font-light text-muted-foreground">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
