import { APP_VERSION, BUILD_COMMIT } from "@/lib/version";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import { GlassPanel } from "@/components/aura/glass-panel";
import { Download, X, Apple, Monitor, ChevronRight } from "lucide-react";
import { InstallCommand, MAC_INSTALL_COMMAND, MacInstallReminder } from "./mac-install-reminder";

const RELEASES_BASE = "https://github.com/IsmailMoudden/aura-companion/releases/latest/download";

type GuideStep = { text: string; code?: string };

const platforms: { id: string; icon: React.ReactNode; label: string; sub: string; url: string; badge: string | null; guide: GuideStep[] }[] = [
  {
    id: "mac-arm",
    icon: <Apple className="h-5 w-5" />,
    label: "macOS",
    sub: "Apple Silicon · M1, M2, M3…",
    url: `${RELEASES_BASE}/Aura-arm64.dmg`,
    badge: "Recommended",
    guide: [
      { text: "Open the .dmg and drag Aura to Applications." },
      { text: 'After moving Aura into Applications, if macOS blocks the first launch, open Terminal, paste this command and press Return:', code: MAC_INSTALL_COMMAND },
      { text: "Double-click Aura to launch. The orb appears on your screen." },
      { text: "Press Alt+Space to summon or dismiss the overlay." },
      { text: "Aura automatically captures your screen on every message. Press Alt+Shift+S to capture manually." },
      { text: "To quit: hover the panel → click × → then Cmd+Q, or right-click the Dock icon → Quit." },
    ],
  },
  {
    id: "mac-intel",
    icon: <Apple className="h-5 w-5" />,
    label: "macOS",
    sub: "Intel · x64",
    url: `${RELEASES_BASE}/Aura-x64.dmg`,
    badge: null,
    guide: [
      { text: "Open the .dmg and drag Aura to Applications." },
      { text: 'After moving Aura into Applications, if macOS blocks the first launch, open Terminal, paste this command and press Return:', code: MAC_INSTALL_COMMAND },
      { text: "Double-click Aura to launch. The orb appears on your screen." },
      { text: "Press Alt+Space to summon or dismiss the overlay." },
      { text: "Aura automatically captures your screen on every message. Press Alt+Shift+S to capture manually." },
      { text: "To quit: hover the panel → click × → then Cmd+Q, or right-click the Dock icon → Quit." },
    ],
  },
  {
    id: "windows",
    icon: <Monitor className="h-5 w-5" />,
    label: "Windows",
    sub: "x64 · .exe installer",
    url: `${RELEASES_BASE}/Aura-x64.exe`,
    badge: null,
    guide: [
      { text: 'Run the installer. If SmartScreen appears, click "More info" → "Run anyway".' },
      { text: "Launch Aura from the Start menu. The orb appears on your screen." },
      { text: "Press Alt+Space to summon or dismiss the overlay." },
      { text: "Press Ctrl+Shift+S to capture your screen and attach it to your next message." },
      { text: "To quit: right-click the system tray icon → Quit." },
    ],
  },
];

interface DownloadModalProps {
  open: boolean;
  onClose: () => void;
}

