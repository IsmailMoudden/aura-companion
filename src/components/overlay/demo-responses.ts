// Demo mode — hardcoded responses for screen recording.
// Delete this file and the VITE_DEMO_MODE env var after the launch video is recorded.

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

const RESPONSES: { test: (s: string) => boolean; text: string }[] = [
  {
    // Scenario 1 — Research paper
    test: (s) => /summaris|summariz|tldr/i.test(s),
    text: `**Core idea:** Multiple LLMs in layers, each refining the previous, beat any single frontier model. Aggregation catches blind spots.

**Key result:** Open-source MoA beats GPT-4 Omni on AlpacaEval 2.0.

**What you can steal:** Run two cheap models in parallel for your memory extraction (Kimi + Llama 3.3), then a third pass reconciles. More accurate, same latency since it's async.`,
  },
  {
    // Scenario 2 — YouTube video
    test: (s) => /scared|should i be scared/i.test(s),
    text: `**Ironic question to ask me, but I'll try to be honest.**

Credible speaker, clickbait packaging. Likely Hinton or Mo Gawdat. The "*extremely dangerous now*" framing is overcooked — real researchers talk future risk, not present.

**Real concerns:** job displacement, alignment, pace outrunning safety.
**Hype:** compressed timelines, "they don't want you to know" tone.

Watch on 1.5x, skip the intro. And read someone who *isn't* an AI to balance my take.`,
  },
  {
    // Scenario 3 — Investor email
    test: (s) => /what do you think|should i send/i.test(s),
    text: `**Don't send it yet. Cut these three:**

1. **"To be honest we're a bit behind"** — never open with weakness.
2. **"I had to rebuild it twice"** — sounds like execution problems, not learning.
3. **"Not much more to show right now"** — you're telling him not to engage. Kill it.

Also drop "working day and night." Reads as panic.

---

**Rewrite:**

Hi Marcus,

Quick update on Aura. 40 users, DAU/MAU above 60%, ahead of where I expected this early. The memory layer took longer because we rebuilt it for multi-session context, and that's already paying off in retention.

Happy to jump on a call this week to walk through the data and what's next.

Best,
[name]`,
  },
  {
    // Scenario 4 — Financial model
    test: (s) => /looks good|final check/i.test(s),
    text: `**Almost. Three things first:**

1. **Revenue assumptions are too conservative** — 8% MoM is below your last 3 months (12, 14, 11%). Investors will spot it.
2. **CAC missing in months 7-12** — formula stops at row 14. Fix before sending.
3. **Runway is solid.** 18 months base, 14 worst-case. Lead with that.

Fix the CAC and it's ready.

> Don't forget to send it to Marcus — he asked before Friday and today is Thursday.`,
  },
];

export function matchDemoResponse(input: string): string | null {
  return RESPONSES.find((r) => r.test(input))?.text ?? null;
}

// Stream a string char-by-char at ~30 chars/sec with ±15% jitter.
// Calls onChunk with the growing text after each character.
// Returns a cancel function.
export function streamDemoResponse(
  text: string,
  onChunk: (partial: string) => void,
  onDone: () => void,
): () => void {
  let cancelled = false;
  let pos = 0;

  const BASE_DELAY = 1000 / 30; // ~33ms per char = 30 chars/sec

  const tick = () => {
    if (cancelled || pos >= text.length) {
      if (!cancelled) onDone();
      return;
    }
    onChunk(text.slice(0, pos + 1));
    pos++;
    const jitter = BASE_DELAY * 0.15 * (Math.random() * 2 - 1);
    setTimeout(tick, BASE_DELAY + jitter);
  };

  // 400-600ms thinking pause before first character
  const thinkDelay = 400 + Math.random() * 200;
  const timer = setTimeout(tick, thinkDelay);

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
