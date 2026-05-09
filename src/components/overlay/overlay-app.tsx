import { useEffect, useRef, useState, useCallback } from 'react';
import { Orb } from '@/components/aura/orb';
import { X, Camera, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type OrbState = 'idle' | 'listening' | 'thinking';
type Message = { id: string; role: 'user' | 'assistant'; content: string; screenshot?: string };

const isElectron = typeof window !== 'undefined' && !!window.aura;

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

// The Electron window is always this large when expanded — the PANEL animates inside it
const WIN_W = 400;
const WIN_H = 640;
const ORB_W = 72;
const ORB_H = 72;

// Panel visual sizes — CSS animated, not window resizes
const PANEL_W_IDLE = 340;
const PANEL_H_IDLE = 200;
const PANEL_W_CONV = 380;
const PANEL_H_CONV_BASE = 320; // grows with messages, max WIN_H - 20
const PANEL_RADIUS_IDLE = 36;
const PANEL_RADIUS_CONV = 28;

export function OverlayApp() {
  const [expanded, setExpanded] = useState(false);
  const [panelReady, setPanelReady] = useState(false); // delay content render for open animation
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
      handleExpand();
    });
    return unsub;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasConversation = messages.length > 0;

  // Panel height grows with content, capped at window height
  const panelH = hasConversation
    ? Math.min(WIN_H - 20, PANEL_H_CONV_BASE + messages.length * 24)
    : PANEL_H_IDLE;

  const handleExpand = useCallback(() => {
    if (isElectron) window.aura!.updateDimensions(WIN_W, WIN_H);
    setExpanded(true);
    // Small delay so the window has time to open before we show content
    setTimeout(() => setPanelReady(true), 60);
    setTimeout(() => inputRef.current?.focus(), 240);
  }, []);

  const collapse = useCallback(() => {
    setPanelReady(false);
    // Let content fade before collapsing window
    setTimeout(() => {
      setExpanded(false);
      if (isElectron) window.aura!.updateDimensions(ORB_W, ORB_H);
    }, 280);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const captureScreenshot = useCallback(async () => {
    if (!isElectron) return;
    setOrbState('thinking');
    const result = await window.aura!.takeScreenshot();
    if (result.success && result.path && result.preview) setScreenshot({ path: result.path, preview: result.preview });
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
        await supabase.from('messages').insert({ conversation_id: convoId, user_id: user.id, role: 'user', content: userContent });
      }

      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const body: Record<string, unknown> = { messages: [...history, { role: 'user', content: userContent }], conversationId: convoId };
      if (attachedScreenshot) body.screenshot = attachedScreenshot;

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify(body),
      });

      const json = await res.json() as { reply?: string };
      const reply = json.reply ?? "Something went quiet.";
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: reply }]);

      if (user && convoId) {
        await supabase.from('messages').insert({ conversation_id: convoId, user_id: user.id, role: 'assistant', content: reply });
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
  }, []);

  // ─── Idle orb ────────────────────────────────────────────────────────────────
  if (!expanded) {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ background: 'transparent' }}>
        <button
          onClick={handleExpand}
          className="flex items-center justify-center rounded-full outline-none animate-breathe"
          style={{ width: 52, height: 52, background: 'transparent', border: 'none', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          title="Open Aura (Alt+Space)"
        >
          <Orb size={52} state={orbState} variant="overlay" noHalo />
        </button>
      </div>
    );
  }

  // ─── Expanded — window is WIN_W × WIN_H, panel animates inside ───────────────
  const panelW = hasConversation ? PANEL_W_CONV : PANEL_W_IDLE;
  const radius = hasConversation ? PANEL_RADIUS_CONV : PANEL_RADIUS_IDLE;

  return (
    <div
      className="flex h-full w-full items-end justify-center"
      style={{ background: 'transparent', paddingBottom: 10 }}
    >
      <div
        className={cn('relative flex flex-col overflow-hidden')}
        style={{
          width: panelW,
          height: panelReady ? panelH : PANEL_H_IDLE * 0.6,
          borderRadius: radius,
          // Deep layered background — not a flat rectangle
          background: [
            'radial-gradient(ellipse 80% 60% at 30% 20%, oklch(0.72 0.14 228 / 0.4), transparent)',
            'radial-gradient(ellipse 60% 80% at 80% 80%, oklch(0.52 0.12 255 / 0.35), transparent)',
            'linear-gradient(160deg, oklch(0.52 0.10 238 / 0.96) 0%, oklch(0.40 0.09 254 / 0.97) 100%)',
          ].join(', '),
          backdropFilter: 'blur(72px) saturate(200%)',
          WebkitBackdropFilter: 'blur(72px) saturate(200%)',
          border: '1px solid oklch(1 0 0 / 0.10)',
          boxShadow: [
            'inset 0 1px 0 oklch(1 0 0 / 0.15)',
            'inset 0 -1px 0 oklch(0 0 0 / 0.08)',
            '0 32px 80px -12px oklch(0.05 0.02 260 / 0.65)',
            '0 0 0 0.5px oklch(0 0 0 / 0.12)',
          ].join(', '),
          // The organic animation — cubic-bezier like Dynamic Island
          transition: 'width 0.55s cubic-bezier(0.34, 1.36, 0.64, 1), height 0.6s cubic-bezier(0.34, 1.36, 0.64, 1), border-radius 0.5s ease',
          opacity: panelReady ? 1 : 0,
          transform: panelReady ? 'scale(1)' : 'scale(0.92)',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
        onMouseEnter={() => setHoveringPanel(true)}
        onMouseLeave={() => setHoveringPanel(false)}
      >
        {/* Top shimmer light — gives depth */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 rounded-t-[inherit]"
          style={{ height: '45%', background: 'linear-gradient(180deg, oklch(1 0 0 / 0.06) 0%, transparent 100%)', zIndex: 0 }}
        />
        {/* Ambient radial light from center */}
        <div
          className="pointer-events-none absolute"
          style={{
            inset: '-30%',
            background: 'radial-gradient(ellipse 50% 50% at 50% 35%, oklch(0.78 0.14 232 / 0.12), transparent 70%)',
            zIndex: 0,
          }}
        />

        {/* ── Drag strip ── */}
        <div className="absolute inset-x-0 top-0 h-8" style={{ WebkitAppRegion: 'drag', zIndex: 1 } as React.CSSProperties} />

        {/* ── Controls — hover only ── */}
        <div
          className={cn(
            'absolute right-3 top-3 z-20 flex items-center gap-0.5 transition-all duration-500',
            hoveringPanel ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1',
          )}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {hasConversation && (
            <ControlBtn onClick={clearConversation} title="Clear">
              <X className="h-3 w-3" />
            </ControlBtn>
          )}
          <ControlBtn onClick={captureScreenshot} title="Capture screen">
            <Camera className="h-3 w-3" />
          </ControlBtn>
          <ControlBtn onClick={collapse} title="Minimise">
            <ChevronDown className="h-3 w-3" />
          </ControlBtn>
        </div>

        {/* ── PRESENCE ZONE — orb + phrase ── */}
        {!hasConversation && panelReady && (
          <div
            className="relative z-10 flex flex-col items-center justify-center"
            style={{ paddingTop: 36, paddingBottom: 28 }}
            onClick={() => inputRef.current?.focus()}
          >
            {/* Diffuse halo behind orb */}
            <div
              className="absolute rounded-full blur-3xl animate-glow-pulse"
              style={{
                width: 160,
                height: 160,
                top: 12,
                background: 'radial-gradient(circle, oklch(0.82 0.16 235 / 0.50), transparent 70%)',
              }}
            />
            <div className="animate-float relative z-10">
              <Orb size={68} state={orbState} variant="overlay" noHalo />
            </div>
            <p
              className="relative z-10 mt-10 text-display font-light text-foreground/82"
              style={{ fontSize: 17, letterSpacing: '-0.01em', lineHeight: 1.35 }}
            >
              {busy ? 'Thinking…' : PRESENCE_PHRASES[phraseIndex]}
            </p>
          </div>
        )}

        {/* ── CONVERSATION ZONE ── */}
        {hasConversation && panelReady && (
          <div className="relative z-10 flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            {/* Fade edges */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12" style={{ background: 'linear-gradient(to bottom, oklch(0.46 0.10 246 / 0.95), transparent)' }} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12" style={{ background: 'linear-gradient(to top, oklch(0.41 0.09 254 / 0.95), transparent)' }} />
            <div ref={scrollRef} className="h-full overflow-y-auto" style={{ padding: '48px 28px 16px' }}>
              <div className="flex flex-col gap-7">
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

        {/* Screenshot thumbnail */}
        {screenshot && !hasConversation && panelReady && (
          <div className="relative z-10 mx-7 mb-3 overflow-hidden rounded-2xl" style={{ background: 'oklch(1 0 0 / 0.05)' }}>
            <img src={screenshot.preview} alt="" className="h-24 w-full object-cover" style={{ opacity: 0.75, filter: 'brightness(0.88)' }} />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-1.5" style={{ background: 'linear-gradient(to top, oklch(0.1 0.04 260 / 0.5), transparent)' }}>
              <p className="text-[10px] font-light text-foreground/45">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              <button onClick={clearScreenshot} className="text-foreground/30 hover:text-foreground/60 transition-colors"><X className="h-3 w-3" /></button>
            </div>
          </div>
        )}

        {/* ── INPUT ZONE — floats at bottom ── */}
        {panelReady && (
          <div
            className="relative z-10 flex-shrink-0"
            style={{ padding: '10px 20px 20px' }}
          >
            <form onSubmit={sendMessage}>
              <div
                className={cn(
                  'flex items-center gap-3 rounded-full transition-all duration-500',
                  inputFocused || input.length > 0
                    ? 'ring-1 ring-white/[0.18]'
                    : '',
                )}
                style={{
                  height: 46,
                  paddingLeft: 20,
                  paddingRight: 16,
                  background: inputFocused || input.length > 0
                    ? 'oklch(1 0 0 / 0.09)'
                    : 'oklch(1 0 0 / 0.055)',
                  transition: 'background 0.4s ease, box-shadow 0.4s ease',
                  boxShadow: inputFocused ? 'inset 0 1px 0 oklch(1 0 0 / 0.10)' : 'none',
                }}
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder="Ask softly…"
                  className="flex-1 bg-transparent text-[13px] font-light italic text-foreground placeholder:text-foreground/40 focus:outline-none"
                />
                {/* Glow orb send button */}
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className={cn(
                    'ml-1 h-[22px] w-[22px] shrink-0 rounded-full transition-all duration-400',
                    input.trim() && !busy ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none',
                  )}
                  style={{
                    background: 'radial-gradient(circle at 40% 35%, oklch(0.96 0.06 220), oklch(0.72 0.18 242))',
                    boxShadow: '0 0 14px oklch(0.82 0.16 235 / 0.65), inset 0 1px 0 oklch(1 0 0 / 0.3)',
                  }}
                />
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Thinking pulse ───────────────────────────────────────────────────────────
function ThinkingPulse() {
  return (
    <div className="flex items-center gap-[6px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-[6px] w-[6px] rounded-full animate-pulse"
          style={{
            background: 'oklch(0.82 0.16 235 / 0.65)',
            animationDelay: `${i * 0.2}s`,
            boxShadow: '0 0 8px oklch(0.82 0.16 235 / 0.45)',
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
      <div className="max-w-[80%]">
        {message.screenshot && (
          <img src={message.screenshot} alt="" className="mb-2 w-full rounded-2xl object-cover opacity-55" />
        )}
        <div
          className="rounded-[20px] rounded-tr-[6px] text-[13px] font-light leading-relaxed text-foreground/88"
          style={{ padding: '9px 16px', background: 'oklch(1 0 0 / 0.10)', border: '1px solid oklch(1 0 0 / 0.07)' }}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

function AssistantBubble({ message }: { message: Message }) {
  return (
    <div>
      <p
        className="text-display font-light leading-relaxed text-foreground/90"
        style={{ fontSize: 16, lineHeight: 1.55 }}
      >
        {message.content}
      </p>
    </div>
  );
}

// ─── Control button ───────────────────────────────────────────────────────────
function ControlBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded-full text-foreground/30 transition-all duration-200 hover:bg-white/[0.08] hover:text-foreground/65"
    >
      {children}
    </button>
  );
}
