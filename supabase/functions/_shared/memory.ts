export type Category = 'identity' | 'projects' | 'topics' | 'memory_notes';
export type Entry = string | string[] | Record<string, unknown>;
export type MemoryProfile = {
  identity: Record<string, unknown>;
  projects: Record<string, unknown>[];
  topics: Record<string, unknown>[];
  memory_notes: Record<string, unknown>[];
  profile_updated_at: string | null;
};
export const emptyMemory = (): MemoryProfile => ({ identity: {}, projects: [], topics: [], memory_notes: [], profile_updated_at: null });
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
export function validMemoryValue(category: Category, key: string, value: unknown): boolean {
  if (category === 'identity') {
    if (key === 'languages') return Array.isArray(value) && value.length <= 20 && value.every(v => text(v, 80));
    if (key === 'communication_style') return ['technical', 'casual', 'mixed'].includes(value as string);
    return ['name', 'job', 'timezone'].includes(key) && text(value, 300);
  }
  if (!object(value)) return false;
  if (category === 'memory_notes') return text(value.fact, 2000) && (value.learned_at === undefined || text(value.learned_at, 100));
  if (category === 'topics') return text(value.label, 150) && (value.count === undefined || (Number.isSafeInteger(value.count) && Number(value.count) >= 0));
  if (category === 'projects') return text(value.name, 200) && typeof value.description === 'string' && value.description.length <= 3000 && Array.isArray(value.stack) && value.stack.length <= 30 && value.stack.every(v => text(v, 100)) && ['active', 'paused', 'shipped'].includes(value.status as string);
  return false;
}
export async function entryKey(category: Category, value: unknown): Promise<string> {
  if (!object(value)) return '';
  const key = category === 'projects' ? value.name : category === 'topics' ? value.label : value.fact;
  if (typeof key !== 'string') return '';
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key.toLowerCase()));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
// Manual edits/deletions take precedence over later automatic extractions.
export async function applyMemoryOverrides<T extends Pick<MemoryProfile, 'identity' | 'projects' | 'topics' | 'memory_notes'>>(profile: T, overrides: unknown): Promise<T> {
  if (!object(overrides)) return profile;
  const result = { ...profile, identity: { ...profile.identity }, projects: [...profile.projects], topics: [...profile.topics], memory_notes: [...profile.memory_notes] };
  if (object(overrides.identity)) for (const [key, rule] of Object.entries(overrides.identity)) {
    if (!object(rule)) continue;
    if (rule.value === null) delete result.identity[key];
    else result.identity[key] = rule.value;
  }
  for (const category of ['projects', 'topics', 'memory_notes'] as const) {
    const rules = overrides[category];
    if (!object(rules)) continue;
    for (const [key, rule] of Object.entries(rules)) {
      if (!object(rule)) continue;
      const updatedKey = await entryKey(category, rule.value);
      const keys = await Promise.all(result[category].map(item => entryKey(category, item)));
      result[category] = result[category].filter((_item, index) => ![key, ...(updatedKey ? [updatedKey] : [])].includes(keys[index]));
      if (object(rule.value)) result[category].push(rule.value);
    }
  }
  return result;
}
