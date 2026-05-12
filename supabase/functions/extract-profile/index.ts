import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const KIMI_BASE = 'https://api.moonshot.ai/v1';
const INACTIVE_MINUTES = 30;

const EXTRACTION_PROMPT = `You are a memory extraction assistant for an AI companion called Aura.

You will receive a conversation between a user and Aura. Your job is to extract structured information about the user to build their personal profile. Only extract facts that are clearly stated or strongly implied — never guess or invent.

Return a JSON object with this exact shape:
{
  "identity": {
    "name": string | null,
    "job": string | null,
    "timezone": string | null,
    "languages": string[],
    "communication_style": "technical" | "casual" | "mixed" | null
  },
  "projects": [
    {
      "name": string,
      "stack": string[],
      "description": string,
      "status": "active" | "paused" | "shipped",
      "last_mentioned_at": string
    }
  ],
  "topics": [
    { "label": string }
  ],
  "memory_notes": [
    { "fact": string }
  ]
}

Rules:
- If a field cannot be determined, use null or []
- projects: only include projects the user is clearly building themselves
- topics: recurring themes (e.g. "Electron", "auth flows", "UI design", "deployment")
- memory_notes: specific facts worth remembering ("prefers concise answers", "works late at night", "building for macOS first")
- Return ONLY valid JSON, no explanation, no markdown fences`;

type ProfileData = {
  identity: {
    name: string | null;
    job: string | null;
    timezone: string | null;
    languages: string[];
    communication_style: 'technical' | 'casual' | 'mixed' | null;
  };
  projects: {
    name: string;
    stack: string[];
    description: string;
    status: 'active' | 'paused' | 'shipped';
    last_mentioned_at: string;
  }[];
  topics: { label: string }[];
  memory_notes: { fact: string }[];
};

type ExistingProfile = {
  identity: Record<string, unknown>;
  projects: { name: string; stack: string[]; description: string; status: string; last_mentioned_at: string }[];
  topics: { label: string; count: number }[];
  memory_notes: { fact: string; learned_at: string }[];
};

function mergeProfiles(existing: ExistingProfile, extracted: ProfileData, now: string): ExistingProfile {
  // Identity: merge non-null fields only
  const identity = { ...existing.identity };
  for (const [k, v] of Object.entries(extracted.identity)) {
    if (v !== null && v !== undefined && (Array.isArray(v) ? v.length > 0 : true)) {
      (identity as Record<string, unknown>)[k] = v;
    }
  }

  // Projects: upsert by name
  const projects = [...existing.projects];
  for (const p of extracted.projects) {
    const idx = projects.findIndex((ep) => ep.name.toLowerCase() === p.name.toLowerCase());
    if (idx >= 0) {
      projects[idx] = { ...projects[idx], ...p, last_mentioned_at: now };
    } else {
      projects.push({ ...p, last_mentioned_at: now });
    }
  }

  // Topics: increment count or add
  const topics = [...existing.topics];
  for (const t of extracted.topics) {
    const idx = topics.findIndex((et) => et.label.toLowerCase() === t.label.toLowerCase());
    if (idx >= 0) {
      topics[idx] = { ...topics[idx], count: (topics[idx].count ?? 1) + 1 };
    } else {
      topics.push({ label: t.label, count: 1 });
    }
  }
  // Keep top 30 topics by count
  topics.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  topics.splice(30);

  // Memory notes: append new facts, deduplicate loosely, keep latest 50
  const notes = [...existing.memory_notes];
  for (const n of extracted.memory_notes) {
    const isDupe = notes.some((en) =>
      en.fact.toLowerCase().includes(n.fact.toLowerCase().slice(0, 20))
    );
    if (!isDupe) notes.push({ fact: n.fact, learned_at: now });
  }
  notes.splice(50);

  return { identity, projects, topics, memory_notes: notes };
}

Deno.serve(async (req: Request) => {
  // Allow cron invocations (no auth header from pg_cron)
  // Service role key is passed as bearer by Supabase cron scheduler
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  const kimiKey = Deno.env.get('KIMI_API_KEY');
  if (!kimiKey) return new Response('Missing KIMI_API_KEY', { status: 500 });

  const cutoff = new Date(Date.now() - INACTIVE_MINUTES * 60 * 1000).toISOString();

  // Find conversations inactive for 30min that haven't been extracted yet
  const { data: convos, error: convErr } = await supabase
    .from('conversations')
    .select('id, user_id, title')
    .lt('last_message_at', cutoff)
    .is('profile_extracted_at', null)
    .limit(10); // process max 10 per cron tick

  if (convErr) return new Response(convErr.message, { status: 500 });
  if (!convos || convos.length === 0) return new Response('No conversations to process', { status: 200 });

  const now = new Date().toISOString();
  let processed = 0;

  for (const convo of convos) {
    try {
      // Fetch messages
      const { data: messages } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', convo.id)
        .order('created_at', { ascending: true });

      if (!messages || messages.length < 2) {
        // Mark as extracted even if too short — nothing to learn
        await supabase.from('conversations').update({ profile_extracted_at: now }).eq('id', convo.id);
        continue;
      }

      // Format conversation for extraction
      const transcript = messages
        .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Aura'}: ${m.content}`)
        .join('\n\n');

      // Call Kimi to extract profile data
      const res = await fetch(`${KIMI_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kimiKey}` },
        body: JSON.stringify({
          model: 'moonshot-v1-8k',
          messages: [
            { role: 'system', content: EXTRACTION_PROMPT },
            { role: 'user', content: `Conversation title: "${convo.title}"\n\n${transcript}` },
          ],
          temperature: 0.1,
          max_tokens: 1000,
        }),
      });

      if (!res.ok) {
        console.error(`Kimi error for convo ${convo.id}:`, res.status);
        continue;
      }

      const json = await res.json() as { choices: { message: { content: string } }[] };
      const raw = json.choices[0]?.message?.content ?? '';

      let extracted: ProfileData;
      try {
        extracted = JSON.parse(raw);
      } catch {
        console.error(`Failed to parse extraction for convo ${convo.id}:`, raw);
        await supabase.from('conversations').update({ profile_extracted_at: now }).eq('id', convo.id);
        continue;
      }

      // Load existing profile
      const { data: profileRow } = await supabase
        .from('user_profile')
        .select('identity, projects, topics, memory_notes')
        .eq('id', convo.user_id)
        .single();

      const existing: ExistingProfile = profileRow ?? {
        identity: {},
        projects: [],
        topics: [],
        memory_notes: [],
      };

      const merged = mergeProfiles(existing, extracted, now);

      // Upsert profile
      await supabase.from('user_profile').upsert({
        id: convo.user_id,
        ...merged,
        profile_updated_at: now,
      });

      // Mark conversation as processed
      await supabase.from('conversations').update({ profile_extracted_at: now }).eq('id', convo.id);

      processed++;
    } catch (err) {
      console.error(`Error processing convo ${convo.id}:`, err);
    }
  }

  return new Response(JSON.stringify({ processed, total: convos.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
