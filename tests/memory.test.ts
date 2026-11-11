import { test, expect } from 'bun:test';
import { applyMemoryOverrides, emptyMemory, validMemoryValue, entryKey } from '../supabase/functions/_shared/memory';
test('memory rejects malformed, oversized and unknown identity edits', () => {
  expect(validMemoryValue('identity', 'admin', 'true')).toBe(false);
  expect(validMemoryValue('identity', 'languages', ['English', 'French'])).toBe(true);
  expect(validMemoryValue('identity', 'languages', ['x'.repeat(81)])).toBe(false);
  expect(validMemoryValue('memory_notes', '', { fact: '' })).toBe(false);
  expect(validMemoryValue('memory_notes', '', { fact: 'x'.repeat(2001) })).toBe(false);
  expect(validMemoryValue('projects', '', { name: 'Aura', description: '', stack: [], status: 'active' })).toBe(true);
  expect(validMemoryValue('projects', '', { name: 'Aura', description: '', stack: [], status: 'invalid' })).toBe(false);
});
test('automatic extraction respects manual corrections and deletions', async () => {
  const profile = { ...emptyMemory(), identity: { name: 'Old name', job: 'Writer' }, projects: [{ name: 'Old project', stack: [], description: '', status: 'active' }], topics: [{ label: 'Gaming', count: 3 }], memory_notes: [{ fact: 'Prefers long replies' }, { fact: 'Likes coffee' }] };
  const updated = await applyMemoryOverrides(profile, { identity: { name: { value: 'New name' }, job: { value: null } }, projects: { [await entryKey('projects', { name: 'Old project' })]: { value: { name: 'New project', stack: [], description: '', status: 'paused' } } }, topics: { [await entryKey('topics', { label: 'Gaming' })]: { value: null } }, memory_notes: { [await entryKey('memory_notes', { fact: 'Prefers long replies' })]: { value: { fact: 'Prefers short replies' } } } });
  expect(updated.identity).toEqual({ name: 'New name' });
  expect(updated.projects.map(p => p.name)).toEqual(['New project']);
  expect(updated.topics).toEqual([]);
  expect(updated.memory_notes.map(n => n.fact)).toEqual(['Likes coffee', 'Prefers short replies']);
  expect(profile.identity.name).toBe('Old name');
});
