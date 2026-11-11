create table if not exists public.user_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  identity jsonb not null default '{}'::jsonb,
  projects jsonb not null default '[]'::jsonb,
  topics jsonb not null default '[]'::jsonb,
  memory_notes jsonb not null default '[]'::jsonb,
  profile_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_profile add column if not exists memory_overrides jsonb not null default '{}'::jsonb;
alter table public.user_profile add column if not exists memory_revision bigint not null default 0;
alter table public.user_profile enable row level security;
grant select, insert, update, delete on public.user_profile to service_role;

-- Only the authenticated Edge Function can call this, with the verified user's ID.
create or replace function public.edit_user_memory(p_user_id uuid, p_category text, p_key text, p_expected jsonb, p_value jsonb, p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare row_data public.user_profile; items jsonb; previous jsonb; rule_key text; idx int; rules jsonb; field_name text;
begin
  if p_category not in ('identity','projects','topics','memory_notes') or p_action not in ('add','edit','delete') then raise exception 'Invalid memory operation'; end if;
  insert into public.user_profile(id) values(p_user_id) on conflict(id) do nothing;
  select * into row_data from public.user_profile where id = p_user_id for update;
  if p_action = 'add' then
    if p_category <> 'memory_notes' or jsonb_array_length(row_data.memory_notes) >= 50 then raise exception 'Memory limit reached'; end if;
    items := row_data.memory_notes || jsonb_build_array(p_value);
    rule_key := encode(sha256(convert_to(lower(p_value->>'fact'),'UTF8')),'hex');
  elsif p_category = 'identity' then
    if p_key not in ('name','job','timezone','languages','communication_style') then raise exception 'Invalid memory field'; end if;
    previous := row_data.identity->p_key;
    if previous is distinct from p_expected then raise exception 'Memory changed' using errcode = '40001'; end if;
    items := case when p_action = 'delete' then row_data.identity - p_key else jsonb_set(row_data.identity,array[p_key],p_value) end;
    rule_key := p_key;
  else
    if p_key !~ '^[0-9]{1,4}$' then raise exception 'Invalid memory index'; end if;
    idx := p_key::int;
    items := to_jsonb(row_data)->p_category;
    previous := items->idx;
    if previous is null or previous is distinct from p_expected then raise exception 'Memory changed' using errcode = '40001'; end if;
    rule_key := encode(sha256(convert_to(lower(case p_category when 'projects' then previous->>'name' when 'topics' then previous->>'label' else previous->>'fact' end),'UTF8')),'hex');
    items := case when p_action = 'delete' then items - idx else jsonb_set(items,array[p_key],p_value) end;
  end if;
  rules := coalesce(row_data.memory_overrides->p_category,'{}'::jsonb);
  if p_category <> 'identity' then
    field_name := case p_category when 'projects' then 'name' when 'topics' then 'label' else 'fact' end;
    select coalesce(jsonb_object_agg(key,case when encode(sha256(convert_to(lower(value->'value'->>field_name),'UTF8')),'hex')=rule_key
      then jsonb_build_object('value',case when p_action='delete' then 'null'::jsonb else p_value end) else value end),'{}'::jsonb)
      into rules from jsonb_each(rules);
  end if;
  row_data.memory_overrides := jsonb_set(row_data.memory_overrides, array[p_category],
    rules || jsonb_build_object(rule_key,jsonb_build_object('value',case when p_action = 'delete' then 'null'::jsonb else p_value end)));
  update public.user_profile set
    identity = case when p_category = 'identity' then items else identity end,
    projects = case when p_category = 'projects' then items else projects end,
    topics = case when p_category = 'topics' then items else topics end,
    memory_notes = case when p_category = 'memory_notes' then items else memory_notes end,
    memory_overrides = row_data.memory_overrides, memory_revision = memory_revision + 1,
    profile_updated_at = now(), updated_at = now()
  where id = p_user_id returning * into row_data;
  return to_jsonb(row_data) - 'memory_overrides' - 'memory_revision' - 'id' - 'created_at' - 'updated_at';
end; $$;

create or replace function public.save_extracted_memory(p_user_id uuid, p_revision bigint, p_profile jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.user_profile set identity=p_profile->'identity',projects=p_profile->'projects',topics=p_profile->'topics',memory_notes=p_profile->'memory_notes',memory_revision=memory_revision+1,profile_updated_at=now(),updated_at=now()
  where id=p_user_id and memory_revision=p_revision;
  return found;
end; $$;
revoke all on function public.edit_user_memory(uuid,text,text,jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.save_extracted_memory(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.edit_user_memory(uuid,text,text,jsonb,jsonb,text) to service_role;
grant execute on function public.save_extracted_memory(uuid,bigint,jsonb) to service_role;
notify pgrst, 'reload schema';
