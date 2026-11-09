import { test, expect } from 'bun:test';
import { SessionVault, type VaultStorage } from '../electron/session-vault';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
function fixture() {
  const data = new Map<string, unknown>();
  const storage: VaultStorage = { get: (key) => data.get(key), set: (key, value) => { data.set(key, value); }, delete: (key) => { data.delete(key); } };
  const key = randomBytes(32); let available = true;
  const crypto = {
    available: () => available,
    encrypt: (value: string) => { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv); const bytes = Buffer.concat([cipher.update(value), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), bytes]); },
    decrypt: (value: Buffer) => { const cipher = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12)); cipher.setAuthTag(value.subarray(12, 28)); return Buffer.concat([cipher.update(value.subarray(28)), cipher.final()]).toString(); },
  };
  return { data, storage, crypto, disable: () => { available = false; }, enable: () => { available = true; } };
}
const tokens = { access_token: 'private-access-token', refresh_token: 'private-refresh-token' };
test('persists only ciphertext and restores across vault instances', () => {
  const f = fixture(); new SessionVault(f.storage, f.crypto).save(tokens);
  expect(JSON.stringify([...f.data])).not.toContain('private-access');
  expect(new SessionVault(f.storage, f.crypto).load()).toEqual(tokens);
});
test('legacy plaintext is migrated and removed', () => {
  const f = fixture(); f.data.set('session', tokens);
  expect(new SessionVault(f.storage, f.crypto).load()).toEqual(tokens);
  expect(f.data.has('session')).toBe(false); expect(f.data.has('sessionEncrypted')).toBe(true);
});
test('unavailable OS key store uses memory only, then flushes after readiness', () => {
  const f = fixture(); f.disable(); const vault = new SessionVault(f.storage, f.crypto); vault.save(tokens);
  expect(f.data.size).toBe(0); expect(vault.load()).toEqual(tokens);
  f.enable(); vault.flush(); expect(new SessionVault(f.storage, f.crypto).load()).toEqual(tokens);
});
test('corrupt or invalid saved sessions are discarded without crashing', () => {
  const f = fixture(); f.data.set('sessionEncrypted', 'corrupted');
  expect(new SessionVault(f.storage, f.crypto).load()).toBeNull(); expect(f.data.size).toBe(0);
  expect(() => new SessionVault(f.storage, f.crypto).save({access_token: '\nbad',refresh_token:'token'})).toThrow();
});
test('logout removes both formats and only broadcasts once', () => {
  const f = fixture(); const vault = new SessionVault(f.storage, f.crypto); vault.save(tokens);
  expect(vault.clear()).toBe(true); expect(vault.clear()).toBe(false); expect(vault.load()).toBeNull(); expect(f.data.size).toBe(0);
});
test('switching accounts without key-store access cannot restore the previous account', () => {
  const f = fixture(); const vault = new SessionVault(f.storage, f.crypto); vault.save(tokens);
  f.disable(); vault.save({access_token:'different-user',refresh_token:'different-refresh'}); f.enable();
  expect(new SessionVault(f.storage, f.crypto).load()).toBeNull();
});
test('encryption failures erase legacy plaintext and stale ciphertext', () => {
  const f = fixture(); f.data.set('session',tokens); f.data.set('sessionEncrypted','old-account');
  const crypto = {...f.crypto,encrypt:()=>{throw new Error('OS encryption failed')}};
  const vault=new SessionVault(f.storage, crypto);expect(()=>vault.save(tokens)).not.toThrow();expect(vault.load()).toEqual(tokens);expect(f.data.size).toBe(0);
});
