-- Cumulative usage tracking: total messages per user per model, no reset
create table public.user_total_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, model)
);

alter table public.user_total_usage enable row level security;

create trigger user_total_usage_set_updated_at before update on public.user_total_usage
  for each row execute function public.set_updated_at();
