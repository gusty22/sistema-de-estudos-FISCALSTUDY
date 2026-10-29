import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prospectiveCaptureEnabled,modalCaptureSession} from '../src/utils/prospectiveCapture.ts';
import {ProspectivePreparation} from '../src/utils/prospectivePreparation.ts';
import {AttemptSubmission} from '../src/utils/attemptSubmission.ts';
import {readAttemptJournal,freezeAttemptPayload} from '../src/utils/attemptJournal.ts';
const storage=()=>{const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};return data;};
test('default-off capture does not consult server or reserve an experimental intent',async()=>{
 const data=storage();globalThis.fetch=()=>{throw Error('No experimental request expected');};
 assert.equal(await prospectiveCaptureEnabled(),false);assert.equal(data.size,0);
});
test('explicit frontend opt-in still requires exact non-executable host authorization',async()=>{
 for(const enabled of [false,true]) {globalThis.fetch=async()=>new Response(JSON.stringify({contractVersion:'prospective-question-v1',enabled,can_apply:false,can_schedule:false}));assert.equal(await prospectiveCaptureEnabled(true),enabled);}
 globalThis.fetch=async()=>new Response(JSON.stringify({contractVersion:'prospective-question-v1',enabled:'true',can_apply:false,can_schedule:false}));
 await assert.rejects(prospectiveCaptureEnabled(true));
});
test('modal reopens keep identity, bank and active scopes differ, explicit new intent keeps old journals',()=>{
 const data=storage();const sid=modalCaptureSession('bank:fixture');
 const a=new ProspectivePreparation('q',sid);const b=new ProspectivePreparation('q',modalCaptureSession('bank:fixture'));
 assert.equal(a.attemptId,b.attemptId);assert.notEqual(sid,modalCaptureSession('active:fixture'));
 const fresh=modalCaptureSession('bank:fixture',true);assert.notEqual(sid,fresh);
 assert.equal(readAttemptJournal('q',sid).attemptId,a.attemptId);assert(data.size>=3);
});
test('ordinary disabled submission ignores obsolete/corrupt experimental journals',async()=>{
 const data=storage();const sid=modalCaptureSession('bank:fixture');const intent=new ProspectivePreparation('q',sid);
 for(const key of data.keys())if(key.includes('prospective:v1:'))data.set(key,'broken');
 globalThis.fetch=async(url,init)=>{assert.match(url,/attempts$/);const p=JSON.parse(init.body);return new Response(JSON.stringify({attemptId:p.attemptId}));};
 await new AttemptSubmission({sessionId:sid,selectedOption:'A'},undefined,false).send('q');assert(intent.attemptId);
});
test('journaled answer without server prediction fails recovery rather than backfilling',async()=>{
 storage();const sid=modalCaptureSession('bank:fixture');const intent=new ProspectivePreparation('q',sid);
 freezeAttemptPayload('q',{sessionId:sid,attemptId:intent.attemptId,selectedOption:'A'},intent.attemptId);
 globalThis.fetch=async(url,init)=>{assert(!init.method);assert.match(url,/predictions\//);return new Response('{"error":"missing"}',{status:404});};
 await assert.rejects(new ProspectivePreparation('q',sid).prepare());assert(readAttemptJournal('q',sid).payload);
});
