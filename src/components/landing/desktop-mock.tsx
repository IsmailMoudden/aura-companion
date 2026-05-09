import { GlassPanel } from "@/components/aura/glass-panel";
import { OverlayMock } from "@/components/overlay/overlay-mock";

export function DesktopMock() {
  return (
    <div className="relative mx-auto max-w-5xl">
      <div
        className="relative overflow-hidden rounded-[2rem] p-3 shadow-2xl"
        style={{
          background: "linear-gradient(135deg, oklch(1 0 0 / 0.18), oklch(1 0 0 / 0.06))",
          backdropFilter: "blur(24px) saturate(140%)",
          WebkitBackdropFilter: "blur(24px) saturate(140%)",
          border: "1px solid oklch(1 0 0 / 0.12)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <div
          className="relative aspect-[16/10] overflow-hidden rounded-[1.5rem]"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.86 0.06 225 / 0.45) 0%, oklch(0.78 0.08 235 / 0.35) 50%, oklch(0.7 0.09 245 / 0.3) 100%)",
          }}
        >
          {/* Fake window chrome */}
          <div className="absolute left-4 top-4 flex gap-2">
            <span className="h-3 w-3 rounded-full bg-white/20" />
            <span className="h-3 w-3 rounded-full bg-white/20" />
            <span className="h-3 w-3 rounded-full bg-white/20" />
          </div>
          {/* Fake doc lines */}
          <div className="absolute inset-0 p-8 sm:p-16 blur-[2px] opacity-60">
            <div className="space-y-3">
              <div className="h-3 w-2/3 rounded bg-white/10" />
              <div className="h-3 w-1/2 rounded bg-white/10" />
              <div className="h-3 w-3/4 rounded bg-white/10" />
              <div className="mt-8 h-2 w-full rounded bg-white/[0.06]" />
              <div className="h-2 w-11/12 rounded bg-white/[0.06]" />
              <div className="h-2 w-10/12 rounded bg-white/[0.06]" />
              <div className="h-2 w-9/12 rounded bg-white/[0.06]" />
            </div>
          </div>
          {/* Overlay panel floating */}
          <div
            className="absolute bottom-3 right-3 sm:bottom-8 sm:right-8 animate-fade-up origin-bottom-right scale-[0.55] sm:scale-75 lg:scale-100"
          >
            <OverlayMock state="expanded" />
          </div>
        </div>
      </div>
      <div
        aria-hidden
        className="absolute inset-x-20 -bottom-16 h-32 rounded-full blur-3xl opacity-50"
        style={{ background: "radial-gradient(ellipse, var(--glow), transparent 70%)" }}
      />
    </div>
  );
}
