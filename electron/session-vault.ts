export type SessionTokens = { access_token: string; refresh_token: string };
export function validTokens(value: unknown): value is SessionTokens {
  if (!value || typeof value !== 'object') return false;
  const tokens = value as Partial<SessionTokens>;
  return [tokens.access_token, tokens.refresh_token].every((token) => typeof token === 'string' && token.length > 0 && token.length <= 32768 && !/[\u0000-\u0020]/.test(token));
}
export interface VaultStorage {
  get(key: 'session' | 'sessionEncrypted'): unknown;
  set(key: 'sessionEncrypted', value: string): void;
  delete(key: 'session' | 'sessionEncrypted'): void;
}
export interface VaultCrypto { available(): boolean; encrypt(value: string): Buffer; decrypt(value: Buffer): string; }

export class SessionVault {
  private memory: SessionTokens | null | undefined;
  constructor(private storage: VaultStorage, private crypto: VaultCrypto) {}
  save(tokens: unknown): void {
    if (!validTokens(tokens)) throw new Error('Invalid session');
    this.memory = { access_token: tokens.access_token, refresh_token: tokens.refresh_token };
    // An unavailable OS key store never causes plaintext persistence.
    try {
      if (this.crypto.available()) this.storage.set('sessionEncrypted', this.crypto.encrypt(JSON.stringify(this.memory)).toString('base64'));
      else this.storage.delete('sessionEncrypted');
    } catch {
      // A locked or denied key store must not crash sign-in or restore an older account.
      this.storage.delete('sessionEncrypted');
    } finally { this.storage.delete('session'); }
  }
  load(): SessionTokens | null {
    if (this.memory !== undefined) return this.memory;
    const encrypted = this.storage.get('sessionEncrypted');
    if (typeof encrypted === 'string' && encrypted) {
      if (!this.crypto.available()) return null;
      try {
        const tokens: unknown = JSON.parse(this.crypto.decrypt(Buffer.from(encrypted, 'base64')));
        if (!validTokens(tokens)) throw new Error('Invalid saved session');
        this.memory = tokens;
        return tokens;
      } catch { this.clear(); return null; }
    }
    const legacy = this.storage.get('session');
    if (validTokens(legacy)) { this.save(legacy); return this.memory ?? null; }
    this.storage.delete('session');
    return null;
  }
  flush(): void { if (this.memory) this.save(this.memory); }
  clear(): boolean {
    const hadSession = !!this.memory || !!this.storage.get('sessionEncrypted') || !!this.storage.get('session');
    this.memory = null;
    this.storage.delete('session'); this.storage.delete('sessionEncrypted');
    return hadSession;
  }
}
