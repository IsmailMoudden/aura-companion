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
    if (!expanded) { window.aura!.updateDimensions(60, 60); return; }
    window.aura!.updateDimensions(480, compact ? 148 : 640);
  }, [expanded, compact]);


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

  const subtitle = busy ? 'Thinking…' : screenshot ? 'Looking at your screen' : messages.length > 0 ? 'In conversation' : 'Your ambient companion';

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
          compact={compact}
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
          className="relative flex items-center justify-center rounded-full outline-none animate-breathe"
          style={{ width: 52, height: 52, WebkitAppRegion: 'no-drag', background: 'transparent', border: 'none', opacity: 0.72 } as React.CSSProperties}
          title="Open Aura  (Alt+Space)"
        >
          <Orb size={52} state={orbState} variant="overlay" noHalo />
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
  compact: boolean;
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
        width: '100%',
        height: '100%',
        background: 'oklch(0.68 0.09 232 / 0.85)',
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

      {!p.compact && (
        <div className="relative flex-1 overflow-hidden">
          {/* Fade top */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6"
            style={{ background: 'linear-gradient(to bottom, oklch(0.68 0.09 232 / 0.85), transparent)' }} />
          {/* Fade bottom */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6"
            style={{ background: 'linear-gradient(to top, oklch(0.68 0.09 232 / 0.85), transparent)' }} />

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
      )}

      {p.compact && <div className="flex-1" />}
      <InputBar
        input={p.input}
        setInput={p.setInput}
        busy={p.busy}
        onSend={p.onSend}
        inputRef={p.inputRef}
        hasMessages={p.messages.length > 0}
        onClear={p.onClearConversation}
        compact={p.compact}
        onQuickAction={p.onQuickAction}
        screenshot={p.screenshot}
      />
      {p.compact && <div className="flex-1" />}
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({ orbState, subtitle, onCapture, onCollapse }: {
  orbState: OrbState; subtitle: string; onCapture: () => void; onCollapse: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Orb */}
      <div className="shrink-0 ml-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <Orb size={26} state={orbState} variant="overlay" noHalo />
      </div>

      {/* Title — left-aligned, serif italic */}
      <div className="flex-1 min-w-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <p className="text-display text-[14px] italic text-white/70 truncate" style={{ fontStyle: 'italic' }}>
          {subtitle}
        </p>
      </div>

      {/* Right controls */}
      <div className="flex shrink-0 items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <HdrBtn onClick={onCapture} title="Capture screen (Alt+Shift+C)">
          <Camera className="h-4 w-4" />
        </HdrBtn>
        <HdrBtn onClick={onCollapse} title="Minimise">
          <ChevronDown className="h-4 w-4" />
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
      className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white/90"
    >
      {children}
    </button>
  );
}

// ─── Home view (screenshot present) ─────────────────────────────────────────
function HomeView({ screenshot, busy, messages, onQuickAction, onClearScreenshot, onSwitchToChat }: {
  screenshot: { path: string; preview: string } | null;
  busy: boolean;
  messages: Message[];
  onQuickAction: (p: string) => void;
  onClearScreenshot: () => void;
  onSwitchToChat: () => void;
}) {
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  if (!screenshot) return null;

  return (
    <div className="flex h-full flex-col px-4 pb-2 pt-1">
      {/* Screenshot card */}
      <div className="relative overflow-hidden rounded-2xl" style={{ background: 'oklch(1 0 0 / 0.06)' }}>
        <img src={screenshot.preview} alt="Your screen" className="h-48 w-full object-cover" style={{ filter: 'brightness(0.9)' }} />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-2"
          style={{ background: 'linear-gradient(to top, oklch(0.1 0.04 260 / 0.5), transparent)' }}>
          <p className="text-[11px] font-light text-white/50">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          <button onClick={onClearScreenshot} className="rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white/70">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* AI response */}
      <div className="mt-3 flex-1">
        {busy ? (
          <p className="text-display italic text-[14px] text-white/40">Thinking…</p>
        ) : lastAssistant ? (
          <p className="text-display italic text-[15px] leading-relaxed text-white/85">
            {lastAssistant.content}
          </p>
        ) : (
          <p className="text-display italic text-[14px] text-white/50">
            What would you like to know?
          </p>
        )}
      </div>
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
    <div ref={scrollRef} className="h-full overflow-y-auto px-4 py-3">
      <div className="flex flex-col gap-5">
        {messages.map((m) =>
          m.role === 'user' ? <UserBubble key={m.id} message={m} /> : <AssistantBubble key={m.id} message={m} />
        )}
        {busy && (
          <p className="text-display italic text-[14px] text-white/35 animate-pulse">
            Thinking…
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Input bar ────────────────────────────────────────────────────────────────
function InputBar({ input, setInput, busy, onSend, inputRef, hasMessages, onClear, compact, onQuickAction, screenshot }: {
  input: string;
  setInput: (v: string) => void;
  busy: boolean;
  onSend: (e: React.FormEvent) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  hasMessages: boolean;
  onClear: () => void;
  compact: boolean;
  onQuickAction: (p: string) => void;
  screenshot: { path: string; preview: string } | null;
}) {
  const hasText = input.trim().length > 0;

  return (
    <div className={cn('px-3', compact ? 'pb-3 pt-1' : 'pb-3 pt-1')}>
      {/* Input row */}
      <form onSubmit={onSend}>
        <div
          className="flex items-center gap-2 rounded-full px-4"
          style={{
            background: 'oklch(1 0 0 / 0.04)',
            border: '1px solid oklch(1 0 0 / 0.08)',
          }}
        >
          {hasMessages && (
            <button
              type="button"
              onClick={onClear}
              className="shrink-0 text-white/25 transition-colors hover:text-white/60"
              title="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask softly…"
            className="flex-1 bg-transparent py-3 text-display text-[14px] italic text-white placeholder:text-white/30 focus:outline-none"
            style={{ fontStyle: 'italic' }}
          />
          <button
            type="submit"
            disabled={busy || !hasText}
            className={cn(
              'shrink-0 transition-all duration-200',
              hasText && !busy ? 'text-white/80 hover:text-white' : 'text-white/20 pointer-events-none',
            )}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>

      {/* Quick actions — only in compact mode (no conversation yet) */}
      {compact && !screenshot && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              onClick={() => onQuickAction(a.prompt)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-light text-white/50 transition-all hover:bg-white/8 hover:text-white/80"
              style={{ background: 'oklch(1 0 0 / 0.05)', border: '1px solid oklch(1 0 0 / 0.07)' }}
            >
              <a.icon className="h-3 w-3" />
              {a.label}
            </button>
          ))}
        </div>
      )}
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
          className="rounded-3xl rounded-tr-md px-4 py-2.5 text-[14px] font-light leading-relaxed text-white/90"
          style={{ background: 'oklch(1 0 0 / 0.10)', border: '1px solid oklch(1 0 0 / 0.08)' }}
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
      <p className="text-display italic text-[15px] leading-relaxed text-white/85">
        {message.content}
      </p>
    </div>
  );
}
