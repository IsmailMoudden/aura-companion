-- Reservations count against the limit before any provider call, including concurrent requests.
create table if not exists public.ai_usage_reservations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'refunded')),
  created_at timestamptz not null default now()
);
alter table public.ai_usage_reservations enable row level security;
revoke all on public.ai_usage_reservations from public, anon, authenticated;
grant all on public.ai_usage_reservations to service_role;

create or replace function public.reserve_ai_usage(p_user_id uuid, p_model text, p_default_limit int, p_request_id uuid)
returns table(allowed boolean, used_count int, total_limit int)
language plpgsql security definer set search_path = '' as $$
declare v_count int; v_limit int;
begin
  if p_default_limit < 1 then raise exception 'Invalid quota'; end if;
  insert into public.user_total_usage(user_id, model, count) values (p_user_id, p_model, 0)
    on conflict (user_id, model) do nothing;
  select u.count into v_count from public.user_total_usage u
    where u.user_id = p_user_id and u.model = p_model for update;
  select o.total_limit into v_limit from public.user_limit_overrides o
    where o.user_id = p_user_id and o.model = p_model;
  v_limit := coalesce(v_limit, p_default_limit);
  if v_count >= v_limit then return query select false, v_count, v_limit; return; end if;
  insert into public.ai_usage_reservations(id, user_id, model) values (p_request_id, p_user_id, p_model);
  update public.user_total_usage u set count = u.count + 1
    where u.user_id = p_user_id and u.model = p_model returning u.count into v_count;
  return query select true, v_count, v_limit;
end; $$;

create or replace function public.finish_ai_usage(p_request_id uuid, p_success boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid; v_model text;
begin
  update public.ai_usage_reservations r set status = case when p_success then 'completed' else 'refunded' end
    where r.id = p_request_id and r.status = 'pending' returning r.user_id, r.model into v_user_id, v_model;
  if found and not p_success then
    update public.user_total_usage u set count = greatest(0, u.count - 1)
      where u.user_id = v_user_id and u.model = v_model;
  end if;
end; $$;
revoke all on function public.reserve_ai_usage(uuid, text, int, uuid) from public, anon, authenticated;
revoke all on function public.finish_ai_usage(uuid, boolean) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid, text, int, uuid) to service_role;
grant execute on function public.finish_ai_usage(uuid, boolean) to service_role;
