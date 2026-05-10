import { useEffect, useRef, useState, useCallback } from 'react';
import { Orb } from '@/components/aura/orb';
import { X, Camera, ChevronDown, Mic, MicOff, Volume2, VolumeX, Sun } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// ─── Web Speech API types ─────────────────────────────────────────────────────
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
interface SpeechRecognitionResultEvent {
  results: { [i: number]: { [j: number]: { transcript: string }; length: number }; length: number };
}
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}
const SpeechRecognitionAPI: SpeechRecognitionCtor | null = typeof window !== 'undefined'
  ? (window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null)
  : null;

const WAKE_WORD = 'hey aura';

// ─── TTS ──────────────────────────────────────────────────────────────────────
function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel(); // stop any ongoing speech
  // Strip markdown before speaking
  const clean = text
    .replace(/```[\s\S]*?```/g, 'code block')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^[-*•]\s/gm, '')
    .replace(/^\d+\.\s/gm, '')
    .trim();
  const utt = new SpeechSynthesisUtterance(clean);
  utt.lang = 'en-US';
  utt.rate = 0.95;
  utt.pitch = 1.05;
  // Prefer a natural-sounding English voice (Samantha on macOS is the best built-in)
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((v) => v.name === 'Samantha')
    ?? voices.find((v) => v.name === 'Karen')
    ?? voices.find((v) => v.name === 'Moira')
    ?? voices.find((v) => v.lang === 'en-US' && v.localService)
    ?? voices.find((v) => v.lang.startsWith('en'));
  if (preferred) utt.voice = preferred;
  window.speechSynthesis.speak(utt);
}

type OrbState = 'idle' | 'listening' | 'thinking';
type Message = { id: string; role: 'user' | 'assistant'; content: string; screenshot?: string; showScreenshot?: boolean };

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


// Window = panel. These are the Electron window sizes.
const ORB_W = 88;
const ORB_H = 88;
const PANEL_W = 360;
const PANEL_H_IDLE = 300;
const PANEL_H_CONV = 720;
const PANEL_H_CONV_SCREENSHOT = 820; // extra room for screenshot thumbnail in conversation
const PANEL_R_IDLE = 32;   // border-radius when compact
const PANEL_R_CONV = 26;   // border-radius in conversation

