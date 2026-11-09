import { randomBytes, timingSafeEqual } from 'node:crypto';
export class AuthAttempt {
  private pending: { state: string; expires: number } | null = null;
  constructor(private now = () => Date.now()) {}
  begin(): string {
    const state = randomBytes(32).toString('hex');
    this.pending = { state, expires: this.now() + 10 * 60_000 };
    return state;
  }
  consume(state: unknown): boolean {
    if (!this.pending || this.pending.expires <= this.now()) { this.pending = null; return false; }
    if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state)) return false;
    if (!timingSafeEqual(Buffer.from(state), Buffer.from(this.pending.state))) return false;
    this.pending = null;
    return true;
  }
}
