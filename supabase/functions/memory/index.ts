import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { emptyMemory, validMemoryValue, type Category } from '../_shared/memory.ts';
import { readRequestBody } from '../chat/request-body.ts';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (!['GET', 'POST'].includes(request.method)) return respond({ error: 'Method not allowed' }, 405);
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return respond({ error: 'Unauthorized' }, 401);
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization }, fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) } });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return respond({ error: 'Unauthorized' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) } });
    if (request.method === 'GET') {
      const { data, error } = await admin.from('user_profile').select('identity,projects,topics,memory_notes,profile_updated_at').eq('id', user.id).maybeSingle();
      return error ? respond({ error: 'Memory is temporarily unavailable.' }, 503) : respond({ profile: data ?? emptyMemory() });
    }
    let body;
    try { body = JSON.parse(await readRequestBody(request, 64_000)); }
    catch (error) { return respond({ error: error instanceof RangeError ? 'Request too large' : 'Invalid JSON' }, error instanceof RangeError ? 413 : 400); }
    if (!body || typeof body !== 'object') return respond({ error: 'Invalid memory operation' }, 400);
    const { category, key, expected, value, action } = body;
    if (!['identity', 'projects', 'topics', 'memory_notes'].includes(category) || typeof key !== 'string' || key.length > 40 || !['add', 'edit', 'delete'].includes(action)
      || (action === 'add' && category !== 'memory_notes') || (action !== 'add' && expected == null)
      || (category !== 'identity' && action !== 'add' && !/^\d{1,4}$/.test(key))
      || (action !== 'delete' && !validMemoryValue(category as Category, key, value))) return respond({ error: 'Invalid memory value' }, 400);
    const { data, error } = await admin.rpc('edit_user_memory', { p_user_id: user.id, p_category: category, p_key: key, p_expected: expected ?? null, p_value: action === 'delete' ? null : value, p_action: action });
    if (error) {
      // Application conflicts must not use retryable SQL serialization errors.
      if (error.message === 'Memory changed') return respond({ error: 'This memory changed. Reload it before editing again.' }, 409);
      if (error.message === 'Memory limit reached') return respond({ error: 'You can keep up to 50 remembered facts. Delete a fact before adding another.' }, 400);
      console.error(JSON.stringify({ event: 'memory_write_failed', code: error.code, action, category }));
      return respond({ error: 'Memory could not be saved.' }, 503);
    }
    return respond({ profile: data });
  } catch { return respond({ error: 'Memory is temporarily unavailable.' }, 503); }
});
