import { useEffect, useRef, useState, useCallback } from 'react';
import { Orb } from '@/components/aura/orb';
import { Send, X, Camera, Sparkles, ChevronDown, Zap, BookOpen, Languages } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type OrbState = 'idle' | 'listening' | 'thinking';
type Message = { id: string; role: 'user' | 'assistant'; content: string; screenshot?: string };
type PanelView = 'home' | 'chat';

const isElectron = typeof window !== 'undefined' && !!window.aura;

// Quick-action prompts shown when a screenshot is present
const QUICK_ACTIONS = [
  { icon: Zap, label: 'Summarize', prompt: 'Please summarize what you see on my screen.' },
  { icon: BookOpen, label: 'Explain', prompt: 'Explain what is happening on my screen in simple terms.' },
  { icon: Languages, label: 'Translate', prompt: 'Translate any text visible on my screen.' },
];

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

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUser({ id: data.session.user.id, email: data.session.user.email ?? '' });
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? '' } : null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Screenshot from main process
  useEffect(() => {
    if (!isElectron) return;
    const unsub = window.aura!.onScreenshotTaken((data) => {
      setScreenshot(data);
      setExpanded(true);
      setView('home');
    });
    return unsub;
  }, []);

  // Tell Electron how big to make the window
  useEffect(() => {
    if (!isElectron) return;
    const w = expanded ? 500 : 96;
    const h = expanded ? 720 : 96;
    window.aura!.updateDimensions(w, h);
  }, [expanded]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  // Focus input when entering chat
  useEffect(() => {
    if (view === 'chat') setTimeout(() => inputRef.current?.focus(), 150);
  }, [view]);

  const collapse = useCallback(() => {
    setExpanded(false);
    setView('home');
  }, []);

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

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userContent,
      screenshot: attachedScreenshot,
    };
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
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
      setMessages((m) => [...m, {
        id: crypto.randomUUID(), role: 'assistant', content: 'Something went quiet. Try again?',
      }]);
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

  // ── Subtitle text in header changes with context ──────────────────────────
  const subtitle = busy
    ? 'Thinking…'
    : screenshot
      ? 'Looking at your screen'
      : messages.length > 0
        ? 'In conversation'
        : 'Your ambient companion';

  return (
    <div className="flex h-full w-full items-center justify-center">
      {expanded ? (
        <Panel
          view={view}
          orbState={orbState}
          subtitle={subtitle}
          messages={messages}
          input={input}
          setInput={setInput}
          busy={busy}
          screenshot={screenshot}
          onSend={sendMessage}
          onQuickAction={runQuickAction}
          onCollapse={collapse}
          onCapture={captureScreenshot}
          onClearScreenshot={clearScreenshot}
          onClearConversation={clearConversation}
          onSwitchToChat={() => setView('chat')}
          scrollRef={scrollRef}
          inputRef={inputRef}
        />
      ) : (
        <button
          onClick={() => setExpanded(true)}
          className="relative flex items-center justify-center rounded-full outline-none"
          style={{ width: 80, height: 80, WebkitAppRegion: 'no-drag', background: 'transparent', border: 'none' } as React.CSSProperties}
          title="Open Aura  (Alt+Space)"
        >
          <Orb size={80} state={orbState} variant="overlay" />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel
// ─────────────────────────────────────────────────────────────────────────────
interface PanelProps {
  view: PanelView;
  orbState: OrbState;
  subtitle: string;
  messages: Message[];
  input: string;
  setInput: (v: string) => void;
  busy: boolean;
  screenshot: { path: string; preview: string } | null;
  onSend: (e: React.FormEvent) => void;
  onQuickAction: (prompt: string) => void;
  onCollapse: () => void;
  onCapture: () => void;
  onClearScreenshot: () => void;
  onClearConversation: () => void;
  onSwitchToChat: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

function Panel(p: PanelProps) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-[2rem]"
      style={{
        width: 468,
        height: 692,
        background: 'oklch(0.68 0.09 232 / 0.82)',
        backdropFilter: 'blur(40px) saturate(160%)',
        WebkitBackdropFilter: 'blur(40px) saturate(160%)',
        boxShadow: '0 40px 120px -20px oklch(0.1 0.04 260 / 0.55), inset 0 1px 0 oklch(1 0 0 / 0.12)',
        border: '1px solid oklch(1 0 0 / 0.1)',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
    >
      <Header
        orbState={p.orbState}
        subtitle={p.subtitle}
        onCapture={p.onCapture}
        onCollapse={p.onCollapse}
      />

      <div className="flex-1 overflow-hidden">
        {p.view === 'home' ? (
          <HomeView
            screenshot={p.screenshot}
            busy={p.busy}
            messages={p.messages}
            onQuickAction={p.onQuickAction}
            onClearScreenshot={p.onClearScreenshot}
            onSwitchToChat={p.onSwitchToChat}
          />
        ) : (
          <ChatView
            messages={p.messages}
            busy={p.busy}
            scrollRef={p.scrollRef}
          />
        )}
      </div>

      <InputBar
        input={p.input}
        setInput={p.setInput}
        busy={p.busy}
        onSend={p.onSend}
        inputRef={p.inputRef}
        hasMessages={p.messages.length > 0}
        onClear={p.onClearConversation}
      />
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({
  orbState, subtitle, onCapture, onCollapse,
}: {
  orbState: OrbState; subtitle: string;
  onCapture: () => void; onCollapse: () => void;
}) {
  return (
    <div
      className="flex items-center px-5 py-4"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Orb — left */}
      <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <Orb size={40} state={orbState} variant="overlay" />
      </div>

      {/* Center label */}
      <div className="flex-1 text-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <p className="text-[9px] uppercase tracking-[0.35em] text-white/50">Aura</p>
        <p className="mt-0.5 text-[15px] font-light text-white/90">{subtitle}</p>
      </div>

      {/* Camera + collapse — right */}
      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <HdrBtn onClick={onCapture} title="Capture screen (Alt+Shift+C)">
          <Camera className="h-[17px] w-[17px]" />
        </HdrBtn>
        <HdrBtn onClick={onCollapse} title="Minimise">
          <ChevronDown className="h-[17px] w-[17px]" />
        </HdrBtn>
      </div>
    </div>
  );
}

function HdrBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white/90"
    >
      {children}
    </button>
  );
}

// ─── Home view ────────────────────────────────────────────────────────────────
// Shows: screenshot card (if present) + last AI reply + quick-action pills
function HomeView({
  screenshot, busy, messages, onQuickAction, onClearScreenshot, onSwitchToChat,
}: {
  screenshot: { path: string; preview: string } | null;
  busy: boolean;
  messages: Message[];
  onQuickAction: (p: string) => void;
  onClearScreenshot: () => void;
  onSwitchToChat: () => void;
}) {
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  return (
    <div className="flex h-full flex-col px-5 pb-2">
      {screenshot ? (
        <>
          {/* Screenshot card */}
          <div className="relative overflow-hidden rounded-2xl" style={{ background: 'oklch(1 0 0 / 0.06)' }}>
            <img
              src={screenshot.preview}
              alt="Your screen"
              className="h-52 w-full object-cover"
              style={{ filter: 'brightness(0.92)' }}
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-2"
              style={{ background: 'linear-gradient(to top, oklch(0.1 0.04 260 / 0.5), transparent)' }}
            >
              <p className="text-[11px] font-light text-white/60">
                Screenshot · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <button
                onClick={onClearScreenshot}
                className="rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white/80"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* AI response or thinking indicator */}
          <div className="mt-4 flex-1">
            {busy ? (
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 animate-glow-pulse text-white/50" />
                <span className="text-[13px] font-light text-white/50">Thinking…</span>
              </div>
            ) : lastAssistant ? (
              <p className="text-center text-[15px] font-light leading-relaxed text-white/90">
                {lastAssistant.content}
              </p>
            ) : (
              <p className="text-center text-[14px] font-light text-white/60">
                What would you like to know about your screen?
              </p>
            )}
          </div>

          {/* Quick-action pills */}
          {!busy && (
            <div className="mt-4 flex flex-wrap justify-center gap-2 pb-1">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  onClick={() => onQuickAction(a.prompt)}
                  className="flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-light text-white/80 transition-all hover:bg-white/15 hover:text-white"
                  style={{
                    background: 'oklch(1 0 0 / 0.08)',
                    border: '1px solid oklch(1 0 0 / 0.1)',
                  }}
                >
                  <a.icon className="h-3.5 w-3.5 text-white/60" />
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        /* No screenshot — empty home */
        <div className="flex h-full flex-col items-center justify-center text-center">
          <Orb size={80} state="idle" variant="overlay" />
          <p className="mt-6 text-display text-2xl text-white/90">What's on your mind?</p>
          <p className="mt-2 text-[13px] font-light text-white/50">
            Aura sees your screen and stays in flow.
          </p>
          {isElectron && (
            <button
              onClick={onSwitchToChat}
              className="mt-8 flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-light text-white/70 transition-all hover:bg-white/10 hover:text-white/90"
              style={{ background: 'oklch(1 0 0 / 0.06)', border: '1px solid oklch(1 0 0 / 0.08)' }}
            >
              Start a conversation
            </button>
          )}
          {isElectron && (
            <p className="mt-4 text-[11px] text-white/30">Alt+Shift+C  to capture screen</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Chat view ────────────────────────────────────────────────────────────────
function ChatView({
  messages, busy, scrollRef,
}: {
  messages: Message[];
  busy: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={scrollRef} className="h-full overflow-y-auto px-5 pb-2 pt-2">
      <div className="space-y-5">
        {messages.map((m) =>
          m.role === 'user' ? (
            <UserBubble key={m.id} message={m} />
          ) : (
            <AssistantBubble key={m.id} message={m} />
          ),
        )}
        {busy && (
          <div className="flex items-center gap-2 text-white/40">
            <Sparkles className="h-3 w-3 animate-glow-pulse" />
            <span className="text-[13px] font-light">Thinking…</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Input bar ────────────────────────────────────────────────────────────────
function InputBar({
  input, setInput, busy, onSend, inputRef, hasMessages, onClear,
}: {
  input: string;
  setInput: (v: string) => void;
  busy: boolean;
  onSend: (e: React.FormEvent) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  hasMessages: boolean;
  onClear: () => void;
}) {
  return (
    <div className="px-4 pb-5 pt-2">
      <form onSubmit={onSend}>
        <div
          className="flex items-center gap-2 rounded-full pl-4 pr-1.5"
          style={{
            background: 'oklch(1 0 0 / 0.08)',
            border: '1px solid oklch(1 0 0 / 0.1)',
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask softly…"
            className="flex-1 bg-transparent py-3 text-[14px] font-light text-white placeholder:text-white/35 focus:outline-none"
          />
          {hasMessages && (
            <button
              type="button"
              onClick={onClear}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/30 transition-colors hover:bg-white/10 hover:text-white/60"
              title="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className={cn(
              'my-1 flex h-8 w-8 items-center justify-center rounded-full text-white transition-opacity',
              busy || !input.trim() ? 'opacity-25' : 'opacity-100',
            )}
            style={{ background: 'var(--gradient-hero)', boxShadow: busy || !input.trim() ? 'none' : 'var(--shadow-glow)' }}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Bubbles ──────────────────────────────────────────────────────────────────
function UserBubble({ message }: { message: Message }) {
  return (
    <div className="ml-auto max-w-[82%]">
      {message.screenshot && (
        <img src={message.screenshot} alt="" className="mb-2 w-full rounded-2xl object-cover opacity-75" />
      )}
      <div
        className="rounded-3xl rounded-tr-md px-4 py-3 text-[14px] font-light leading-relaxed text-white/90"
        style={{ background: 'oklch(1 0 0 / 0.12)' }}
      >
        {message.content}
      </div>
    </div>
  );
}

function AssistantBubble({ message }: { message: Message }) {
  return (
    <div className="max-w-[90%]">
      <p className="mb-1.5 text-[9px] uppercase tracking-[0.25em] text-white/35">Aura</p>
      <p className="whitespace-pre-wrap text-[15px] font-light leading-relaxed text-white/90">
        {message.content}
      </p>
    </div>
  );
}
