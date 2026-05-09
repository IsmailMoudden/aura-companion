import { useState } from "react";
import { GlassPanel } from "@/components/aura/glass-panel";
import { Download, X, Apple, Monitor, ChevronRight } from "lucide-react";

const RELEASES_BASE = "https://github.com/IsmailMoudden/aura-companion/releases/download/v0.1.0";

const platforms = [
  {
    id: "mac-arm",
    icon: <Apple className="h-5 w-5" />,
    label: "macOS",
    sub: "Apple Silicon · M1, M2, M3…",
    url: `${RELEASES_BASE}/Aura-0.1.0-arm64.dmg`,
    badge: "Recommended",
    guide: [
      "Open the .dmg and drag Aura to Applications.",
      "Right-click Aura in Applications → Open.",
      'Click "Open" in the security prompt.',
      "Aura will appear in your menu bar. Press ⌘Space to summon it.",
    ],
  },
  {
    id: "mac-intel",
    icon: <Apple className="h-5 w-5" />,
    label: "macOS",
    sub: "Intel · x64",
    url: `${RELEASES_BASE}/Aura-0.1.0-x64.dmg`,
    badge: null,
    guide: [
      "Open the .dmg and drag Aura to Applications.",
      "Right-click Aura in Applications → Open.",
      'Click "Open" in the security prompt.',
      "Aura will appear in your menu bar. Press ⌘Space to summon it.",
    ],
  },
  {
    id: "windows",
    icon: <Monitor className="h-5 w-5" />,
    label: "Windows",
    sub: "x64 · .exe installer",
    url: `${RELEASES_BASE}/Aura-0.1.0-x64.exe`,
    badge: null,
    guide: [
      'Run the installer. If Windows SmartScreen appears, click "More info" → "Run anyway".',
      "Follow the setup wizard.",
      "Launch Aura from the Start menu.",
      "Press Ctrl+Space to summon the overlay.",
    ],
  },
];

interface DownloadModalProps {
  open: boolean;
  onClose: () => void;
}

export function DownloadModal({ open, onClose }: DownloadModalProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" style={{ animation: "fadeIn 0.2s ease" }} />

      <GlassPanel
        strong
        className="relative z-10 w-full max-w-md p-8"
        style={{ animation: "fadeUp 0.3s cubic-bezier(0.34,1.4,0.64,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-5 top-5 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground hover:bg-white/[0.08]"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="mb-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Download</p>
        <h2 className="text-display text-3xl mb-2">Choose your platform.</h2>
        <p className="text-sm font-light text-muted-foreground mb-8">
          Free during early access. No account needed to start.
        </p>

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
                  href={p.url}
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
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          macOS · Windows · Web · v0.1.0
        </p>
      </GlassPanel>

      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes fadeUp { from { opacity:0; transform:scale(0.95) translateY(8px) } to { opacity:1; transform:scale(1) translateY(0) } }
      `}</style>
    </div>
  );
}
