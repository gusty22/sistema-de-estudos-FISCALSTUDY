import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProspectivePreparation } from '../src/utils/prospectivePreparation.ts';
import { AttemptSubmission } from '../src/utils/attemptSubmission.ts';
import { reserveAttempt, readAttemptJournal, saveQuestionSession, restoreQuestionSession, freezeAttemptPayload, confirmAttempt } from '../src/utils/attemptJournal.ts';

function storage() { const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};return data; }
function ack(intent) { return new Response(JSON.stringify({contractVersion:'prospective-question-v1',predictionId:crypto.randomUUID(),attemptId:intent.attemptId,questionId:intent.questionId,sessionId:intent.sessionId,can_apply:false,can_schedule:false}),{status:200}); }
test('reload after preparation acknowledgment loss retains UUID',async()=>{
 storage();const first=new ProspectivePreparation('q','s');let calls=0;
 globalThis.fetch=async()=>{if(++calls===1)throw Error('lost ack');return ack(first);};
 await assert.rejects(first.prepare());
 const recovered=new ProspectivePreparation('q','s');
 assert.equal(recovered.attemptId,first.attemptId);await recovered.prepare();
});
test('reload after answer acknowledgment loss preserves exact payload and outcome',async()=>{
 storage();const intent=reserveAttempt('q','s');let sent;
 globalThis.fetch=async(url,init)=>{sent=init.body;throw Error('lost response after commit');};
 const original=new AttemptSubmission({sessionId:'s',selectedOption:'B',confidenceLevel:4,activeTimeMs:9123},intent.attemptId);
 await assert.rejects(original.send('q'));
 const recovered=readAttemptJournal('q','s');
 const retry=new AttemptSubmission(recovered.payload,recovered.attemptId);
 globalThis.fetch=async(url,init)=>{assert.equal(init.body,sent);return new Response(JSON.stringify({attemptId:intent.attemptId,isCorrect:false}),{status:200});};
 await retry.send('q');assert.equal(readAttemptJournal('q','s').result.isCorrect,false);
 assert.equal(new ProspectivePreparation('q','s').attemptId,intent.attemptId);
});
test('question switch isolates journals and cached session survives frontend restart',()=>{
 storage();const a=reserveAttempt('a','s'),b=reserveAttempt('b','s');
 assert.notEqual(a.attemptId,b.attemptId);
 saveQuestionSession('s',[{questionId:'a'},{questionId:'b'}],1);
 assert.equal(restoreQuestionSession('s').questions[1].questionId,'b');
 assert.equal(reserveAttempt('a','s').attemptId,a.attemptId);
});
test('damaged storage fails closed without generating another intent',()=>{
 const map=storage();const entry=reserveAttempt('q','s');
 const key=[...map.keys()][0];map.set(key,'broken json');
 assert.throws(()=>reserveAttempt('q','s'));assert.equal(map.get(key),'broken json');
 assert.ok(entry.attemptId);
});

test('a cached success is never accepted without current server confirmation',async()=>{
 storage();const intent=reserveAttempt('q','s');
 freezeAttemptPayload('q',{sessionId:'s',attemptId:intent.attemptId,selectedOption:'A'},intent.attemptId);
 confirmAttempt('q','s',intent.attemptId,{attemptId:intent.attemptId,isCorrect:true});
 let calls=0;
 globalThis.fetch=async(url,init)=>{calls++;assert(!init.method);return new Response(JSON.stringify({state:'PENDING_ANSWER'}),{status:200});};
 await assert.rejects(new ProspectivePreparation('q','s').prepare(),/não confirmou/);
 assert.equal(calls,1);assert(readAttemptJournal('q','s').result);
});