export function OverlayApp() {
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false); // controls CSS opacity/scale for enter animation
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
  const [panelOpacity, setPanelOpacity] = useState(0.30);
  const [showOpacitySlider, setShowOpacitySlider] = useState(false);
  // Voice
  const [voiceMode, setVoiceMode] = useState<'off' | 'wake' | 'command'>('off');
  const [wakeDetected, setWakeDetected] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isListeningCmd, setIsListeningCmd] = useState(false);
  const ttsEnabledRef = useRef(false);
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);
  const wakeRecogRef = useRef<SpeechRecognitionInstance | null>(null);
  const cmdRecogRef = useRef<SpeechRecognitionInstance | null>(null);
  const voiceModeRef = useRef<'off' | 'wake' | 'command'>('off');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      // Try to restore persisted session from electron-store first
      if (isElectron) {
        const saved = await window.aura!.loadSession();
        if (saved) {
          await supabase.auth.setSession({ access_token: saved.access_token, refresh_token: saved.refresh_token });
        }
      }
      const { data } = await supabase.auth.getSession();
      if (data.session?.user)
        setUser({ id: data.session.user.id, email: data.session.user.email ?? '' });
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? '' } : null);
      // Persist or clear session on auth state change
      if (isElectron) {
        if (session?.access_token && session?.refresh_token) {
          window.aura!.saveSession({ access_token: session.access_token, refresh_token: session.refresh_token });
        } else {
          window.aura!.clearSession();
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Listen for deep-link auth callback from Electron main
  useEffect(() => {
    if (!isElectron) return;
    const unsub = window.aura!.onAuthDeepLink(async ({ accessToken, refreshToken }) => {
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!isElectron) return;
    const unsub = window.aura!.onScreenshotTaken((data) => {
      setScreenshot(data);
      openPanel();
    });
    return unsub;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasConversation = messages.length > 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const openPanel = useCallback(() => {
    // 2. Resize Electron window to idle panel size
    if (isElectron) window.aura!.updateDimensions(PANEL_W, PANEL_H_IDLE);
    setExpanded(true);
    // 3. Tiny delay then fade/scale in so the animation is visible
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setVisible(true);
        setTimeout(() => inputRef.current?.focus(), 180);
      });
    });
  }, []);

  const closePanel = useCallback(() => {
    setVisible(false);
    // Wait for fade-out animation, then collapse React state
    setTimeout(() => {
      setExpanded(false);
      // Give React one more frame to render the orb before resizing the window,
      // otherwise Electron shrinks the window before the orb DOM is mounted
      // and the orb appears clipped on re-open.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (isElectron) window.aura!.updateDimensions(ORB_W, ORB_H);
        });
      });
    }, 300);
  }, []);

  // When first message sent, grow window to conversation size
  const growToConversation = useCallback(() => {
    if (isElectron) window.aura!.updateDimensions(PANEL_W, PANEL_H_CONV);
  }, []);

  // Resize when screenshot is attached/removed during a conversation
  useEffect(() => {
    if (!isElectron || !expanded) return;
    const hasConv = messages.length > 0;
    if (!hasConv) return; // idle panel handles its own size
    const h = screenshot ? PANEL_H_CONV_SCREENSHOT : PANEL_H_CONV;
    window.aura!.updateDimensions(PANEL_W, h);
  }, [screenshot, expanded, messages.length]);

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

  const runAI = useCallback(async (userContent: string, attachedScreenshot?: string, showScreenshot?: boolean) => {
    if (busy) return;
    setBusy(true);
    setOrbState('thinking');

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: userContent, screenshot: attachedScreenshot, showScreenshot: showScreenshot ?? false };
    const isFirst = messages.length === 0;
    setMessages((m) => [...m, userMsg]);

    if (isFirst) growToConversation();

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

      const json = await res.json() as { reply?: string; error?: string };
      if (!res.ok) {
        console.error('chat error:', res.status, json);
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      const reply = json.reply ?? "Something went quiet.";
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: reply }]);
      if (ttsEnabledRef.current) speak(reply);

      if (user && convoId) {
        await supabase.from('messages').insert({ conversation_id: convoId, user_id: user.id, role: 'assistant', content: reply });
      }
      if (attachedScreenshot) clearScreenshot();
    } catch (err) {
      console.error('runAI failed:', err);
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: 'Something went quiet. Try again?' }]);
    } finally {
      setBusy(false);
      setOrbState('idle');
    }
  }, [busy, messages, conversationId, user, clearScreenshot, growToConversation]);

  const sendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');

    const isManualScreenshot = !!screenshot;

    // Use manually attached screenshot, or silently auto-capture for context
    let screenData = screenshot?.preview;
    if (isElectron && !screenData) {
      try {
        const result = await window.aura!.captureOnly();
        if (result.success && result.preview) {
          screenData = result.preview;
          if (result.path) window.aura!.clearScreenshot(result.path);
        }
      } catch {
        // silent
      }
    }

    void runAI(text, screenData, isManualScreenshot);
  }, [input, screenshot, runAI]);

  // Keep stable refs to avoid stale closures in SpeechRecognition callbacks
  const runAIRef = useRef(runAI);
  const openPanelRef = useRef(openPanel);
  useEffect(() => { runAIRef.current = runAI; }, [runAI]);
  useEffect(() => { openPanelRef.current = openPanel; }, [openPanel]);

  const startWakeListener = useCallback(() => {
    if (!SpeechRecognitionAPI) return;
    const recog = new SpeechRecognitionAPI();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'en-US';
    wakeRecogRef.current = recog;

    recog.onresult = (e: SpeechRecognitionResultEvent) => {
      const parts: string[] = [];
      for (let i = 0; i < e.results.length; i++) parts.push(e.results[i][0].transcript.toLowerCase());
      const transcript = parts.join(' ');
      if (transcript.includes(WAKE_WORD) || transcript.includes('aura') || transcript.includes('hora') || transcript.includes('ora')) {
        recog.stop();
        setWakeDetected(true);
        setOrbState('listening');
        setTimeout(() => {
          setWakeDetected(false);
          setVoiceMode('command');
        }, 800);
      }
    };
    recog.onend = () => {
      if (wakeRecogRef.current === recog) {
        try { recog.start(); } catch { /**/ }
      }
    };
    recog.onerror = () => {
      setTimeout(() => {
        if (wakeRecogRef.current === recog) {
          try { recog.start(); } catch { /**/ }
        }
      }, 1000);
    };
    try { recog.start(); } catch { /**/ }
  }, []);

  const startCommandListener = useCallback(() => {
    if (!SpeechRecognitionAPI) return;
    const recog = new SpeechRecognitionAPI();
    recog.continuous = false;
    recog.interimResults = true;
    recog.lang = 'fr-FR';
    cmdRecogRef.current = recog;
    setOrbState('listening');
    setIsListeningCmd(true);
    setInput('');

    recog.onresult = (e: SpeechRecognitionResultEvent) => {
      // Show interim transcript live in input
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        interim += e.results[i][0].transcript;
      }
      setInput(interim);

      // Final result — send it
      const last = e.results[e.results.length - 1];
      if ((last as unknown as { isFinal: boolean }).isFinal) {
        const text = interim.trim();
        if (text) {
          setIsListeningCmd(false);
          setInput(text);
          setTimeout(() => {
            void runAIRef.current(text, undefined, false);
            setInput('');
          }, 300);
        }
      }
    };
    recog.onend = () => {
      setOrbState('idle');
      setIsListeningCmd(false);
      cmdRecogRef.current = null;
      setVoiceMode('wake');
    };
    recog.onerror = () => {
      setOrbState('idle');
      setIsListeningCmd(false);
      setInput('');
      cmdRecogRef.current = null;
      setVoiceMode('wake');
    };
    try { recog.start(); } catch { /**/ }
  }, []);

  // Voice state machine
  useEffect(() => {
    if (voiceMode === 'off') {
      if (wakeRecogRef.current) { wakeRecogRef.current.onend = null; wakeRecogRef.current.stop(); wakeRecogRef.current = null; }
      if (cmdRecogRef.current) { cmdRecogRef.current.onend = null; cmdRecogRef.current.stop(); cmdRecogRef.current = null; }
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
      setOrbState('idle');
    } else if (voiceMode === 'wake') {
      if (cmdRecogRef.current) { cmdRecogRef.current.onend = null; cmdRecogRef.current.stop(); cmdRecogRef.current = null; }
      startWakeListener();
    } else if (voiceMode === 'command') {
      if (wakeRecogRef.current) { wakeRecogRef.current.onend = null; wakeRecogRef.current.stop(); wakeRecogRef.current = null; }
      openPanelRef.current();
      setTimeout(() => startCommandListener(), 350);
    }
  }, [voiceMode, startWakeListener, startCommandListener]);

  const toggleVoice = useCallback(() => {
    setVoiceMode((m) => m === 'off' ? 'wake' : 'off');
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setScreenshot(null);
    if (isElectron) window.aura!.updateDimensions(PANEL_W, PANEL_H_IDLE);
  }, []);

  const connectToWeb = useCallback(() => {
    if (!isElectron) return;
    // VITE_SUPABASE_URL gives us the Supabase URL — derive the web app URL from env
    const webUrl = import.meta.env.VITE_WEB_URL ?? 'http://localhost:3000';
    window.aura!.openExternal(`${webUrl}/auth?overlay=true`);
  }, []);

  // ─── Not authenticated — show login prompt ───────────────────────────────────
  if (!user && isElectron) {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-5"
        style={{
          borderRadius: PANEL_R_IDLE,
          background: [
            'radial-gradient(ellipse 90% 55% at 25% 15%, oklch(0.72 0.14 228 / 0.08), transparent 65%)',
            'linear-gradient(158deg, oklch(0.53 0.10 238 / 0.28) 0%, oklch(0.41 0.09 254 / 0.32) 100%)',
          ].join(', '),
          backdropFilter: 'blur(32px) saturate(140%)',
          WebkitBackdropFilter: 'blur(32px) saturate(140%)',
          border: '1px solid oklch(1 0 0 / 0.10)',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        <div className="animate-float">
          <Orb size={54} state="idle" variant="overlay" noHalo />
        </div>
        <div className="flex flex-col items-center gap-1 text-center" style={{ padding: '0 28px' }}>
          <p className="text-display text-foreground/90" style={{ fontSize: 17, letterSpacing: '-0.01em' }}>Welcome to Aura</p>
          <p className="text-foreground/45 font-light" style={{ fontSize: 12, lineHeight: 1.5 }}>Sign in to start chatting</p>
        </div>
        <button
          onClick={connectToWeb}
          className="rounded-full font-light text-foreground/90 transition-all duration-300 hover:text-foreground"
          style={{
            fontSize: 13,
            padding: '9px 24px',
            background: 'radial-gradient(circle at 38% 32%, oklch(0.96 0.06 218 / 0.9), oklch(0.72 0.18 242 / 0.9))',
            boxShadow: '0 0 20px oklch(0.82 0.16 235 / 0.35), inset 0 1px 0 oklch(1 0 0 / 0.25)',
          }}
        >
          Sign in
        </button>
      </div>
    );
  }

  // ─── Idle orb ─────────────────────────────────────────────────────────────────
  if (!expanded) {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ background: 'transparent' }}>
        <button
          onClick={openPanel}
          className="flex items-center justify-center rounded-full outline-none animate-breathe"
          style={{ width: ORB_W, height: ORB_H, background: 'transparent', border: 'none', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          title="Open Aura (Alt+Space)"
        >
          <Orb size={ORB_W} state={orbState} variant="overlay" noHalo />
        </button>
      </div>
    );
  }

  // ─── Panel — fills the Electron window exactly ────────────────────────────────
  const borderRadius = hasConversation ? PANEL_R_CONV : PANEL_R_IDLE;

  return (
    <div className="h-full w-full" style={{ background: 'transparent' }}>
      <div
        className="relative flex h-full w-full flex-col overflow-hidden"
        style={{
          borderRadius,
          // Layered depth background — opacity controlled by slider
          background: [
            `radial-gradient(ellipse 90% 55% at 25% 15%, oklch(0.72 0.14 228 / 0.08), transparent 65%)`,
            `radial-gradient(ellipse 55% 70% at 80% 85%, oklch(0.50 0.11 255 / 0.06), transparent 65%)`,
            `linear-gradient(158deg, oklch(0.53 0.10 238 / ${panelOpacity}) 0%, oklch(0.41 0.09 254 / ${Math.min(panelOpacity + 0.04, 0.60)}) 100%)`,
          ].join(', '),
          backdropFilter: 'blur(32px) saturate(140%)',
          WebkitBackdropFilter: 'blur(32px) saturate(140%)',
          border: '1px solid oklch(1 0 0 / 0.10)',
          boxShadow: [
            'inset 0 1px 0 oklch(1 0 0 / 0.10)',
            'inset 0 -1px 0 oklch(0 0 0 / 0.05)',
            '0 0 0 0.5px oklch(0 0 0 / 0.08)',
          ].join(', '),
          // Enter animation only — no layout transitions
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(6px)',
          transition: 'opacity 0.32s ease, transform 0.38s cubic-bezier(0.34, 1.4, 0.64, 1)',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
        onMouseEnter={() => setHoveringPanel(true)}
        onMouseLeave={() => setHoveringPanel(false)}
      >
        {/* Top shimmer */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0" style={{ height: '50%', background: 'linear-gradient(180deg, oklch(1 0 0 / 0.055) 0%, transparent 100%)', borderRadius: `${borderRadius}px ${borderRadius}px 0 0` }} />
        {/* Center ambient glow */}
        <div className="pointer-events-none absolute z-0" style={{ inset: '-20%', background: 'radial-gradient(ellipse 55% 45% at 50% 32%, oklch(0.78 0.13 232 / 0.10), transparent 70%)' }} />

        {/* Drag strip */}
        <div className="absolute inset-x-0 top-0 z-10 h-9" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

        {/* Voice controls — always visible left side */}
        {SpeechRecognitionAPI && (
          <div
            className="absolute left-3 top-3 z-20 flex items-center gap-0.5"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            {/* Wake word toggle */}
            <ControlBtn
              onClick={toggleVoice}
              title={voiceMode !== 'off' ? 'Stop "Hey Aura"' : 'Start "Hey Aura"'}
              active={voiceMode !== 'off'}
            >
              {voiceMode !== 'off'
                ? <MicOff className="h-3 w-3" />
                : <Mic className="h-3 w-3" />
              }
            </ControlBtn>
            {/* TTS toggle */}
            <ControlBtn
              onClick={() => setTtsEnabled((v) => !v)}
              title={ttsEnabled ? 'Mute voice response' : 'Enable voice response'}
              active={ttsEnabled}
            >
              {ttsEnabled
                ? <Volume2 className="h-3 w-3" />
                : <VolumeX className="h-3 w-3" />
              }
            </ControlBtn>
          </div>
        )}

        {/* Controls — always visible right side */}
        <div
          className="absolute right-3 top-3 z-20 flex items-center gap-0.5"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {/* Opacity slider — expands on Sun click */}
          {showOpacitySlider && (
            <div className="flex items-center gap-2 mr-1" style={{ width: 80 }}>
              <input
                type="range"
                min={0.12}
                max={0.55}
                step={0.01}
                value={panelOpacity}
                onChange={(e) => setPanelOpacity(parseFloat(e.target.value))}
                className="w-full"
                style={{ accentColor: 'oklch(0.82 0.16 235)' }}
              />
            </div>
          )}
          <ControlBtn onClick={() => setShowOpacitySlider((v) => !v)} title="Opacity" active={showOpacitySlider}>
            <Sun className="h-3 w-3" />
          </ControlBtn>
          {hasConversation && (
            <ControlBtn onClick={clearConversation} title="Clear"><X className="h-3 w-3" /></ControlBtn>
          )}
          <ControlBtn onClick={captureScreenshot} title="Capture"><Camera className="h-3 w-3" /></ControlBtn>
          <ControlBtn onClick={closePanel} title="Minimise"><ChevronDown className="h-3 w-3" /></ControlBtn>
        </div>

        {/* ── PRESENCE ZONE ── */}
        {!hasConversation && (
          <div
            className="relative z-10 flex flex-1 flex-col items-center justify-center"
            style={{ padding: '0 32px', gap: 0 }}
            onClick={() => inputRef.current?.focus()}
          >
            {/* Orb glow halo */}
            <div
              className="absolute rounded-full blur-[56px] animate-glow-pulse"
              style={{
                width: wakeDetected ? 220 : 160,
                height: wakeDetected ? 220 : 160,
                background: `radial-gradient(circle, oklch(0.82 0.16 235 / ${wakeDetected ? '0.70' : '0.48'}), transparent 70%)`,
                top: '50%', left: '50%', transform: 'translate(-50%, -72%)',
                transition: 'width 0.4s ease, height 0.4s ease, background 0.4s ease',
              }}
            />
            <div className="animate-float relative z-10" style={{ marginBottom: 0 }}>
              <Orb size={64} state={orbState} variant="overlay" noHalo />
            </div>
            <p
              className="relative z-10 text-display font-light transition-all duration-300"
              style={{
                fontSize: 17,
                letterSpacing: '-0.01em',
                lineHeight: 1.3,
                marginTop: 28,
                color: wakeDetected ? 'oklch(0.95 0.10 230)' : undefined,
                opacity: wakeDetected ? 1 : 0.82,
              }}
            >
              {wakeDetected ? 'Hey Aura…' : voiceMode === 'wake' ? 'Listening…' : busy ? 'Thinking…' : PRESENCE_PHRASES[phraseIndex]}
            </p>

          </div>
        )}

        {/* ── CONVERSATION ZONE ── */}
        {hasConversation && (
          <div className="relative z-10 flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-14" style={{ background: 'linear-gradient(to bottom, oklch(0.49 0.10 242 / 0.70), transparent)' }} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12" style={{ background: 'linear-gradient(to top, oklch(0.41 0.09 254 / 0.70), transparent)' }} />
            <div ref={scrollRef} className="h-full overflow-y-auto" style={{ padding: '52px 28px 12px' }}>
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
        {screenshot && !hasConversation && (
          <div className="relative z-10 mx-7 mb-2 overflow-hidden rounded-[18px]" style={{ flexShrink: 0 }}>
            <img src={screenshot.preview} alt="" className="h-24 w-full object-cover" style={{ opacity: 0.75, filter: 'brightness(0.88)' }} />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-1.5" style={{ background: 'linear-gradient(to top, oklch(0.1 0.04 260 / 0.5), transparent)' }}>
              <p className="text-[10px] font-light text-foreground/45">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              <button onClick={clearScreenshot} className="text-foreground/30 hover:text-foreground/60 transition-colors"><X className="h-3 w-3" /></button>
            </div>
          </div>
        )}

        {/* ── INPUT ZONE ── */}
        <div className="relative z-10 flex-shrink-0" style={{ padding: '8px 20px 20px' }}>
          <form onSubmit={sendMessage}>
            <div
              className="flex items-center gap-3 rounded-full transition-all duration-400"
              style={{
                height: 46,
                paddingLeft: 20,
                paddingRight: 14,
                background: isListeningCmd ? 'oklch(0.82 0.16 235 / 0.10)' : inputFocused || input.length > 0 ? 'oklch(1 0 0 / 0.092)' : 'transparent',
                boxShadow: isListeningCmd
                  ? 'inset 0 0 0 1px oklch(0.82 0.16 235 / 0.45), 0 0 16px oklch(0.82 0.16 235 / 0.20)'
                  : inputFocused
                  ? 'inset 0 0 0 1px oklch(1 0 0 / 0.16), inset 0 1px 0 oklch(1 0 0 / 0.10)'
                  : 'none',
                transition: 'background 0.35s ease, box-shadow 0.35s ease',
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.shiftKey && SpeechRecognitionAPI) {
                    e.preventDefault();
                    setVoiceMode('command');
                  }
                }}
                placeholder={isListeningCmd ? 'Listening…' : 'Ask softly… (Shift+Enter to speak)'}
                className="flex-1 bg-transparent text-[13px] font-light italic text-foreground placeholder:text-foreground/38 focus:outline-none"
              />
              {/* Orb send dot */}
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className={cn(
                  'h-[22px] w-[22px] shrink-0 rounded-full transition-all duration-300',
                  input.trim() && !busy ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none',
                )}
                style={{
                  background: 'radial-gradient(circle at 38% 32%, oklch(0.96 0.06 218), oklch(0.72 0.18 242))',
                  boxShadow: '0 0 14px oklch(0.82 0.16 235 / 0.60), inset 0 1px 0 oklch(1 0 0 / 0.28)',
                }}
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Thinking ────────────────────────────────────────────────────────────────
function ThinkingPulse() {
  return (
    <div className="flex items-center gap-[6px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-[6px] w-[6px] rounded-full animate-pulse"
          style={{ background: 'oklch(0.82 0.16 235 / 0.65)', animationDelay: `${i * 0.2}s`, boxShadow: '0 0 8px oklch(0.82 0.16 235 / 0.4)' }}
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
        {message.screenshot && message.showScreenshot && (
          <img src={message.screenshot} alt="" className="mb-2 w-full rounded-2xl object-cover opacity-55" />
        )}
        <div
          className="text-[13px] font-light leading-relaxed text-foreground/88"
          style={{ padding: '9px 16px', borderRadius: '20px 20px 6px 20px', background: 'oklch(1 0 0 / 0.10)', border: '1px solid oklch(1 0 0 / 0.07)' }}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre key={i} style={{ background: 'oklch(0 0 0 / 0.25)', borderRadius: 10, padding: '8px 12px', overflowX: 'auto', fontSize: 12, lineHeight: 1.5, margin: '6px 0' }}>
          <code style={{ fontFamily: 'monospace', color: 'oklch(0.92 0.04 230)' }} data-lang={lang}>{codeLines.join('\n')}</code>
        </pre>
      );
      i++;
      continue;
    }

    // Bullet list
    if (/^[-*•]\s/.test(line)) {
      nodes.push(
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
          <span style={{ color: 'oklch(0.82 0.16 235 / 0.7)', flexShrink: 0, marginTop: 1 }}>·</span>
          <span>{inlineMarkdown(line.replace(/^[-*•]\s/, ''))}</span>
        </div>
      );
      i++;
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      nodes.push(
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
          <span style={{ color: 'oklch(0.82 0.16 235 / 0.7)', flexShrink: 0, minWidth: 14, marginTop: 1 }}>{num}.</span>
          <span>{inlineMarkdown(line.replace(/^\d+\.\s/, ''))}</span>
        </div>
      );
      i++;
      continue;
    }

    // Empty line → spacing
    if (line.trim() === '') {
      nodes.push(<div key={i} style={{ height: 6 }} />);
      i++;
      continue;
    }

    // Normal paragraph line
    nodes.push(
      <span key={i} style={{ display: 'block' }}>{inlineMarkdown(line)}</span>
    );
    i++;
  }

  return nodes;
}

function inlineMarkdown(text: string): React.ReactNode {
  // Split on **bold**, *italic*, `code`
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={idx} style={{ fontWeight: 500, color: 'oklch(0.95 0.04 230)' }}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={idx} style={{ fontStyle: 'italic', color: 'oklch(0.92 0.06 230)' }}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={idx} style={{ fontFamily: 'monospace', fontSize: 11, background: 'oklch(0 0 0 / 0.22)', borderRadius: 4, padding: '1px 5px', color: 'oklch(0.88 0.08 230)' }}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function AssistantBubble({ message }: { message: Message }) {
  return (
    <div
      className="text-display font-light text-foreground/90"
      style={{ fontSize: 14, lineHeight: 1.6 }}
    >
      {renderMarkdown(message.content)}
    </div>
  );
}

// ─── Control button ───────────────────────────────────────────────────────────
function ControlBtn({ children, onClick, title, active }: { children: React.ReactNode; onClick: () => void; title?: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200',
        active
          ? 'bg-[oklch(0.82_0.16_235_/_0.22)] text-foreground/90'
          : 'text-foreground/30 hover:bg-white/[0.08] hover:text-foreground/65',
      )}
      style={active ? { boxShadow: '0 0 10px oklch(0.82 0.16 235 / 0.35)' } : {}}
    >
      {children}
    </button>
  );
}
