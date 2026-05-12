-- ─── User profile for ambient memory ─────────────────────────────────────────
create table public.user_profile (
  id uuid primary key references auth.users(id) on delete cascade,

  -- Who they are
  identity jsonb not null default '{}'::jsonb,
  -- { name, job, timezone, languages[], communication_style }

  -- Active projects
  projects jsonb not null default '[]'::jsonb,
  -- [{ name, stack[], description, status, last_mentioned_at }]

  -- Recurring topics / interests
  topics jsonb not null default '[]'::jsonb,
  -- [{ label, count }]

  -- Free-form facts learned over time
  memory_notes jsonb not null default '[]'::jsonb,
  -- [{ fact, learned_at }]

  -- Meta
  profile_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profile enable row level security;

-- Edge function reads/writes profile on behalf of user (service role bypasses RLS)
create policy "Users view own profile" on public.user_profile
  for select using (auth.uid() = id);

create trigger user_profile_set_updated_at before update on public.user_profile
  for each row execute function public.set_updated_at();

-- Auto-create empty profile on signup (alongside profiles table)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.user_profile (id) values (new.id);
  return new;
end; $$;

-- Track which conversations have been processed for profile extraction
alter table public.conversations
  add column if not exists profile_extracted_at timestamptz,
  add column if not exists last_message_at timestamptz not null default now();

-- Update last_message_at on new messages via trigger
create or replace function public.update_conversation_last_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
  set last_message_at = now()
  where id = new.conversation_id;
  return new;
end; $$;

create trigger messages_update_conversation_last_message
  after insert on public.messages
  for each row execute function public.update_conversation_last_message();

create index user_profile_id_idx on public.user_profile(id);
create index conversations_profile_extraction_idx on public.conversations(last_message_at, profile_extracted_at)
  where profile_extracted_at is null;