export function DownloadModal({ open, onClose }: DownloadModalProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showMacReminder, setShowMacReminder] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && showMacReminder) dialogRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [open, showMacReminder]);
  useEffect(() => {
    if (!open) return;
    try { setShowMacReminder(sessionStorage.getItem('aura-mac-install-reminder') === 'true'); } catch { /* The reminder also works without browser storage. */ }
  }, [open]);
  const onDownload = (platformId: string) => {
    const mac = platformId.startsWith('mac-');
    setShowMacReminder(mac);
    setExpanded(mac ? null : platformId);
    if (mac) requestAnimationFrame(() => dialogRef.current?.scrollTo({ top: 0, behavior: 'smooth' }));
    try {
      if (mac) sessionStorage.setItem('aura-mac-install-reminder', 'true');
      else sessionStorage.removeItem('aura-mac-install-reminder');
    } catch { /* Storage is optional. */ }
  };
  const [release, setRelease] = useState<{ version: string; urls: Record<string, string> } | null>(null);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch('https://api.github.com/repos/IsmailMoudden/aura-companion/releases/latest', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Release unavailable');
        const data = await response.json() as { tag_name: string; draft: boolean; prerelease: boolean; assets: { name: string; browser_download_url: string }[] };
        const names = ['Aura-arm64.dmg', 'Aura-x64.dmg', 'Aura-x64.exe'];
        if (data.draft || data.prerelease || !names.every((name) => data.assets.some((asset) => asset.name === name))) return;
        const urls = Object.fromEntries(data.assets.filter((asset) => names.includes(asset.name) && asset.browser_download_url.startsWith('https://github.com/IsmailMoudden/aura-companion/releases/download/')).map((asset) => [asset.name, asset.browser_download_url]));
        if (names.every((name) => urls[name])) setRelease({ version: data.tag_name, urls });
      }).catch(() => { /* Stable latest/download links remain available offline or when rate limited. */ });
    return () => controller.abort();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" style={{ animation: "fadeIn 0.2s ease" }} />

      <GlassPanel
        ref={dialogRef}
        strong
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-title"
        className="relative z-10 max-h-[calc(100dvh-48px)] w-full max-w-md overflow-y-auto p-6 sm:p-8"
        style={{ animation: "fadeUp 0.3s cubic-bezier(0.34,1.4,0.64,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close download instructions"
          className="absolute right-5 top-5 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground hover:bg-white/[0.08]"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="mb-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Download</p>
        <h2 id="download-title" className="text-display text-3xl mb-2">Choose your platform.</h2>
        <p className="mb-3 text-sm text-muted-foreground" role="status">Desktop release: {release?.version ?? "latest stable release on GitHub"}</p>
        <p className="text-sm font-light text-muted-foreground mb-8">
          Free during early access. No account needed to start.
        </p>

        {showMacReminder && <MacInstallReminder />}

        <div className="flex flex-col gap-3">
          {platforms.map((p) => (
            <div key={p.id} className="rounded-2xl border border-white/[0.08] overflow-hidden transition-colors duration-300 hover:border-white/[0.14]">
              {/* row */}
              <div className="flex items-center gap-4 px-5 py-4">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-muted-foreground">
                  {p.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-light">{p.label}</span>
                    {p.badge && (
                      <span className="rounded-full bg-white/[0.1] px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{p.sub}</span>
                </div>
                {/* install guide toggle */}
                <button
                  onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                  className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mr-2 flex items-center gap-1"
                >
                  <ChevronRight className={`h-3 w-3 transition-transform duration-200 ${expanded === p.id ? "rotate-90" : ""}`} />
                  Guide
                </button>
                <a
                  href={release?.urls[p.url.split('/').pop()!] ?? p.url}
                  onClick={() => onDownload(p.id)}
                  aria-label={`Download Aura for ${p.id === 'mac-arm' ? 'macOS Apple Silicon' : p.id === 'mac-intel' ? 'macOS Intel' : 'Windows'}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.16] transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
              </div>

              {/* install guide */}
              {expanded === p.id && (
                <div className="px-5 pb-5 pt-1">
                  <ol className="flex flex-col gap-2">
                    {p.guide.map((step, i) => (
                      <li key={i} className="flex gap-3 text-[13px] font-light text-muted-foreground leading-relaxed">
                        <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[10px] text-foreground/60">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          {step.text}
                          {step.code && (
                            <InstallCommand command={step.code} />
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          Website v{APP_VERSION} · build {BUILD_COMMIT}
        </p>
      </GlassPanel>

      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes fadeUp { from { opacity:0; transform:scale(0.95) translateY(8px) } to { opacity:1; transform:scale(1) translateY(0) } }
      `}</style>
    </div>
  );
}
