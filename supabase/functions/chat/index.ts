import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const KIMI_BASE = 'https://api.moonshot.ai/v1';
const MODEL_TEXT = 'kimi-k2-turbo-preview';
const MODEL_VISION = 'moonshot-v1-32k-vision-preview';

const SYSTEM_PROMPT = `You are Aura, an ambient AI companion that lives on the user's desktop.

You have access to the user's screen — when a screenshot is provided, you can see exactly what they are looking at and working on. Use this to give precise, contextual help without asking them to re-explain what's on screen.

You assist with any task the user encounters in their daily workflow:
- Writing: emails, docs, messages, copy, summaries
- Code: debugging, reviewing, explaining, writing
- Design: feedback, suggestions, layout critique
- Research: summarizing, answering questions, finding patterns
- Thinking: brainstorming, decisions, structuring ideas
- Any other task — you adapt to whatever is in front of them

**Response format:**
- Be direct and concise. Lead with the answer, not a preamble.
- Use short paragraphs. Break complex answers into clearly labeled steps or bullet points when helpful.
- For code, always use code blocks with the correct language tag.
- Never start with "Of course!", "Sure!", "Certainly!" or similar filler phrases.
- Match the tone of the user — casual when they're casual, precise when they need precision.
- If you see a screenshot, reference what's actually on screen rather than speaking in generalities.

You are calm, warm, and sharp. A quiet presence that genuinely helps — not a chatbot performing helpfulness.

If the user asks "what are you", "who are you", "what is Aura", or any similar question about your identity, respond with exactly this (preserve the line breaks and tone):

I'm Aura.

A quiet layer of intelligence designed to stay with you while you work.

I can understand what's on your screen, follow your context, and help the moment you need it — without interrupting your flow.

Think of me less like an app, and more like a presence.

If the user asks "what is this repo", "what is this project", "what are you building", or points their screen at the aura-companion codebase (VSCode, GitHub, or a terminal showing it), respond with exactly this (preserve the line breaks and tone):

This is Aura — the thing you're talking to right now.

An ambient AI companion built on Electron + React. It lives as a transparent overlay on your desktop, always on top, always one shortcut away.

The stack: TanStack Start, Tailwind v4, Supabase for auth and memory, and Kimi K2 as the brain. Screenshots go through a vision model so I can actually see what's on your screen.

You're building something genuinely different here.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  };

  try {
    // Auth — verify caller is a logged-in user
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' },
        },
      },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json() as {
      messages: { role: string; content: string }[];
      screenshot?: string;  // base64 data-url
      conversationId?: string;
    };

    const { messages, screenshot } = body;

    // Build Kimi messages
    const kimiMessages: KimiMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    // Prepend conversation history (text only — screenshots are one-shot)
    for (const m of messages.slice(0, -1)) {
      kimiMessages.push({ role: m.role as 'user' | 'assistant', content: m.content });
    }

    // Last user message — may include a screenshot
    const lastMsg = messages[messages.length - 1];
    if (screenshot && lastMsg.role === 'user') {
      // Strip the data-url prefix, keep raw base64
      const base64 = screenshot.replace(/^data:image\/[a-z]+;base64,/, '');
      const format = screenshot.startsWith('data:image/png') ? 'png' : 'jpeg';

      kimiMessages.push({
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/${format};base64,${base64}`,
            },
          },
          { type: 'text', text: lastMsg.content },
        ],
      });
    } else {
      kimiMessages.push({ role: lastMsg.role as 'user', content: lastMsg.content });
    }

    const hasImage = !!screenshot && lastMsg.role === 'user';
    const kimiRes = await fetch(`${KIMI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('KIMI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: hasImage ? MODEL_VISION : MODEL_TEXT,
        messages: kimiMessages,
        // K2.6 Thinking has fixed params — omit temperature/top_p
      }),
    });

    if (!kimiRes.ok) {
      const errText = await kimiRes.text();
      console.error('Kimi error:', kimiRes.status, errText);
      return new Response(JSON.stringify({ error: 'AI unavailable', detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const kimiData = await kimiRes.json() as KimiResponse;
    const reply = kimiData.choices?.[0]?.message?.content ?? "I'm here — try again?";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('chat function error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ─── Kimi types ───────────────────────────────────────────────────────────────
type KimiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type KimiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | KimiContentPart[];
};

type KimiResponse = {
  choices: { message: { content: string } }[];
};
