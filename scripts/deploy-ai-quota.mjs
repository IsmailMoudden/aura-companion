import { readFile } from 'node:fs/promises';
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !ref || !/^[a-z0-9]+$/.test(ref)) throw new Error('Missing Supabase deployment credentials');
const migration = await readFile(new URL('../supabase/migrations/20261109000000_atomic_ai_quota.sql', import.meta.url), 'utf8');
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST', signal: AbortSignal.timeout(30_000),
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: `begin;\n${migration}\ncommit;` }),
});
if (!response.ok) {
  const error = await response.json().catch(() => ({}));
  const reason = typeof error.message === 'string' ? error.message.slice(0, 1500).replace(/sbp_[A-Za-z0-9_-]+/g, '[redacted]') : '';
  throw new Error(`Quota migration failed: HTTP ${response.status}${reason ? ` — ${reason}` : ''}`);
}
console.log('Atomic quota migration applied.');
