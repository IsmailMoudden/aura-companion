import { test, expect } from 'bun:test';
import { trustedDocument, allowedExternalUrl, validDimensions, screenshotPath } from '../electron/security';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const web = 'https://aura.aura-companion.workers.dev';
const overlay = path.resolve('/tmp/aura/overlay.html');
test('only the exact overlay or trusted web origin receives desktop privileges', () => {
  expect(trustedDocument(pathToFileURL(overlay).href, web, overlay)).toBe('overlay');
  expect(trustedDocument(`${web}/app`, web, overlay)).toBe('dashboard');
  for (const url of ['file:///etc/passwd', `${web}.evil.test/app`, 'data:text/html,hi', 'https://evil.test', 'https://aura.aura-companion.workers.dev@evil.test']) expect(trustedDocument(url, web, overlay)).toBeNull();
});
test('external links reject shell protocols and disguised or unapproved destinations', () => {
  expect(allowedExternalUrl(`${web}/auth?overlay=true`, web)).toBe(`${web}/auth?overlay=true`);
  expect(allowedExternalUrl('https://github.com/IsmailMoudden/aura-companion/releases', web)).toContain('github.com');
  for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'aura://auth?access_token=leak', 'https://github.com.evil.test', 'https://user:password@github.com', 'mailto:attacker@example.com', 'https://github.com\n.evil.test']) expect(() => allowedExternalUrl(url, web)).toThrow();
});
test('window dimensions cannot be NaN, infinite or oversized', () => {
  expect(validDimensions({ width: 360, height: 340 })).toEqual({ width: 360, height: 340 });
  for (const value of [null, {}, { width: NaN, height: 100 }, { width: 100, height: Infinity }, { width: 90000, height: 90000 }, { width: '360', height: 340 }]) expect(() => validDimensions(value)).toThrow();
});
test('screenshot deletion cannot traverse outside its directory', () => {
  const name = 'eae89a8b-d224-4279-9b4c-cbdb91186210.png';
  const directory = path.resolve('/tmp/aura/screenshots');
  expect(screenshotPath(path.join(directory, name), directory)).toBe(path.join(directory, name));
  for (const file of ['/etc/passwd', path.join(directory, '../'+name), path.join(directory, 'nested', name), path.join(directory, 'session.json'), `${directory}\0/${name}`]) expect(() => screenshotPath(file, directory)).toThrow();
});
