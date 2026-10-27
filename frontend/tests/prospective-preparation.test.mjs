import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProspectivePreparation } from '../src/utils/prospectivePreparation.ts';
import { AttemptSubmission } from '../src/utils/attemptSubmission.ts';

test('pre-answer preparation sends only identity and retries the same reserved attempt', async () => {
  const sent=[];
  globalThis.fetch=async (url,init) => {
    sent.push({url,body:JSON.parse(init.body)});
    if(sent.length===1) throw new Error('lost acknowledgment after commit');
    return new Response(JSON.stringify({contractVersion:'prospective-question-v1',predictionId:'forecast-1',
      attemptId:'reserved',questionId:'q/1',sessionId:'s',can_apply:false,can_schedule:false}),{status:200});
  };
  const intent=new ProspectivePreparation('q/1','s','reserved');
  await assert.rejects(intent.prepare());
  assert.equal(intent.ready,false);
  await intent.prepare();
  assert.equal(intent.ready,true);
  assert.deepEqual(sent[0].body,{attemptId:'reserved',sessionId:'s'});
  assert.deepEqual(sent[0],sent[1]);
  assert.match(sent[1].url,/q%2F1/);
  const submission=new AttemptSubmission({sessionId:'s',selectedOption:'B'},intent.attemptId);
  assert.equal(submission.attemptId,'reserved');
});

test('preparation rejects mismatched acknowledgments and executable authority', async () => {
  globalThis.fetch=async () => new Response(JSON.stringify({contractVersion:'prospective-question-v1',
    attemptId:'wrong',questionId:'q',sessionId:'s',predictionId:'f',can_apply:true,can_schedule:false}),{status:200});
  const intent=new ProspectivePreparation('q','s','reserved');
  await assert.rejects(intent.prepare(),/identidade/);
  assert.equal(intent.ready,false);
});

test('concurrent preparation shares one request and confirmed preparation does not refreeze', async () => {
  let calls=0,finish;
  globalThis.fetch=() => {calls++;return new Promise(resolve=>{finish=resolve;});};
  const intent=new ProspectivePreparation('q','s','id');
  const a=intent.prepare(),b=intent.prepare();assert.equal(a,b);
  finish(new Response(JSON.stringify({contractVersion:'prospective-question-v1',attemptId:'id',
    questionId:'q',sessionId:'s',predictionId:'f',can_apply:false,can_schedule:false}),{status:200}));
  await a;await intent.prepare();assert.equal(calls,1);
});
