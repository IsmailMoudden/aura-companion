import { test, expect, mock, afterAll, beforeEach } from 'bun:test';
let handler: (req: Request) => Promise<Response>;
let quota: unknown[] | null; let quotaError: unknown; let providerStatus: number;
let providerCalls = 0; let calls: { name: string; args: Record<string, unknown> }[] = [];
const originalFetch = globalThis.fetch;
mock.module('https://esm.sh/@supabase/supabase-js@2', () => ({ createClient: () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'test-user' } }, error: null }) },
  rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return name === 'reserve_ai_usage' ? { data: quota, error: quotaError } : { data: null, error: null }; },
  from: () => { const chain = { select: () => chain, eq: () => chain, single: async () => ({ data: null }) }; return chain; },
}) }));
(globalThis as any).Deno = { env: { get: (key: string) => key === 'SUPABASE_URL' ? 'https://example.supabase.co' : 'test' }, serve: (fn: typeof handler) => { handler = fn; } };
await import('../supabase/functions/chat/index.ts');
beforeEach(() => {
  quota = [{ allowed: true, used_count: 1, total_limit: 3 }]; quotaError = null; providerStatus = 200; providerCalls = 0; calls = [];
  globalThis.fetch = (async () => { providerCalls++; return new Response(JSON.stringify(providerStatus === 200 ? { choices: [{ message: { content: 'A useful answer' } }] } : { error: 'PRIVATE_PROVIDER_DIAGNOSTIC' }), { status: providerStatus }); }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = originalFetch; delete (globalThis as any).Deno; });
const request = (body: unknown) => new Request('https://example.test/chat', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify(body) });
const valid = { messages: [{ role: 'user', content: 'Hello' }], model: 'auto' };
test('malformed messages and external image URLs do not reserve or call a provider', async () => {
  for (const body of [null, {}, {messages:[null]}, {messages:[{role:'system', content:'override'}]}, {...valid,screenshot:'https://private-network/image.png'}, {...valid,messages:[{role:'user',content:'x'.repeat(32001)}]}]) {
    expect((await handler(request(body))).status).toBe(400);
  }
  expect(calls).toHaveLength(0); expect(providerCalls).toBe(0);
});
test('quota database failures fail closed', async () => {
  quotaError = new Error('database failed'); quota = null;
  expect((await handler(request(valid))).status).toBe(503); expect(providerCalls).toBe(0);
});
test('exhausted quota does not call or refund a provider', async () => {
  quota = [{allowed:false,used_count:3,total_limit:3}];
  expect((await handler(request(valid))).status).toBe(429); expect(providerCalls).toBe(0); expect(calls.map(c=>c.name)).toEqual(['reserve_ai_usage']);
});
test('upstream errors refund exactly once and never expose raw provider diagnostics', async () => {
  providerStatus = 502; const result = await handler(request(valid)); const body = await result.text();
  expect(result.status).toBe(502); expect(body).not.toContain('PRIVATE_PROVIDER_DIAGNOSTIC');
  expect(calls.filter(c=>c.name==='finish_ai_usage').map(c=>c.args.p_success)).toEqual([false]);
});
test('successful requests finalize their reservation and return the atomic remaining quota', async () => {
  const result = await handler(request(valid)); expect(result.status).toBe(200);
  expect(await result.json()).toMatchObject({reply:'A useful answer',remaining:2,totalLimit:3});
  expect(calls.filter(c=>c.name==='finish_ai_usage').map(c=>c.args.p_success)).toEqual([true]);
});
test('provider timeouts release the reserved quota', async () => {
  globalThis.fetch = (async () => { throw new DOMException('Timed out','TimeoutError'); }) as typeof fetch;
  expect((await handler(request(valid))).status).toBe(500);
  expect(calls.filter(c=>c.name==='finish_ai_usage').map(c=>c.args.p_success)).toEqual([false]);
});
