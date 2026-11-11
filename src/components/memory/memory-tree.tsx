import { useCallback, useEffect, useRef, useState } from 'react';
import { Brain, ChevronRight, FolderOpen, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { emptyMemory, validMemoryValue, type Category, type Entry, type MemoryProfile } from '../../../supabase/functions/_shared/memory';

type Item = { category: Category; key: string; value: Entry; label: string };
const branches: { category: Category; label: string; description: string }[] = [
  { category: 'identity', label: 'About you', description: 'Your name, languages and preferences' },
  { category: 'projects', label: 'Projects', description: 'What you are working on' },
  { category: 'topics', label: 'Topics', description: 'Recurring interests and themes' },
  { category: 'memory_notes', label: 'Remembered facts', description: 'Details Aura has learned or you have added' },
];
const labels: Record<string, string> = { name: 'Name', job: 'Role', timezone: 'Time zone', languages: 'Languages', communication_style: 'Communication style' };
const control = 'w-full rounded-xl border border-white/15 bg-black/15 px-3 py-2.5 text-sm text-foreground outline-none focus:border-cyan-200/60 disabled:opacity-50';
const button = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs transition-colors hover:bg-white/10 disabled:opacity-40';
function itemsFor(profile: MemoryProfile, category: Category): Item[] {
  if (category === 'identity') return Object.entries(profile.identity).filter(([key, value]) => labels[key] && value != null && value !== '' && (!Array.isArray(value) || value.length)).map(([key, value]) => ({ category, key, value: value as Entry, label: `${labels[key]}: ${Array.isArray(value) ? value.join(', ') : String(value)}` }));
  return (profile[category] ?? []).map((value, index) => ({ category, key: String(index), value, label: String(value.name ?? value.label ?? value.fact ?? 'Memory') }));
}

export function MemoryTree({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<MemoryProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Item | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const editor = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!selected) return;
    const frame = requestAnimationFrame(() => editor.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    return () => cancelAnimationFrame(frame);
  }, [selected]);
  const request = useCallback(async (body?: unknown) => {
    const signal = controller.current!.signal;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.id !== userId) throw new Error('Sign in again to manage your memory.');
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/memory`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Memory is temporarily unavailable.');
    return { ...emptyMemory(), ...result.profile } as MemoryProfile;
  }, [userId]);
  const load = useCallback(async () => {
    const active = controller.current;
    const current = () => active === controller.current && !active?.signal.aborted;
    setLoading(true); setError('');
    try { const next = await request(); if (current()) { setProfile(next); setSelected(null); } }
    catch (error) { if (current()) setError(error instanceof Error ? error.message : 'Memory could not load.'); }
    finally { if (current()) setLoading(false); }
  }, [request]);
  useEffect(() => { controller.current = new AbortController(); void load(); return () => controller.current?.abort(); }, [load]);
  const open = (item: Item, isNew = false) => {
    setSelected(item); setAdding(isNew); setConfirmDelete(false); setError('');
    const value = item.value;
    if (item.category === 'identity') setDraft({ value: Array.isArray(value) ? value.join(', ') : String(value) });
    else {
      const object = value as Record<string, unknown>;
      setDraft(Object.fromEntries(Object.entries(object).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : String(value ?? '')])));
    }
  };
  const save = async (remove = false) => {
    if (!selected || saving) return;
    const { category, key } = selected;
    let value: unknown;
    if (category === 'identity') value = key === 'languages' ? draft.value.split(',').map(v => v.trim()).filter(Boolean) : draft.value?.trim();
    else if (category === 'projects') value = { ...(selected.value as object), name: draft.name?.trim(), description: draft.description?.trim() ?? '', stack: (draft.stack ?? '').split(',').map(v => v.trim()).filter(Boolean), status: draft.status ?? 'active' };
    else if (category === 'topics') value = { ...(selected.value as object), label: draft.label?.trim() };
    else value = { ...(selected.value as object), fact: draft.fact?.trim(), ...(adding ? { learned_at: new Date().toISOString() } : {}) };
    if (!remove && !validMemoryValue(category, key, value)) { setError('Check the fields: a memory cannot be empty and must fit the character limits.'); return; }
    setSaving(true); setError('');
    try {
      const next = await request({ category, key, expected: adding ? null : selected.value, value, action: remove ? 'delete' : adding ? 'add' : 'edit' });
      if (controller.current?.signal.aborted) return;
      setProfile(next); setSelected(null); setConfirmDelete(false);
      toast.success(remove ? 'Memory deleted.' : 'Memory saved.');
    } catch (error) { if (!controller.current?.signal.aborted) setError(error instanceof Error ? error.message : 'Memory could not be saved.'); }
    finally { if (!controller.current?.signal.aborted) setSaving(false); }
  };
  const field = (key: string, label: string, maxLength: number, multiline = false) => <label className="block space-y-2 text-xs text-muted-foreground" key={key}>
    <span>{label}</span>
    {multiline ? <textarea className={`${control} min-h-28 resize-y`} maxLength={maxLength} value={draft[key] ?? ''} disabled={saving} onChange={e => setDraft({ ...draft, [key]: e.target.value })} />
      : <input className={control} maxLength={maxLength} value={draft[key] ?? ''} disabled={saving} onChange={e => setDraft({ ...draft, [key]: e.target.value })} />}
  </label>;
  const total = profile ? branches.reduce((count, branch) => count + itemsFor(profile, branch.category).length, 0) : 0;
  return <section aria-labelledby="memory-tree-title" className="mb-8 rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="memory-tree-title" className="text-display text-2xl">Your memory</h2><p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Explore what Aura remembers. Open any item to correct it or let it go.</p></div>
      <button className={button} disabled={saving || loading} aria-label="Refresh memory" onClick={() => void load()}><RefreshCw className="h-3.5 w-3.5" />Refresh</button>
    </div>
    {error && <div role="alert" className="mt-4 rounded-xl border border-amber-100/20 bg-black/20 p-3 text-sm">{error}{!profile && <button className="ml-3 underline" onClick={() => void load()}>Try again</button>}{profile && error.includes('changed') && <button className="ml-3 underline" onClick={() => void load()}>Reload memory</button>}</div>}
    {loading ? <p role="status" className="py-8 text-sm text-muted-foreground">Loading your memory…</p> : profile && <>
      <div className="mt-5 flex flex-wrap gap-3">
        <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><span className="sr-only">Search memory</span><input className={`${control} pl-9`} placeholder="Search memory…" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <button className={button} disabled={saving} onClick={() => open({ category: 'memory_notes', key: '', value: { fact: '' }, label: 'New memory' }, true)}><Plus className="h-3.5 w-3.5" />Add memory</button>
      </div>
      <div className="mt-5 flex items-center gap-3 text-sm"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-100/10"><Brain className="h-4 w-4 text-cyan-100" /></span><div><p>Aura’s memory</p><p className="text-xs text-muted-foreground">{total} {total === 1 ? 'item' : 'items'}</p></div></div>
      <div className="ml-4 mt-1 border-l border-white/15 pl-4" aria-label="Memory branches">
        {branches.map(branch => {
          const all = itemsFor(profile, branch.category);
          const items = all.filter(item => `${item.label} ${JSON.stringify(item.value)}`.toLowerCase().includes(query.toLowerCase()));
          return <details key={branch.category} open className="group relative py-2 before:absolute before:-left-4 before:top-6 before:h-px before:w-4 before:bg-white/15">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl py-2 text-sm [&::-webkit-details-marker]:hidden"><ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" /><FolderOpen className="h-4 w-4 shrink-0 text-cyan-100/70" /><span>{branch.label}</span><span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">{all.length}</span></summary>
            <p className="mb-2 pl-6 text-xs text-muted-foreground">{branch.description}</p>
            <ul className="ml-3 max-h-72 space-y-1 overflow-y-auto border-l border-white/10 pl-3">
              {items.map(item => <li key={item.key}><button disabled={saving} aria-pressed={selected?.category === item.category && selected.key === item.key && !adding} className={`w-full rounded-xl px-3 py-2 text-left text-sm leading-relaxed transition-colors hover:bg-white/10 ${selected?.category === item.category && selected.key === item.key && !adding ? 'bg-cyan-100/10 text-cyan-50' : 'text-foreground/75'}`} onClick={() => open(item)}><span className="block break-words [overflow-wrap:anywhere]">{item.label}</span></button></li>)}
              {!items.length && <li className="px-3 py-2 text-xs text-muted-foreground">{query ? 'No matching memories.' : 'Nothing remembered here yet.'}</li>}
            </ul>
          </details>;
        })}
      </div>
      {total === 0 && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Your memory tree is empty. Add a fact yourself, or it will appear here when Aura learns from your conversations.</p>}
      {selected && <form ref={editor} aria-label="Edit memory" className="mt-5 space-y-4 rounded-2xl border border-cyan-100/20 bg-black/15 p-4" onSubmit={e => { e.preventDefault(); void save(); }}>
        <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium">{adding ? 'Add a memory' : `Edit · ${branches.find(branch => branch.category === selected.category)?.label}`}</h3><button type="button" className={button} aria-label="Close memory editor" disabled={saving} onClick={() => setSelected(null)}><X className="h-3.5 w-3.5" /></button></div>
        {selected.category === 'identity' ? selected.key === 'communication_style' ? <label className="block space-y-2 text-xs text-muted-foreground"><span>Communication style</span><select className={control} value={draft.value ?? 'mixed'} disabled={saving} onChange={e => setDraft({ value: e.target.value })}><option value="technical">Technical</option><option value="casual">Casual</option><option value="mixed">Mixed</option></select></label> : field('value', labels[selected.key] + (selected.key === 'languages' ? ' (comma separated)' : ''), selected.key === 'languages' ? 1600 : 300)
          : selected.category === 'projects' ? <>{field('name', 'Project name', 200)}{field('description', 'Description', 3000, true)}{field('stack', 'Tools and technologies (comma separated)', 2000)}<label className="block space-y-2 text-xs text-muted-foreground"><span>Status</span><select className={control} disabled={saving} value={draft.status ?? 'active'} onChange={e => setDraft({ ...draft, status: e.target.value })}><option value="active">Active</option><option value="paused">Paused</option><option value="shipped">Shipped</option></select></label></>
          : selected.category === 'topics' ? field('label', 'Topic', 150) : field('fact', 'What should Aura remember?', 2000, true)}
        {confirmDelete ? <div className="rounded-xl border border-rose-100/20 bg-rose-950/20 p-3"><p className="text-sm leading-relaxed">Delete this memory? Your conversation history will be kept. Automatic extraction will respect this deletion.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" className={`${button} text-rose-100`} disabled={saving} onClick={() => void save(true)}>{saving ? 'Deleting…' : 'Confirm deletion'}</button><button type="button" className={button} disabled={saving} onClick={() => setConfirmDelete(false)}>Keep memory</button></div></div>
          : <div className="flex flex-wrap gap-2"><button className={`${button} bg-cyan-100/10 text-cyan-50`} disabled={saving}>{saving ? 'Saving…' : 'Save memory'}</button>{!adding && <button type="button" className={`${button} text-rose-100/80`} disabled={saving} onClick={() => setConfirmDelete(true)}><Trash2 className="h-3.5 w-3.5" />Delete memory</button>}<button type="button" className={button} disabled={saving} onClick={() => setSelected(null)}>Cancel</button></div>}
      </form>}
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Your edits are saved to your account and used in future AI responses. Conversation history is managed separately below.</p>
      {profile.profile_updated_at && <p className="mt-1 text-xs text-muted-foreground">Last updated {new Date(profile.profile_updated_at).toLocaleString('en-US')}</p>}
    </>}
  </section>;
}
