
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Users view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Conversations
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.conversations enable row level security;

create policy "Users view own conversations" on public.conversations for select using (auth.uid() = user_id);
create policy "Users insert own conversations" on public.conversations for insert with check (auth.uid() = user_id);
create policy "Users update own conversations" on public.conversations for update using (auth.uid() = user_id);
create policy "Users delete own conversations" on public.conversations for delete using (auth.uid() = user_id);

create trigger conversations_set_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create index conversations_user_id_idx on public.conversations(user_id, updated_at desc);

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;

create policy "Users view own messages" on public.messages for select using (auth.uid() = user_id);
create policy "Users insert own messages" on public.messages for insert with check (auth.uid() = user_id);
create policy "Users delete own messages" on public.messages for delete using (auth.uid() = user_id);

create index messages_conversation_idx on public.messages(conversation_id, created_at asc);
