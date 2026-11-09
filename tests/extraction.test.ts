import {test,expect,mock,afterAll} from 'bun:test';
let handler:(request:Request)=>Promise<Response>;let privilegedClients=0;
mock.module('https://esm.sh/@supabase/supabase-js@2',()=>({createClient:()=>{
 privilegedClients++;
 return {from:()=>{const chain={select:()=>chain,lt:()=>chain,is:()=>chain,limit:async()=>({data:[]})};return chain;}};
}}));
(globalThis as any).Deno={env:{get:(key:string)=>key==='SUPABASE_SERVICE_ROLE_KEY'?'cron-service-secret':'configured'},serve:(fn:typeof handler)=>{handler=fn}};
await import('../supabase/functions/extract-profile/index.ts');
afterAll(()=>{delete(globalThis as any).Deno});
test('public extraction requests cannot reach privileged database reads',async()=>{
 for(const authorization of ['', 'Bearer anon-key']){
  const response=await handler(new Request('https://example.test/extract-profile',{method:'POST',headers:{authorization}}));
  expect(response.status).toBe(401);
 }
 expect(privilegedClients).toBe(0);
});
test('authenticated scheduled extraction is accepted',async()=>{
 const response=await handler(new Request('https://example.test/extract-profile',{method:'POST',headers:{authorization:'Bearer cron-service-secret'}}));
 expect(response.status).toBe(200);expect(privilegedClients).toBe(1);
});
