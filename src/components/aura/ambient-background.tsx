export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: "var(--gradient-ambient)" }}
      />
      <div className="absolute -top-40 left-1/4 h-[60vh] w-[60vh] rounded-full opacity-60 blur-3xl animate-float-slow"
        style={{ background: "radial-gradient(circle, oklch(0.55 0.18 300 / 0.5), transparent 65%)" }} />
      <div className="absolute bottom-[-10vh] right-[-10vh] h-[70vh] w-[70vh] rounded-full opacity-50 blur-3xl animate-float"
        style={{ background: "radial-gradient(circle, oklch(0.5 0.16 270 / 0.5), transparent 65%)" }} />
      <div className="absolute top-1/3 right-1/4 h-[40vh] w-[40vh] rounded-full opacity-40 blur-3xl animate-float-slow"
        style={{ background: "radial-gradient(circle, oklch(0.55 0.14 320 / 0.45), transparent 65%)" }} />
      <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />
    </div>
  );
}
