import { test, expect } from 'bun:test';
import { readRequestBody } from '../supabase/functions/chat/request-body';
test('bounds streaming bodies even without a content-length header', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(8)); }, cancel() { cancelled = true; } });
  const request = new Request('https://example.test', { method:'POST', body:stream, duplex:'half' } as RequestInit);
  await expect(readRequestBody(request,10)).rejects.toThrow(RangeError); expect(cancelled).toBe(true);
});
test('preserves UTF-8 characters split across chunks', async () => {
  const bytes = new TextEncoder().encode('réponse'); let index=0;
  const stream = new ReadableStream({pull(c) { if(index===bytes.length)c.close();else { c.enqueue(bytes.slice(index,index+1)); index++; } }});
  expect(await readRequestBody(new Request('https://example.test',{method:'POST',body:stream,duplex:'half'} as RequestInit))).toBe('réponse');
});
