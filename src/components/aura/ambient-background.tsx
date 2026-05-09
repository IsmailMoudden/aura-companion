import human1 from "@/assets/ambient-human-1.jpg";
import human2 from "@/assets/ambient-human-2.jpg";

export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: "var(--gradient-ambient)" }}
      />
      {/* Human imagery, soft, blurred, low-opacity for ambient warmth */}
      <img
        src={human1}
        alt=""
        aria-hidden
        className="absolute -top-24 -left-20 h-[80vh] w-[60vh] rounded-full object-cover opacity-[0.35] blur-2xl mix-blend-screen animate-float-slow"
      />
      <img
        src={human2}
        alt=""
        aria-hidden
        className="absolute bottom-[-15vh] right-[-10vh] h-[70vh] w-[80vh] rounded-[40%] object-cover opacity-[0.32] blur-3xl mix-blend-screen animate-float"
      />
      <div className="absolute -top-40 left-1/4 h-[60vh] w-[60vh] rounded-full opacity-60 blur-3xl animate-float-slow"
        style={{ background: "radial-gradient(circle, oklch(0.82 0.16 235 / 0.5), transparent 65%)" }} />
      <div className="absolute bottom-[-10vh] right-[-10vh] h-[70vh] w-[70vh] rounded-full opacity-50 blur-3xl animate-float"
        style={{ background: "radial-gradient(circle, oklch(0.7 0.16 260 / 0.5), transparent 65%)" }} />
      <div className="absolute top-1/3 right-1/4 h-[40vh] w-[40vh] rounded-full opacity-40 blur-3xl animate-float-slow"
        style={{ background: "radial-gradient(circle, oklch(0.85 0.12 210 / 0.45), transparent 65%)" }} />
      <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />
    </div>
  );
}
