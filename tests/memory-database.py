"""Run only against the dedicated disposable test/CI database."""
import os,subprocess,pathlib,uuid,json
psql=os.environ.get('PSQL_BIN','psql');url=os.environ['TEST_DATABASE_URL']
def sql(query):
 return subprocess.check_output([psql,url,'-X','-qAt','-v','ON_ERROR_STOP=1','-c',query],text=True,stderr=subprocess.PIPE).strip()
def literal(value): return "'"+json.dumps(value).replace("'","''")+"'::jsonb"
sql("create schema if not exists auth; create table if not exists auth.users(id uuid primary key);")
sql("do $$ begin if not exists(select from pg_roles where rolname='anon') then create role anon; end if; if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select from pg_roles where rolname='service_role') then create role service_role; end if; end $$;")
migration=(pathlib.Path(__file__).resolve().parents[1]/'supabase/migrations/20261111000000_memory_management.sql').read_text()
sql(migration);sql(migration)
user,other=str(uuid.uuid4()),str(uuid.uuid4());sql(f"insert into auth.users values('{user}'),('{other}')")
def mutate(action,key,expected,value):
 return json.loads(sql(f"select public.edit_user_memory('{user}','memory_notes','{key}',{literal(expected)},{literal(value)},'{action}')"))
first={'fact':'Original fact'};second={'fact':'Corrected fact'};third={'fact':'Latest correction'}
assert mutate('add','',None,first)['memory_notes']==[first]
assert mutate('edit','0',first,second)['memory_notes']==[second]
try:
 mutate('edit','0',first,third);raise AssertionError('stale edit accepted')
except subprocess.CalledProcessError: pass
assert mutate('edit','0',second,third)['memory_notes']==[third]
revision=int(sql(f"select memory_revision from public.user_profile where id='{user}'"))
assert mutate('delete','0',third,None)['memory_notes']==[]
overrides=json.loads(sql(f"select memory_overrides from public.user_profile where id='{user}'"))
assert all(rule['value'] is None for rule in overrides['memory_notes'].values()),overrides
assert all(len(key)==64 for key in overrides['memory_notes']),overrides
assert 'Original fact' not in json.dumps(overrides), 'Deleted facts must not be retained in suppression rules'
profile={'identity':{},'projects':[],'topics':[],'memory_notes':[{'fact':'Stale extraction'}]}
assert sql(f"select public.save_extracted_memory('{user}',{revision},{literal(profile)})")=='f'
assert sql(f"select memory_notes from public.user_profile where id='{user}'")=='[]'
assert sql(f"select count(*) from public.user_profile where id='{other}'")=='0'
for role in ['anon','authenticated']:
 assert sql(f"select has_function_privilege('{role}','public.edit_user_memory(uuid,text,text,jsonb,jsonb,text)','execute')")=='f'
 assert sql(f"select has_function_privilege('{role}','public.save_extracted_memory(uuid,bigint,jsonb)','execute')")=='f'
print('PASS: memory schema retries; add/edit/delete; stale-edit conflicts; correction/deletion chains; extraction races; ownership and RPC restrictions.')
