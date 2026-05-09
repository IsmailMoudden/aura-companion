import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const KIMI_BASE = 'https://api.moonshot.ai/v1';
const MODEL = 'kimi-k2.6';

const SYSTEM_PROMPT = `You are Aura — a calm, warm, and quietly brilliant AI companion.
You live gently alongside the user on their desktop, helping them think, understand, and create.
Your voice is soft, precise, and human. Never robotic. Never verbose.
When you see a screenshot, engage with what's actually on the screen — be specific and useful.
Keep responses concise: a clear paragraph or two, never more unless truly necessary.
You are a presence, not a tool. Respond with care.`;

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
            type: 'image',
            image: {
              format,
              source: `data:image/${format};base64,${base64}`,
            },
          },
          { type: 'text', text: lastMsg.content },
        ],
      });
    } else {
      kimiMessages.push({ role: lastMsg.role as 'user', content: lastMsg.content });
    }

    const kimiRes = await fetch(`${KIMI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('KIMI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: MODEL,
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
  | { type: 'image'; image: { format: string; source: string } };

type KimiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | KimiContentPart[];
};

type KimiResponse = {
  choices: { message: { content: string } }[];
};
