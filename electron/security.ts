import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function trustedDocument(url: string, webOrigin: string, overlayFile: string): 'overlay' | 'dashboard' | null {
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return null;
    if (parsed.protocol === 'file:' && !parsed.search && !parsed.hash && path.resolve(fileURLToPath(parsed)) === path.resolve(overlayFile)) return 'overlay';
    if (parsed.protocol === 'https:' && parsed.origin === new URL(webOrigin).origin && !parsed.username && !parsed.password) return 'dashboard';
    if (parsed.protocol === 'http:' && parsed.origin === new URL(webOrigin).origin && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) return 'dashboard';
  } catch { /* Invalid URLs are untrusted. */ }
  return null;
}

export function allowedExternalUrl(value: unknown, webOrigin: string): string {
  if (typeof value !== 'string' || value.length > 4096 || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('Invalid external URL');
  const url = new URL(value);
  if (url.username || url.password) throw new Error('Credentials in URLs are forbidden');
  if (url.protocol === 'https:' && [new URL(webOrigin).origin, 'https://github.com', 'https://www.linkedin.com'].includes(url.origin)) return url.href;
  if (url.protocol === 'mailto:' && url.pathname === 'ismail.moudden1@gmail.com' && !url.search && !url.hash) return url.href;
  throw new Error('External destination not allowed');
}

export function validDimensions(value: unknown): { width: number; height: number } {
  const size = value as { width?: unknown; height?: unknown } | null;
  if (!size || typeof size.width !== 'number' || typeof size.height !== 'number' || !Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width < 88 || size.width > 1200 || size.height < 88 || size.height > 1600) throw new Error('Invalid window dimensions');
  return { width: Math.round(size.width), height: Math.round(size.height) };
}

export function screenshotPath(value: unknown, directory: string): string {
  if (typeof value !== 'string' || value.includes('\0')) throw new Error('Invalid screenshot path');
  const resolved = path.resolve(value);
  if (path.dirname(resolved) !== path.resolve(directory) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/i.test(path.basename(resolved))) throw new Error('Screenshot path not allowed');
  return resolved;
}
