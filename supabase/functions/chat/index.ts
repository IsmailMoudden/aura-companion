import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const KIMI_BASE = 'https://api.moonshot.ai/v1';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

// ─── Model registry ───────────────────────────────────────────────────────────
type ModelId = 'auto' | 'gpt-4o' | 'claude-sonnet' | 'gemini-flash' | 'llama-3.3-70b';

const MODELS: Record<ModelId, { label: string; apiId: string; apiIdVision?: string; provider: 'kimi' | 'openrouter'; dailyLimit: number }> = {
  'auto':           { label: 'Auto (Kimi)',      apiId: 'moonshot-v1-8k',                    apiIdVision: 'moonshot-v1-32k-vision-preview', provider: 'kimi',        dailyLimit: 100 },
  'gpt-4o':         { label: 'GPT-4o',           apiId: 'openai/gpt-4o',                     provider: 'openrouter', dailyLimit: 20  },
  'claude-sonnet':  { label: 'Claude Sonnet',    apiId: 'anthropic/claude-sonnet-4-5',        provider: 'openrouter', dailyLimit: 25  },
  'gemini-flash':   { label: 'Gemini Flash',     apiId: 'google/gemini-flash-1.5',           provider: 'openrouter', dailyLimit: 80  },
  'llama-3.3-70b':  { label: 'Llama 3.3 70B',   apiId: 'meta-llama/llama-3.3-70b-instruct', provider: 'openrouter', dailyLimit: 60  },
};

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

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
};

type ApiResponse = {
  choices: { message: { content: string } }[];
};

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
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
      screenshot?: string;
      conversationId?: string;
      model?: ModelId;
    };

    const { messages, screenshot } = body;
    const modelId: ModelId = body.model && MODELS[body.model] ? body.model : 'auto';
    const modelCfg = MODELS[modelId];

    // ─── Rate limiting ────────────────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0];

    // Use service role client to bypass RLS for upsert
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: usageRow } = await adminSupabase
      .from('model_usage')
      .select('count')
      .eq('user_id', user.id)
      .eq('model', modelId)
      .eq('date', today)
      .single();

    const currentCount = usageRow?.count ?? 0;

    if (currentCount >= modelCfg.dailyLimit) {
      return new Response(JSON.stringify({
        error: 'daily_limit_reached',
        limit: modelCfg.dailyLimit,
        model: modelId,
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build message list
    const chatMessages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }];

    for (const m of messages.slice(0, -1)) {
      chatMessages.push({ role: m.role as 'user' | 'assistant', content: m.content });
    }

    const lastMsg = messages[messages.length - 1];
    const hasImage = !!screenshot && lastMsg.role === 'user';

    if (hasImage) {
      const base64 = screenshot!.replace(/^data:image\/[a-z]+;base64,/, '');
      const format = screenshot!.startsWith('data:image/png') ? 'png' : 'jpeg';
      chatMessages.push({
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/${format};base64,${base64}` } },
          { type: 'text', text: lastMsg.content },
        ],
      });
    } else {
      chatMessages.push({ role: lastMsg.role as 'user', content: lastMsg.content });
    }

    // ─── Route to provider ────────────────────────────────────────────────────
    let apiReply: string;

    if (modelCfg.provider === 'kimi') {
      const selectedModel = hasImage && modelCfg.apiIdVision ? modelCfg.apiIdVision : modelCfg.apiId;
      const res = await fetch(`${KIMI_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('KIMI_API_KEY')}` },
        body: JSON.stringify({ model: selectedModel, messages: chatMessages }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error('Kimi error:', res.status, err);
        return new Response(JSON.stringify({ error: 'AI unavailable', detail: err }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const data = await res.json() as ApiResponse;
      apiReply = data.choices?.[0]?.message?.content ?? "I'm here — try again?";

    } else {
      const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('OPENROUTER_API_KEY')}`,
          'HTTP-Referer': 'https://aura-companion.app',
          'X-Title': 'Aura',
        },
        body: JSON.stringify({ model: modelCfg.apiId, messages: chatMessages }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error('OpenRouter error:', res.status, err);
        return new Response(JSON.stringify({ error: 'AI unavailable', detail: err }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const data = await res.json() as ApiResponse;
      apiReply = data.choices?.[0]?.message?.content ?? "I'm here — try again?";
    }

    // Increment usage counter
    await adminSupabase.from('model_usage').upsert(
      { user_id: user.id, model: modelId, date: today, count: currentCount + 1 },
      { onConflict: 'user_id,model,date' },
    );

    const remaining = modelCfg.dailyLimit - (currentCount + 1);
    return new Response(JSON.stringify({ reply: apiReply, model: modelId, dailyLimit: modelCfg.dailyLimit, remaining }), {
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
