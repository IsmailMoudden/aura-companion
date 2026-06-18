import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/landing/section";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { GlassPanel } from "@/components/aura/glass-panel";
import { PillButton } from "@/components/aura/pill-button";
import { Reveal } from "@/components/aura/reveal";
import { Orb } from "@/components/aura/orb";
import {
  ArrowRight,
  BookOpen,
  Users,
  Zap,
  Mail,
  GitBranch,
  ShieldCheck,
  MessageCircle,
} from "lucide-react";

export const Route = createFileRoute("/teams")({
  head: () => ({
    meta: [
      { title: "Aura for Teams — Shared intelligence, without the noise" },
      {
        name: "description",
        content:
          "Give your company a collective mind. Aura for Teams centralises knowledge across every collaborator — no more lost context, no more endless recaps.",
      },
    ],
  }),
  component: Teams,
});

function Teams() {
  return (
    <main className="relative">
      {/* HERO */}
      <section className="relative flex min-h-[100vh] flex-col items-center justify-center px-6 pt-40 pb-24 text-center">
        <div className="absolute inset-x-0 top-32 -z-10 flex justify-center">
          <Orb size={380} state="thinking" className="opacity-80" />
        </div>

        <p
          className="text-xs uppercase tracking-[0.2em] text-muted-foreground animate-fade-up"
          style={{ animationDelay: "0.05s" }}
        >
          Aura for Teams
        </p>
        <h1
          className="mt-6 text-display text-[clamp(3rem,8vw,8rem)] max-w-5xl animate-fade-up"
          style={{ animationDelay: "0.1s" }}
        >
          One mind.<br />
          <em className="italic font-light text-muted-foreground/90">
            Shared across your team.
          </em>
        </h1>
        <p
          className="mt-8 max-w-xl text-lg font-light leading-relaxed text-muted-foreground animate-fade-up"
          style={{ animationDelay: "0.25s" }}
        >
          Aura gives your company a collective intelligence — an entity that already
          knows everything, without the emails, the recaps, or the lost context.
        </p>
        <div
          className="mt-12 flex flex-wrap items-center justify-center gap-4 animate-fade-up"
          style={{ animationDelay: "0.4s" }}
        >
          <PillButton size="lg" href="mailto:siraedge.tech@gmail.com">
            <Mail className="h-4 w-4" /> Talk to us
          </PillButton>
          <PillButton size="lg" variant="ghost" href="https://siratech.ch">
            siratech.ch <ArrowRight className="h-4 w-4" />
          </PillButton>
        </div>
        <p
          className="mt-8 text-xs text-muted-foreground/50 animate-fade-up"
          style={{ animationDelay: "0.55s" }}
        >
          Custom pilots · Enterprise pricing · siratech.ch
        </p>
      </section>

      {/* THE PROBLEM */}
      <Section
        eyebrow="The problem"
        title={<>Knowledge lives in inboxes.<br /><em className="italic text-muted-foreground/80">Not in minds.</em></>}
        description="Every new hire recaps from scratch. Every handoff loses nuance. Every decision hides in a thread no one can find. Aura ends that."
      >
        <Reveal variant="soft">
          <GlassPanel className="mx-auto max-w-3xl p-10 text-left space-y-8">
            <div className="space-y-6">
              {[
                {
                  before: "Can you catch me up on the Q3 decision?",
                  after: "Already in context. The Q3 pivot was driven by margin pressure in the EU segment — want the full thread?",
                },
                {
                  before: "Who was handling the Renault account before Marc left?",
                  after: "Sarah owned it until March. I have her last three briefs and the open items. Shall I surface them?",
                },
              ].map(({ before, after }, i) => (
                <div key={i} className="space-y-3">
                  <div className="ml-auto max-w-md rounded-3xl rounded-tr-md bg-white/[0.06] px-5 py-4 text-[15px] font-light">
                    {before}
                  </div>
                  <div className="max-w-lg">
                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Aura</p>
                    <p className="text-[17px] font-light leading-relaxed">{after}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </Reveal>
      </Section>

      {/* HOW IT WORKS */}
      <Section
        eyebrow="How it works"
        title="Collective memory. Individual awareness."
        description="Aura maintains two layers simultaneously — what the team knows, and what each collaborator needs to know right now."
      >
        <FeatureGrid
          items={[
            {
              icon: <BookOpen className="h-5 w-5" />,
              title: "Shared knowledge base",
              description:
                "Every meeting, document, and decision feeds a living company brain. Ask anything, get the full picture — instantly.",
            },
            {
              icon: <Users className="h-5 w-5" />,
              title: "Per-collaborator context",
              description:
                "Each team member gets their own awareness thread. Shared where it matters, private where it should be.",
            },
            {
              icon: <GitBranch className="h-5 w-5" />,
              title: "Continuous threads",
              description:
                "Projects, clients, decisions — Aura keeps every thread alive across people and time. Nothing is ever lost.",
            },
            {
              icon: <Zap className="h-5 w-5" />,
              title: "No more recapping",
              description:
                "Onboard in days, not months. Aura already knows the project, the history, the people. Just ask.",
            },
            {
              icon: <MessageCircle className="h-5 w-5" />,
              title: "Zero inbox tax",
              description:
                "Stop forwarding threads to loop people in. Aura routes context to whoever needs it, silently and instantly.",
            },
            {
              icon: <ShieldCheck className="h-5 w-5" />,
              title: "Privacy-first",
              description:
                "Granular access controls. Your data stays yours — no training on company knowledge without consent.",
            },
          ]}
        />
      </Section>

      {/* QUOTE */}
      <Section
        eyebrow="The vision"
        title={<>An entity that already<br /><em className="italic text-muted-foreground/80">knows everything.</em></>}
        description=""
      >
        <Reveal variant="soft">
          <GlassPanel strong className="mx-auto max-w-2xl p-12 text-center">
            <p className="text-display text-2xl leading-relaxed">
              "Imagine joining a team and the AI already knows every project,
              every client, every decision that shaped where you are today.
              No emails. No recaps. Just{" "}
              <em className="italic text-muted-foreground/80">presence.</em>"
            </p>
          </GlassPanel>
        </Reveal>
      </Section>

      {/* CTA */}
      <Section
        title={<>Ready to bring Aura<br /><em className="italic text-muted-foreground/80">to your company?</em></>}
        description="We're working with a small number of teams for the initial rollout. Get in touch and we'll design a pilot around your workflow."
      >
        <Reveal variant="soft">
          <div className="mx-auto max-w-lg space-y-6 text-center">
            <div className="flex flex-wrap justify-center gap-4">
              <PillButton size="lg" href="mailto:siraedge.tech@gmail.com">
                <Mail className="h-4 w-4" /> siraedge.tech@gmail.com
              </PillButton>
              <PillButton size="lg" variant="ghost" href="https://siratech.ch">
                siratech.ch <ArrowRight className="h-4 w-4" />
              </PillButton>
            </div>
            <p className="text-xs text-muted-foreground/50">
              Custom pilots · Enterprise pricing · Dedicated onboarding
            </p>
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
            <a className="hover:text-foreground transition-colors" href="/settings">Privacy</a>
            <a className="hover:text-foreground transition-colors" href="/settings">Terms</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
