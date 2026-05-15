-- Allows admins to manually increase cumulative limits for specific users
create table public.user_limit_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  total_limit int not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, model)
);

-- Only service role can read/write — no user-facing RLS needed
alter table public.user_limit_overrides enable row level security;

create trigger user_limit_overrides_set_updated_at before update on public.user_limit_overrides
  for each row execute function public.set_updated_at();
