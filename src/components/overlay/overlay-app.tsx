import { useEffect, useRef, useState, useCallback } from 'react';
import { Orb } from '@/components/aura/orb';
import { Send, X, Camera, ChevronDown, Zap, BookOpen, Languages } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type OrbState = 'idle' | 'listening' | 'thinking';
type Message = { id: string; role: 'user' | 'assistant'; content: string; screenshot?: string };
type PanelView = 'home' | 'chat';

const isElectron = typeof window !== 'undefined' && !!window.aura;

const QUICK_ACTIONS = [
  { icon: Zap, label: 'Summarize', prompt: 'Please summarize what you see on my screen.' },
  { icon: BookOpen, label: 'Explain', prompt: 'Explain what is happening on my screen in simple terms.' },
  { icon: Languages, label: 'Translate', prompt: 'Translate any text visible on my screen.' },
];

// Fixed panel dimensions — window is exactly these sizes
const PANEL_W = 372;
const PANEL_H_COMPACT = 231;
const PANEL_H_EXPANDED = 660;
const ORB_W = 72;
const ORB_H = 72;

export function OverlayApp() {
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<PanelView>('home');
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [screenshot, setScreenshot] = useState<{ path: string; preview: string } | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user)
        setUser({ id: data.session.user.id, email: data.session.user.email ?? '' });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? '' } : null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isElectron) return;
    const unsub = window.aura!.onScreenshotTaken((data) => {
      setScreenshot(data);
      setExpanded(true);
      setView('home');
    });
    return unsub;
  }, []);

  const hasContent = messages.length > 0 || screenshot !== null;
  const compact = !hasContent;

  useEffect(() => {
    if (!isElectron) return;
    if (!expanded) {
      window.aura!.updateDimensions(ORB_W, ORB_H);
      return;
    }
    // Only set default size — user can freely resize after this
    window.aura!.updateDimensions(PANEL_W, compact ? PANEL_H_COMPACT : PANEL_H_EXPANDED);
  }, [expanded]); // intentionally omit compact — don't snap size when content appears

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (expanded) setTimeout(() => inputRef.current?.focus(), 150);
  }, [expanded]);

  const collapse = useCallback(() => { setExpanded(false); setView('home'); }, []);

  const captureScreenshot = useCallback(async () => {
    if (!isElectron) return;
    setOrbState('thinking');
    const result = await window.aura!.takeScreenshot();
    if (result.success && result.path && result.preview) {
      setScreenshot({ path: result.path, preview: result.preview });
      setView('home');
    }
    setOrbState('idle');
  }, []);

  const clearScreenshot = useCallback(async () => {
    if (!screenshot) return;
    if (isElectron) await window.aura!.clearScreenshot(screenshot.path);
    setScreenshot(null);
  }, [screenshot]);

  const runAI = useCallback(async (userContent: string, attachedScreenshot?: string) => {
    if (busy) return;
    setBusy(true);
    setOrbState('thinking');
    setView('chat');

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: userContent, screenshot: attachedScreenshot };
    setMessages((m) => [...m, userMsg]);

    try {
      let convoId = conversationId;
      if (!convoId && user) {
        const { data, error } = await supabase
          .from('conversations')
          .insert({ user_id: user.id, title: userContent.slice(0, 40) })
          .select('id').single();
        if (!error && data) { convoId = data.id; setConversationId(convoId); }
      }
      if (user && convoId) {
        await supabase.from('messages').insert({
          conversation_id: convoId, user_id: user.id, role: 'user', content: userContent,
        });
      }

      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const body: Record<string, unknown> = {
        messages: [...history, { role: 'user', content: userContent }],
        conversationId: convoId,
      };
      if (attachedScreenshot) body.screenshot = attachedScreenshot;

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify(body),
      });

      const json = await res.json() as { reply?: string };
      const reply = json.reply ?? "I'm here — something went quiet.";
      const assistantMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: reply };
      setMessages((m) => [...m, assistantMsg]);

      if (user && convoId) {
        await supabase.from('messages').insert({
          conversation_id: convoId, user_id: user.id, role: 'assistant', content: reply,
        });
      }
      if (attachedScreenshot) clearScreenshot();
    } catch {
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: 'Something went quiet. Try again?' }]);
    } finally {
      setBusy(false);
      setOrbState('idle');
    }
  }, [busy, messages, conversationId, user, clearScreenshot]);

  const sendMessage = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    void runAI(text, screenshot?.preview);
  }, [input, screenshot, runAI]);

  const runQuickAction = useCallback((prompt: string) => {
    void runAI(prompt, screenshot?.preview);
  }, [screenshot, runAI]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setScreenshot(null);
    setView('home');
  }, []);

  const subtitle = busy
    ? 'Thinking…'
    : screenshot
      ? 'Looking at your screen'
      : messages.length > 0
        ? 'In conversation'
        : 'Your ambient companion';

  // Root fills the Electron window — transparent outside the rounded panel
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: 'transparent' }}
    >
      {expanded ? (
        // Panel fills the window — resize the window to resize the panel
        <div
          className="relative flex flex-col overflow-hidden"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 28,
            // Ambient gradient base — same palette as the web
            background: 'linear-gradient(135deg, oklch(0.58 0.10 240 / 0.92) 0%, oklch(0.48 0.10 250 / 0.92) 50%, oklch(0.42 0.09 260 / 0.92) 100%)',
            backdropFilter: 'blur(48px) saturate(180%)',
            WebkitBackdropFilter: 'blur(48px) saturate(180%)',
            border: '1px solid oklch(1 0 0 / 0.10)',
            boxShadow: 'inset 0 1px 0 oklch(1 0 0 / 0.14), 0 40px 100px -20px oklch(0.05 0.02 260 / 0.6)',
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
        >
          {/* Glass overlay layer — matches web glass-strong */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: 28,
              background: 'linear-gradient(135deg, oklch(1 0 0 / 0.08), oklch(1 0 0 / 0.02))',
            }}
          />
          {/* ── Header ── */}
          <div
            className="relative flex items-center gap-3 px-6"
            style={{ height: 64, WebkitAppRegion: 'drag', flexShrink: 0 } as React.CSSProperties}
          >
            <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <Orb size={32} state={orbState} variant="overlay" noHalo />
            </div>
            <div className="flex-1 min-w-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/70">Aura</p>
              <p className="text-[15px] font-light text-foreground/90 truncate">{subtitle}</p>
            </div>
            <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <HdrBtn onClick={captureScreenshot} title="Capture screen (Alt+Shift+C)">
                <Camera className="h-[18px] w-[18px]" />
              </HdrBtn>
              <HdrBtn onClick={collapse} title="Minimise">
                <ChevronDown className="h-[18px] w-[18px]" />
              </HdrBtn>
            </div>
          </div>

          {/* ── Divider ── */}
          <div style={{ height: 1, background: 'var(--border)', flexShrink: 0 }} />

          {/* ── Body (hidden in compact) ── */}
          {!compact && (
            <div className="relative flex-1 overflow-hidden">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8"
                style={{ background: 'linear-gradient(to bottom, oklch(0.52 0.10 248 / 0.80), transparent)' }}
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8"
                style={{ background: 'linear-gradient(to top, oklch(0.44 0.09 258 / 0.80), transparent)' }}
              />
              {view === 'home' ? (
                <HomeView
                  screenshot={screenshot}
                  busy={busy}
                  messages={messages}
                  onQuickAction={runQuickAction}
                  onClearScreenshot={clearScreenshot}
                />
              ) : (
                <ChatView messages={messages} busy={busy} scrollRef={scrollRef} />
              )}
            </div>
          )}

          {/* ── Input bar ── */}
          <div className={cn('px-5', compact ? 'flex flex-1 flex-col items-center justify-center pb-5' : 'pb-5 pt-3')} style={compact ? {} : { flexShrink: 0 }}>
            {/* Quick actions above input in compact */}
            {compact && (
              <div className="mb-4 flex w-full items-center justify-center gap-2">
                {QUICK_ACTIONS.map((a) => (
                  <button
                    key={a.label}
                    onClick={() => runQuickAction(a.prompt)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-light text-muted-foreground transition-all hover:text-foreground"
                    style={{ background: 'oklch(1 0 0 / 0.06)', border: '1px solid var(--border)' }}
                  >
                    <a.icon className="h-3 w-3" />
                    {a.label}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={sendMessage} className="w-full">
              <div
                className="flex w-full items-center gap-2 rounded-full px-4"
                style={{
                  height: 48,
                  background: 'oklch(1 0 0 / 0.07)',
                  border: '1px solid var(--border)',
                }}
              >
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={clearConversation}
                    className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask softly…"
                  className="flex-1 bg-transparent text-[14px] font-light text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                  style={{ fontStyle: 'italic' }}
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className={cn(
                    'shrink-0 transition-all duration-200',
                    input.trim() && !busy ? 'text-foreground/80 hover:text-foreground' : 'text-muted-foreground/30 pointer-events-none',
                  )}
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center justify-center rounded-full outline-none animate-breathe"
          style={{
            width: 52,
            height: 52,
            background: 'transparent',
            border: 'none',
            opacity: 0.88,
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
          title="Open Aura (Alt+Space)"
        >
          <Orb size={52} state={orbState} variant="overlay" noHalo />
        </button>
      )}
    </div>
  );
}

// ─── Home view ────────────────────────────────────────────────────────────────
function HomeView({ screenshot, busy, messages, onQuickAction, onClearScreenshot }: {
  screenshot: { path: string; preview: string } | null;
  busy: boolean;
  messages: Message[];
  onQuickAction: (p: string) => void;
  onClearScreenshot: () => void;
}) {
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  if (!screenshot) return null;

  return (
    <div className="flex h-full flex-col gap-4 px-5 py-4">
      {/* Screenshot card */}
      <div className="relative overflow-hidden rounded-2xl" style={{ background: 'oklch(1 0 0 / 0.05)' }}>
        <img
          src={screenshot.preview}
          alt="Your screen"
          className="h-44 w-full object-cover"
          style={{ filter: 'brightness(0.88)' }}
        />
        <div
          className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-2"
          style={{ background: 'linear-gradient(to top, oklch(0.1 0.04 260 / 0.6), transparent)' }}
        >
          <p className="text-[11px] font-light text-muted-foreground">
            Screenshot · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          <button onClick={onClearScreenshot} className="rounded-full p-1 text-white/40 hover:text-white/70">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* AI response */}
      <div className="flex-1">
        {busy ? (
          <p className="text-[14px] font-light italic text-muted-foreground/70">Thinking…</p>
        ) : lastAssistant ? (
          <p className="text-[15px] font-light leading-relaxed text-foreground/90">{lastAssistant.content}</p>
        ) : (
          <p className="text-[14px] font-light italic text-muted-foreground">What would you like to know?</p>
        )}
      </div>

      {/* Quick actions */}
      {!busy && (
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              onClick={() => onQuickAction(a.prompt)}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-light text-muted-foreground transition-all hover:text-foreground"
              style={{ background: 'oklch(1 0 0 / 0.07)', border: '1px solid var(--border)' }}
            >
              <a.icon className="h-3.5 w-3.5" />
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Chat view ────────────────────────────────────────────────────────────────
function ChatView({ messages, busy, scrollRef }: {
  messages: Message[];
  busy: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={scrollRef} className="h-full overflow-y-auto px-5 py-4">
      <div className="flex flex-col gap-5">
        {messages.map((m) =>
          m.role === 'user' ? <UserBubble key={m.id} message={m} /> : <AssistantBubble key={m.id} message={m} />
        )}
        {busy && (
          <p className="text-[14px] font-light italic text-muted-foreground/60 animate-pulse">Thinking…</p>
        )}
      </div>
    </div>
  );
}

// ─── Bubbles ──────────────────────────────────────────────────────────────────
function UserBubble({ message }: { message: Message }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%]">
        {message.screenshot && (
          <img src={message.screenshot} alt="" className="mb-2 w-full rounded-2xl object-cover opacity-70" />
        )}
        <div
          className="rounded-3xl rounded-tr-sm px-4 py-2.5 text-[14px] font-light leading-relaxed text-foreground"
          style={{ background: 'oklch(1 0 0 / 0.10)', border: '1px solid var(--border)' }}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

function AssistantBubble({ message }: { message: Message }) {
  return (
    <div className="max-w-[92%]">
      <p className="mb-1 text-[9px] uppercase tracking-[0.25em] text-muted-foreground/70">Aura</p>
      <p className="text-[15px] font-light leading-relaxed text-foreground/90">{message.content}</p>
    </div>
  );
}

// ─── Header button ────────────────────────────────────────────────────────────
function HdrBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
    >
      {children}
    </button>
  );
}
