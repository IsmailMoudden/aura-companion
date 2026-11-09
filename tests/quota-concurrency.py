"""Destructive fixture: run ONLY against the dedicated ephemeral CI/test database."""
import concurrent.futures
import os
import pathlib
import subprocess
import uuid

psql = os.environ.get('PSQL_BIN', 'psql')
url = os.environ['TEST_DATABASE_URL']
def sql(query):
    return subprocess.check_output([psql, url, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', query], text=True, stderr=subprocess.PIPE).strip()

sql("""
create schema auth;
create role anon; create role authenticated; create role service_role;
create table auth.users(id uuid primary key);
create table public.user_total_usage(user_id uuid references auth.users(id), model text, count int default 0, primary key(user_id,model));
create table public.user_limit_overrides(user_id uuid, model text, total_limit int, unique(user_id,model));
""")
migration = pathlib.Path(__file__).resolve().parents[1] / 'supabase/migrations/20261109000000_atomic_ai_quota.sql'
sql(migration.read_text())
sql(migration.read_text())  # Deployment is safe to retry.
user = str(uuid.uuid4())
sql(f"insert into auth.users values ('{user}')")
ids = [str(uuid.uuid4()) for _ in range(40)]
def reserve(request_id):
    return request_id, sql(f"select allowed from public.reserve_ai_usage('{user}','auto',7,'{request_id}')")
with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:
    attempts = list(pool.map(reserve, ids))
accepted = [request_id for request_id, allowed in attempts if allowed == 't']
assert len(accepted) == 7, attempts
assert sql(f"select count from public.user_total_usage where user_id='{user}' and model='auto'") == '7'
# Retrying a refund cannot decrement twice, even when the retries overlap.
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
    list(pool.map(lambda _: sql(f"select public.finish_ai_usage('{accepted[0]}',false)"), range(20)))
assert sql(f"select count from public.user_total_usage where user_id='{user}' and model='auto'") == '6'
sql(f"select public.finish_ai_usage('{accepted[1]}',true)")
sql(f"select public.finish_ai_usage('{accepted[1]}',false)")
assert sql(f"select count from public.user_total_usage where user_id='{user}' and model='auto'") == '6'
# A duplicate reservation ID rolls back its increment rather than consuming another unit.
try:
    reserve(accepted[1])
    raise AssertionError('duplicate reservation unexpectedly succeeded')
except subprocess.CalledProcessError:
    pass
assert sql(f"select count from public.user_total_usage where user_id='{user}' and model='auto'") == '6'
sql(f"insert into public.user_limit_overrides values ('{user}','other',2)")
for _ in range(2):
    assert sql(f"select allowed from public.reserve_ai_usage('{user}','other',99,'{uuid.uuid4()}')") == 't'
assert sql(f"select allowed from public.reserve_ai_usage('{user}','other',99,'{uuid.uuid4()}')") == 'f'
assert sql("select has_function_privilege('anon','public.reserve_ai_usage(uuid,text,integer,uuid)','execute')") == 'f'
assert sql("select has_function_privilege('authenticated','public.finish_ai_usage(uuid,boolean)','execute')") == 'f'
assert sql("select has_function_privilege('service_role','public.reserve_ai_usage(uuid,text,integer,uuid)','execute')") == 't'
print('PASS: 40 concurrent requests respect quota; refunds are idempotent; successes stay charged; overrides and RPC permissions enforced.')
