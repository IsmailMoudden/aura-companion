// One disposable, confirmed account; never emails anyone or uses a customer's session.
const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !/^[a-z0-9]+$/.test(ref) || !token) throw new Error('Missing smoke-test credentials');
const base = `https://${ref}.supabase.co`;
const keysResponse = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
if (!keysResponse.ok) throw new Error(`Cannot load smoke-test credentials: HTTP ${keysResponse.status}`);
const keys = await keysResponse.json();
const key = keys.find((entry) => entry.name === 'service_role')?.api_key;
const anon = keys.find((entry) => entry.name === 'anon')?.api_key;
if (!key || !anon) throw new Error('Missing project API keys');
if (process.env.GITHUB_ACTIONS) { console.log(`::add-mask::${key}`); console.log(`::add-mask::${anon}`); }
const adminHeaders = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const email = `aura-smoke-${crypto.randomUUID()}@example.invalid`;
const password = crypto.randomUUID() + crypto.randomUUID();
let userId;
try {
  const created = await fetch(`${base}/auth/v1/admin/users`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { purpose: 'temporary-deployment-smoke-test' } }), signal: AbortSignal.timeout(15_000) });
  if (!created.ok) throw new Error(`Cannot create smoke-test account: HTTP ${created.status}`);
  userId = (await created.json()).id;
  if (!userId) throw new Error('Smoke-test account ID missing');
  const signedIn = await fetch(`${base}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(15_000) });
  if (!signedIn.ok) throw new Error(`Smoke-test sign-in failed: HTTP ${signedIn.status}`);
  const session = await signedIn.json();
  if (process.env.GITHUB_ACTIONS) { console.log(`::add-mask::${session.access_token}`); console.log(`::add-mask::${session.refresh_token}`); }
  const chat = await fetch(`${base}/functions/v1/chat`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'auto', messages: [{ role: 'user', content: 'Reply with exactly AURA_OK.' }] }), signal: AbortSignal.timeout(60_000) });
  const result = await chat.json();
  if (!chat.ok || !result.reply?.trim()) throw new Error(`Authenticated chat smoke test failed: HTTP ${chat.status}, ${String(result.error ?? 'empty reply').slice(0, 150)}`);
  console.log('PASS: authenticated production chat returned a non-empty AI reply.');
} finally {
  if (userId) {
    const removed = await fetch(`${base}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE', headers: adminHeaders, signal: AbortSignal.timeout(15_000) });
    if (!removed.ok) throw new Error(`Smoke-test cleanup failed: HTTP ${removed.status}`);
    console.log('Disposable smoke-test account and quota data removed.');
  }
}
