import { readFile } from 'node:fs/promises';
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !ref || !/^[a-z0-9]+$/.test(ref)) throw new Error('Missing Supabase deployment credentials');
const configuredHost = new URL(process.env.VITE_SUPABASE_URL || 'https://mkzdienngrisxrvkvgrv.supabase.co').hostname;
if (configuredHost.endsWith('.supabase.co') && ref !== configuredHost.split('.')[0]) throw new Error('Project reference differs from the configured Supabase URL');
const endpoint = `https://api.supabase.com/v1/projects/${ref}/database/query`;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const preflight = await fetch(endpoint, {
  method: 'POST', signal: AbortSignal.timeout(15_000), headers,
  body: JSON.stringify({ read_only: false, query: "select current_user as execution_role, current_setting('transaction_read_only') as read_only, current_setting('default_transaction_read_only') as default_read_only, pg_is_in_recovery() as recovery" }),
});
if (!preflight.ok) throw new Error(`Cannot verify database write access: HTTP ${preflight.status}`);
const rows = await preflight.json();
const access = Array.isArray(rows) ? rows[0] : null;
if (!access) throw new Error('Unexpected database preflight response');
console.log(JSON.stringify({ execution_role: access.execution_role, read_only: access.read_only, default_read_only: access.default_read_only, recovery: access.recovery }));
if (access.read_only === 'on' || access.recovery === true) throw new Error(`Migration blocked: database execution is read-only (role: ${access.execution_role}). No schema changes attempted.`);
const migration = await readFile(new URL('../supabase/migrations/20261109000000_atomic_ai_quota.sql', import.meta.url), 'utf8');
const response = await fetch(endpoint, {
  method: 'POST', signal: AbortSignal.timeout(30_000),
  headers,
  body: JSON.stringify({ query: `begin;\n${migration}\ncommit;`, read_only: false }),
});
if (!response.ok) {
  const error = await response.json().catch(() => ({}));
  const reason = typeof error.message === 'string' ? error.message.slice(0, 1500).replace(/sbp_[A-Za-z0-9_-]+/g, '[redacted]') : '';
  throw new Error(`Quota migration failed: HTTP ${response.status}${reason ? ` — ${reason}` : ''}`);
}
console.log('Atomic quota migration applied.');

// Exercise the real schema (including production triggers) without charging a user.
const health = await fetch(endpoint, {
  method: 'POST', signal: AbortSignal.timeout(30_000), headers,
  body: JSON.stringify({ read_only: false, query: `begin;
    do $$ declare test_user uuid; begin
      select id into test_user from auth.users order by created_at limit 1;
      if test_user is not null then
        perform * from public.reserve_ai_usage(test_user, 'auto', 300, gen_random_uuid());
      end if;
    end $$;
    rollback;` }),
});
if (!health.ok) {
  const error = await health.json().catch(() => ({}));
  throw new Error(`Quota runtime check failed: HTTP ${health.status} — ${String(error.message ?? '').slice(0, 1200).replace(/sbp_[A-Za-z0-9_-]+/g, '[redacted]')}`);
}
// Confirm PostgREST sees the RPC after migration. Invalid quota fails before any writes.
const keysResponse = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, { headers, signal: AbortSignal.timeout(15_000) });
if (!keysResponse.ok) throw new Error(`Cannot verify quota API: HTTP ${keysResponse.status}`);
const keys = await keysResponse.json();
const serviceKey = keys.find((key) => key.name === 'service_role')?.api_key;
if (!serviceKey) throw new Error('Quota API verification requires the project service role key');
if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${serviceKey}`);
const rpc = await fetch(`https://${configuredHost}/rest/v1/rpc/reserve_ai_usage`, {
  method: 'POST', signal: AbortSignal.timeout(15_000),
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_user_id: '00000000-0000-4000-8000-000000000000', p_model: 'auto', p_default_limit: 0, p_request_id: crypto.randomUUID() }),
});
const rpcResult = await rpc.json();
if (rpcResult.code !== 'P0001' || rpcResult.message !== 'Invalid quota') {
  throw new Error(`Quota API check failed: HTTP ${rpc.status} — ${rpcResult.code ?? 'unknown'}: ${String(rpcResult.message ?? '').slice(0, 500)}`);
}
console.log('Production quota SQL and REST checks passed; no usage charged.');
