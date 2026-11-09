import {test,expect} from 'bun:test';
import {AuthAttempt} from '../electron/auth-attempt';
test('only the currently initiated OAuth flow can replace a desktop session',()=>{
 const attempt=new AuthAttempt();expect(attempt.consume('x')).toBe(false);
 const state=attempt.begin();expect(attempt.consume('a'.repeat(64))).toBe(false);
 expect(attempt.consume(state)).toBe(true);expect(attempt.consume(state)).toBe(false);
});
test('old flows and expired callbacks are rejected',()=>{
 let now=0;const attempt=new AuthAttempt(()=>now);const old=attempt.begin();const current=attempt.begin();
 expect(attempt.consume(old)).toBe(false);now=600001;expect(attempt.consume(current)).toBe(false);
});
