import test from 'node:test';
import assert from 'node:assert/strict';
import { redirectPatch } from './ensure-auth-redirects.mjs';
const origin = 'https://aura.aura-companion.workers.dev';
test('repairs stale preview origin and preserves existing redirects', () => {
  const patch = redirectPatch({ site_url: 'https://stopped-preview.example', uri_allow_list: 'http://localhost:3000/auth' }, origin);
  assert.equal(patch.site_url, origin);
  assert.deepEqual(patch.uri_allow_list.split(','), ['http://localhost:3000/auth', `${origin}/auth`, `${origin}/auth?overlay=true`]);
});
test('correct configuration is idempotent', () => {
  assert.deepEqual(redirectPatch({ site_url: origin, uri_allow_list: `${origin}/auth,${origin}/auth?overlay=true` }, origin), {});
});
test('rejects insecure production origins', () => {
  assert.throws(() => redirectPatch({}, 'http://example.com'), /HTTPS/);
});
