import { useEffect, useRef, useState, useCallback } from 'react';
import { Orb } from '@/components/aura/orb';
import { X, Camera, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type OrbState = 'idle' | 'listening' | 'thinking';
type Message = { id: string; role: 'user' | 'assistant'; content: string; screenshot?: string };

const isElectron = typeof window !== 'undefined' && !!window.aura;

// Contextual presence phrases — rotated, never static
const PRESENCE_PHRASES = [
  "I'm here.",
  "What are you working on?",
  "Need another perspective?",
  "Show me.",
  "What are we looking at?",
  "Let's figure this out.",
  "I'm listening.",
  "Something on your mind?",
];

const PANEL_W = 372;
const PANEL_H_IDLE = 231;
const PANEL_H_EXPANDED = 620;
const ORB_W = 72;
const ORB_H = 72;

export function OverlayApp() {
  const [expanded, setExpanded] = useState(false);
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [screenshot, setScreenshot] = useState<{ path: string; preview: string } | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [phraseIndex] = useState(() => Math.floor(Math.random() * PRESENCE_PHRASES.length));
  const [hoveringPanel, setHoveringPanel] = useState(false);
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
    });
    return unsub;
  }, []);

  const hasConversation = messages.length > 0;

  useEffect(() => {
    if (!isElectron) return;
    if (!expanded) {
      window.aura!.updateDimensions(ORB_W, ORB_H);
      return;
    }
    window.aura!.updateDimensions(PANEL_W, hasConversation ? PANEL_H_EXPANDED : PANEL_H_IDLE);
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (expanded) setTimeout(() => inputRef.current?.focus(), 200);
  }, [expanded]);

  const collapse = useCallback(() => { setExpanded(false); }, []);

  const captureScreenshot = useCallback(async () => {
    if (!isElectron) return;
    setOrbState('thinking');
    const result = await window.aura!.takeScreenshot();
    if (result.success && result.path && result.preview) {
      setScreenshot({ path: result.path, preview: result.preview });
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

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: userContent, screenshot: attachedScreenshot };
    setMessages((m) => [...m, userMsg]);

    // Expand to full height once conversation starts
    if (isElectron) window.aura!.updateDimensions(PANEL_W, PANEL_H_EXPANDED);

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
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: reply }]);

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

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setScreenshot(null);
    if (isElectron) window.aura!.updateDimensions(PANEL_W, PANEL_H_IDLE);
  }, []);

  // ─── Idle orb button ─────────────────────────────────────────────────────────
  if (!expanded) {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ background: 'transparent' }}>
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center justify-center rounded-full outline-none animate-breathe"
          style={{ width: 52, height: 52, background: 'transparent', border: 'none', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          title="Open Aura (Alt+Space)"
        >
          <Orb size={52} state={orbState} variant="overlay" noHalo />
        </button>
      </div>
    );
  }

  // ─── Expanded panel ───────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ background: 'transparent' }}>
      <div
        className="relative flex flex-col overflow-hidden"
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 28,
          background: 'linear-gradient(160deg, oklch(0.55 0.10 238 / 0.94) 0%, oklch(0.44 0.10 252 / 0.94) 60%, oklch(0.38 0.08 262 / 0.96) 100%)',
          backdropFilter: 'blur(64px) saturate(180%)',
          WebkitBackdropFilter: 'blur(64px) saturate(180%)',
          border: '1px solid oklch(1 0 0 / 0.09)',
          boxShadow: 'inset 0 1px 0 oklch(1 0 0 / 0.12), 0 48px 120px -24px oklch(0.05 0.02 260 / 0.7)',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
        onMouseEnter={() => setHoveringPanel(true)}
        onMouseLeave={() => setHoveringPanel(false)}
      >
        {/* Ambient glass shimmer */}
        <div className="pointer-events-none absolute inset-0" style={{ borderRadius: 28, background: 'linear-gradient(135deg, oklch(1 0 0 / 0.07) 0%, transparent 50%, oklch(1 0 0 / 0.02) 100%)' }} />

        {/* ── Drag handle (invisible strip at top) ── */}
        <div
          className="absolute inset-x-0 top-0 h-10"
          style={{ WebkitAppRegion: 'drag', zIndex: 0 } as React.CSSProperties}
        />

        {/* ── Top controls — visible only on hover ── */}
        <div
          className={cn(
            'absolute right-3 top-3 z-20 flex items-center gap-1 transition-all duration-500',
            hoveringPanel ? 'opacity-100' : 'opacity-0',
          )}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {hasConversation && (
            <ControlBtn onClick={clearConversation} title="Clear">
              <X className="h-3.5 w-3.5" />
            </ControlBtn>
          )}
          <ControlBtn onClick={captureScreenshot} title="Capture screen">
            <Camera className="h-3.5 w-3.5" />
          </ControlBtn>
          <ControlBtn onClick={collapse} title="Minimise">
            <ChevronDown className="h-3.5 w-3.5" />
          </ControlBtn>
        </div>

        {/* ── ORB + presence — the emotional center ── */}
        {!hasConversation && (
          <div
            className="relative flex flex-col items-center justify-center"
            style={{ paddingTop: 38, paddingBottom: 24 }}
            onClick={() => inputRef.current?.focus()}
          >
            {/* Diffuse glow — floats with the orb */}
            <div
              className="absolute rounded-full blur-3xl animate-glow-pulse animate-float"
              style={{
                width: 150,
                height: 150,
                background: 'radial-gradient(circle, oklch(0.82 0.16 235 / 0.55), transparent 70%)',
                top: 6,
              }}
            />
            {/* Orb animates exactly like landing "Ambient intelligence" section */}
            <div className="animate-float">
              <Orb size={64} state={orbState} variant="overlay" noHalo />
            </div>
            <p
              className="mt-9 text-display text-[17px] font-light text-foreground/80"
              style={{ letterSpacing: '-0.01em' }}
            >
              {busy ? 'Thinking…' : PRESENCE_PHRASES[phraseIndex]}
            </p>
          </div>
        )}

        {/* ── Conversation ── */}
        {hasConversation && (
          <div className="relative flex-1 overflow-hidden">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10"
              style={{ background: 'linear-gradient(to bottom, oklch(0.52 0.10 242 / 0.9), transparent)' }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10"
              style={{ background: 'linear-gradient(to top, oklch(0.40 0.09 256 / 0.9), transparent)' }}
            />
            <div ref={scrollRef} className="h-full overflow-y-auto px-6 pt-12 pb-4">
              <div className="flex flex-col gap-6">
                {messages.map((m) =>
                  m.role === 'user'
                    ? <UserBubble key={m.id} message={m} />
                    : <AssistantBubble key={m.id} message={m} />
                )}
                {busy && <ThinkingPulse />}
              </div>
            </div>
          </div>
        )}

        {/* Screenshot thumbnail — floats above input if present */}
        {screenshot && !hasConversation && (
          <div className="relative mx-6 mb-2 overflow-hidden rounded-2xl" style={{ background: 'oklch(1 0 0 / 0.05)' }}>
            <img src={screenshot.preview} alt="" className="h-28 w-full object-cover opacity-80" style={{ filter: 'brightness(0.9)' }} />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-1.5" style={{ background: 'linear-gradient(to top, oklch(0.1 0.04 260 / 0.55), transparent)' }}>
              <p className="text-[10px] font-light text-foreground/50">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <button onClick={clearScreenshot} className="text-foreground/30 hover:text-foreground/60 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* ── Floating input — almost invisible ── */}
        <div className="px-8 pb-7" style={{ flexShrink: 0 }}>
          <form onSubmit={sendMessage}>
            <div
              className={cn(
                'flex w-full items-center gap-3 rounded-full px-5 transition-all duration-500',
                inputFocused || input.length > 0
                  ? 'bg-white/[0.10] ring-1 ring-white/[0.14]'
                  : 'bg-white/[0.06]',
              )}
              style={{ height: 44 }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="Ask softly…"
                className="flex-1 bg-transparent text-[13px] font-light italic text-foreground placeholder:text-foreground/50 focus:outline-none"
              />
              {/* Send: subtle glow dot, not paper-plane */}
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className={cn(
                  'shrink-0 h-5 w-5 rounded-full transition-all duration-300',
                  input.trim() && !busy
                    ? 'opacity-90 scale-100'
                    : 'opacity-0 scale-75 pointer-events-none',
                )}
                style={{
                  background: 'radial-gradient(circle, oklch(0.92 0.10 220), oklch(0.72 0.18 245))',
                  boxShadow: input.trim() ? '0 0 12px oklch(0.82 0.16 235 / 0.6)' : 'none',
                }}
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Thinking pulse ───────────────────────────────────────────────────────────
function ThinkingPulse() {
  return (
    <div className="flex items-center gap-2 px-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full animate-pulse"
          style={{
            background: 'oklch(0.82 0.16 235 / 0.6)',
            animationDelay: `${i * 0.18}s`,
            boxShadow: '0 0 6px oklch(0.82 0.16 235 / 0.4)',
          }}
        />
      ))}
    </div>
  );
}

// ─── Bubbles ──────────────────────────────────────────────────────────────────
function UserBubble({ message }: { message: Message }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[82%]">
        {message.screenshot && (
          <img src={message.screenshot} alt="" className="mb-2 w-full rounded-2xl object-cover opacity-60" />
        )}
        <div
          className="rounded-3xl rounded-tr-sm px-4 py-2.5 text-[13px] font-light leading-relaxed text-foreground/90"
          style={{ background: 'oklch(1 0 0 / 0.09)', border: '1px solid oklch(1 0 0 / 0.06)' }}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

function AssistantBubble({ message }: { message: Message }) {
  return (
    <div className="max-w-[95%]">
      <p className="text-display text-[16px] font-light leading-relaxed text-foreground/88">{message.content}</p>
    </div>
  );
}

// ─── Control button (top-right, hover-only) ───────────────────────────────────
function ControlBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded-full text-foreground/35 transition-all duration-200 hover:bg-white/[0.08] hover:text-foreground/70"
    >
      {children}
    </button>
  );
}
