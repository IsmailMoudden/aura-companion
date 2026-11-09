import {test,expect} from 'bun:test';
import {authorizedCron} from '../supabase/functions/_shared/cron-auth';
test('privileged extraction rejects absent, forged, anonymous and malformed credentials',async()=>{
 for(const token of ['', 'Bearer anonymous-key','Bearer service-ke','Basic service-key','Bearer service-key-extra']) {
  expect(await authorizedCron(new Request('https://example.test',{headers:{authorization:token}}),'service-key')).toBe(false);
 }
 expect(await authorizedCron(new Request('https://example.test',{headers:{authorization:'Bearer service-key'}}),undefined)).toBe(false);
});
test('the cron service-role bearer is accepted',async()=>{
 expect(await authorizedCron(new Request('https://example.test',{headers:{authorization:'Bearer service-key'}}),'service-key')).toBe(true);
});
