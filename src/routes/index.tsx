import { createFileRoute } from "@tanstack/react-router";
import { Orb } from "@/components/aura/orb";
import { PillButton } from "@/components/aura/pill-button";
import { Section } from "@/components/landing/section";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { DesktopMock } from "@/components/landing/desktop-mock";
import { GlassPanel } from "@/components/aura/glass-panel";
import { Reveal } from "@/components/aura/reveal";
import { ArrowRight, Download, Eye, Sparkles, Brain, Wind, MessagesSquare, Layers } from "lucide-react";
import featureSeesVideo from "@/assets/3545769-hd_1920_1080_24fps.mp4";
import featureRemembersVideo from "@/assets/ELEVEN-young-woman-in-colored-light-with-digital-projection-924967-filmsupply.mov";
import featureQuietVideo from "@/assets/WE SUM-artists-designing-in-blue-lit-lab-450942-filmsupply.mov";
import featureOverlay from "@/assets/feature-overlay.jpg";
import featureThreads from "@/assets/feature-threads.jpg";
import featureSuggestions from "@/assets/feature-suggestions.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aura, Your ambient AI companion" },
      { name: "description", content: "A quietly brilliant desktop AI that understands your screen and stays in flow with you." },
      { property: "og:title", content: "Aura, Your ambient AI companion" },
      { property: "og:description", content: "Calm, contextual, always present. Aura is the AI companion for your desktop." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="relative">
      {/* HERO */}
      <section className="relative flex min-h-[100vh] flex-col items-center justify-center px-6 pt-40 pb-24 text-center">
        <div className="absolute inset-x-0 top-32 -z-10 flex justify-center">
          <Orb size={420} className="opacity-90" />
        </div>
        <h1
          className="text-display text-[clamp(3.5rem,9vw,9rem)] max-w-5xl animate-fade-up"
          style={{ animationDelay: "0.1s" }}
        >
          Your ambient AI.<br />
          <em className="italic font-light text-muted-foreground/90">Quietly brilliant.</em>
        </h1>
        <p
          className="mt-8 max-w-xl text-lg font-light leading-relaxed text-muted-foreground animate-fade-up"
          style={{ animationDelay: "0.25s" }}
        >
          Aura is a calm desktop companion that understands your screen, remembers
          what matters, and stays gently present, never in the way.
        </p>
        <div
          className="mt-12 flex flex-wrap items-center justify-center gap-4 animate-fade-up"
          style={{ animationDelay: "0.4s" }}
        >
          <PillButton size="lg">
            <Download className="h-4 w-4" /> Download Overlay
          </PillButton>
          <PillButton size="lg" variant="ghost" to="/app">
            Open Web App <ArrowRight className="h-4 w-4" />
          </PillButton>
        </div>
        <p
          className="mt-8 text-xs text-muted-foreground/70 animate-fade-up"
          style={{ animationDelay: "0.55s" }}
        >
          For macOS · Windows · Web · Free during early access
        </p>
      </section>

      {/* YOUR AI EVERYWHERE */}
      <Section
        eyebrow="Your AI everywhere"
        title={<>One companion.<br /><em className="italic text-muted-foreground/80">Every surface.</em></>}
        description="Aura travels with you across desktop, web, and the moments in between, a single thread of thought that never breaks."
      >
        <FeatureGrid
          items={[
            { icon: <Eye className="h-5 w-5" />, title: "Sees your screen", description: "Aura quietly understands what you're working on, the moment you need it.", video: featureSeesVideo },
            { icon: <Brain className="h-5 w-5" />, title: "Remembers gently", description: "Conversations, screenshots, and ideas, softly woven into a memory you control.", video: featureRemembersVideo },
            { icon: <Wind className="h-5 w-5" />, title: "Stays out of the way", description: "A breath of an interface. Present when called, invisible when not.", video: featureQuietVideo },
          ]}
        />
      </Section>

      {/* UNDERSTANDS YOUR SCREEN, desktop showcase */}
      <Section
        eyebrow="Understands your screen"
        title={<>Context, captured.</>}
        description="Press a shortcut. Aura sees what you see, a document, a design, a mistake, and meets you exactly there."
      >
        <Reveal variant="scale">
          <DesktopMock />
        </Reveal>
      </Section>

      {/* AMBIENT INTELLIGENCE */}
      <Section
        eyebrow="Ambient intelligence"
        title={<>An intelligence that<br /><em className="italic text-muted-foreground/80">breathes with you.</em></>}
        description="Aura fades into the background of your work. Soft glows, calm sound, gentle motion, designed to feel less like software and more like presence."
      >
        <Reveal variant="scale">
          <div className="relative flex h-[420px] items-center justify-center">
            <Orb size={320} state="thinking" />
          </div>
        </Reveal>
      </Section>

      {/* STAY IN FLOW */}
      <Section
        eyebrow="Stay in flow"
        title="Never break your rhythm."
        description="A whisper of a panel, a single keystroke away. Aura responds in your tone, at your pace, then steps back."
      >
        <FeatureGrid
          items={[
            { icon: <Layers className="h-5 w-5" />, title: "Floating overlay", description: "A translucent companion that lives above any app, ready in one shortcut.", image: featureOverlay, imageAlt: "Glass panel floating above a desk" },
            { icon: <MessagesSquare className="h-5 w-5" />, title: "Continuous threads", description: "Pick up any conversation hours or weeks later. Nothing is lost.", image: featureThreads, imageAlt: "Luminous threads of light flowing across time" },
            { icon: <Sparkles className="h-5 w-5" />, title: "Soft suggestions", description: "Aura nudges, never interrupts. You stay the author of your day.", image: featureSuggestions, imageAlt: "Gentle sparkles drifting in soft glow" },
          ]}
        />
      </Section>

      {/* CONTEXT-AWARE CONVERSATIONS */}
      <Section
        eyebrow="Context-aware conversations"
        title="Talk to your work."
        description="Drop in a screenshot, a thought, a vague feeling. Aura threads it together into something you can act on."
      >
        <GlassPanel strong className="mx-auto max-w-3xl p-10 text-left">
          <div className="space-y-8">
            <Reveal variant="soft" className="ml-auto max-w-md rounded-3xl rounded-tr-md bg-white/[0.06] px-5 py-4 text-[15px] font-light">
              Can you summarize this report and pull out the three risks?
            </Reveal>
            <Reveal variant="soft" delay={0.25} className="max-w-lg">
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Aura</p>
              <p className="text-[17px] font-light leading-relaxed">
                Of course. The report frames a strong quarter, but three quiet
                tensions surface, supply concentration, a softening enterprise
                pipeline, and a margin shift in the EU segment. Want me to draft a
                note for your team?
              </p>
            </Reveal>
          </div>
        </GlassPanel>
      </Section>

      {/* CTA */}
      <Section
        title={<>Meet your<br /><em className="italic text-muted-foreground/80">quiet companion.</em></>}
        description="Free during early access. No accounts to wrangle. Just a soft, intelligent presence."
      >
        <Reveal variant="soft">
          <div className="flex flex-wrap justify-center gap-4">
            <PillButton size="lg"><Download className="h-4 w-4" /> Download for macOS</PillButton>
            <PillButton size="lg" variant="ghost" to="/app">Open the web app <ArrowRight className="h-4 w-4" /></PillButton>
          </div>
        </Reveal>
      </Section>

      <footer className="border-t border-white/[0.05] px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm font-light text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="h-5 w-5 rounded-full" style={{ background: "var(--gradient-orb)" }} />
            <span className="text-display text-base text-foreground">Aura</span>
          </div>
          <p>© 2026 Aura. Designed with care.</p>
          <div className="flex gap-6">
            <a className="hover:text-foreground transition-colors" href="#">Privacy</a>
            <a className="hover:text-foreground transition-colors" href="#">Terms</a>
            <a className="hover:text-foreground transition-colors" href="#">Twitter</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
