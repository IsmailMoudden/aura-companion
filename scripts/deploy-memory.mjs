import { readFile } from 'node:fs/promises';
const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !/^[a-z0-9]+$/.test(ref) || !token) throw new Error('Missing memory deployment credentials');
const sql = await readFile(new URL('../supabase/migrations/20261111000000_memory_management.sql', import.meta.url), 'utf8');
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30_000),
  body: JSON.stringify({ read_only: false, query: `begin;\n${sql}\ncommit;` }),
});
if (!response.ok) {
  const error = await response.json().catch(() => ({}));
  throw new Error(`Memory migration failed: HTTP ${response.status} — ${String(error.message ?? '').slice(0, 1000).replace(/sbp_[A-Za-z0-9_-]+/g, '[redacted]')}`);
}
console.log('Memory management schema applied.');
