/* Real Chromium + full application; all seeded content is SYNTHETIC_FIXTURE. */
const {chromium}=require(process.env.FISCALSTUDY_PLAYWRIGHT_MODULE);
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
let runningBrowser, activePage;
const root=process.env.FISCALSTUDY_BROWSER_DIR;
const db=path.join(root,'data','fiscalstudy.db');
assert(root && path.resolve(root).startsWith(path.resolve(process.env.RUNNER_TEMP)+path.sep));
function sql(query,args=[]) {
 const code="import sqlite3,json,sys\nc=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True)\nc.row_factory=sqlite3.Row\nr=c.execute(sys.argv[2],json.loads(sys.argv[3])).fetchall()\nprint(json.dumps([dict(x) for x in r]))";
 const p=spawnSync('python3',['-c',code,db,query,JSON.stringify(args)],{encoding:'utf8'});
 assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);
}
const count=type=>sql("SELECT count(*) n FROM event_store WHERE event_type=?",[type])[0].n;
const memory=()=>sql("SELECT count(*) n FROM learning_evidence_projection")[0].n;
async function waitFor(fn) { for(let n=0;n<100;n++){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('Condition not reached'); }
(async()=>{
 const browser=await chromium.launch({headless:true}); runningBrowser=browser;
 let page=await browser.newPage({viewport:{width:1440,height:1000}}); activePage=page;
 const external=[];
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(!['127.0.0.1','localhost'].includes(u.hostname)){external.push(u.origin);await route.abort();return;}
  await route.continue();
 });
 page.on('dialog',dialog=>dialog.dismiss());
 const gotoStudy=async()=>{await page.getByRole('button',{name:/Sessão de questões/}).click();};
 let dropPreparation=true;
 await page.route('**/api/v1/questions/*/predictions',async route=>{
  const response=await route.fetch();
  if(dropPreparation){dropPreparation=false;await route.abort('failed');}
  else await route.fulfill({response});
 });
 await page.goto('http://127.0.0.1:5173');
 await gotoStudy();
 await page.getByRole('button',{name:/Iniciar Sessão de Estudo/}).click();
 await page.getByRole('button',{name:'Tentar novamente',exact:true}).waitFor();
 assert.equal(count('PREDICTION_COMMITTED'),1);
 assert.equal(count('ANSWER_SUBMITTED'),0);assert.equal(memory(),0);
 await page.getByRole('radio').first().click({force:true});
 assert.equal(await page.getByRole('radio').first().getAttribute('aria-checked'),'false');
 const frozen=sql("SELECT event_id,payload_json FROM event_store WHERE event_type='PREDICTION_COMMITTED'")[0];
 await page.screenshot({path:path.join(root,'01-preparation-ack-lost.png'),fullPage:true});
 await page.reload();await gotoStudy();
 await waitFor(async()=>!await page.getByRole('button',{name:'Tentar novamente',exact:true}).count() &&
   await page.getByRole('radio').count()>0);
 await page.waitForFunction(()=>Object.keys(localStorage).some(k=>k.startsWith('fiscalstudy:prospective:v1:[')));
 // Wait for the server-confirmed preparation before selection.
 await page.locator('.options[aria-busy="false"]').waitFor();
 assert.equal(count('PREDICTION_COMMITTED'),1);
 assert.equal(sql("SELECT payload_json FROM event_store WHERE event_id=?",[frozen.event_id])[0].payload_json,frozen.payload_json);
 let dropAnswer=true;
 await page.route('**/api/v1/questions/*/attempts',async route=>{
  const response=await route.fetch();
  if(dropAnswer){dropAnswer=false;await route.abort('failed');}
  else await route.fulfill({response});
 });
 await page.getByRole('radio').first().click();
 await page.locator('.conf-btn').nth(3).click();
 await page.locator('.submit-btn').evaluate(el=>{el.click();el.click();});
 await waitFor(()=>count('ANSWER_SUBMITTED')===1 && memory()===1);
 await page.screenshot({path:path.join(root,'02-answer-ack-lost.png'),fullPage:true});
 await page.reload();await gotoStudy();
 await page.locator('.option-card.correct').waitFor();
 await waitFor(async()=>await page.locator('.option-card.correct').count()===1);
 assert.equal(count('ANSWER_SUBMITTED'),1);assert.equal(memory(),1);
 const attempt=sql("SELECT rowid,occurred_at,payload_json FROM event_store WHERE event_type='ANSWER_SUBMITTED'")[0];
 const forecast=sql("SELECT rowid,recorded_at FROM event_store WHERE event_id=?",[frozen.event_id])[0];
 assert(forecast.rowid<attempt.rowid);
 assert(Date.parse(forecast.recorded_at)<=Date.parse(attempt.occurred_at));
 assert.equal(JSON.parse(attempt.payload_json).prospectivePredictionId,JSON.parse(frozen.payload_json).predictionId);
 // A completed answer remains completed after another page reload; no refit/backfill.
 await page.reload();await gotoStudy();
 await page.locator('.option-card.correct').waitFor();
 assert.equal(count('PREDICTION_COMMITTED'),1);assert.equal(count('ANSWER_SUBMITTED'),1);
 await page.screenshot({path:path.join(root,'03-restored-completed-answer.png'),fullPage:true});
 // New frontend/browser runtime without sessionStorage: local journal must restore the same session.
 const persisted=await page.context().storageState();
 const priorSession=await page.evaluate(()=>localStorage.getItem('fiscalstudy_active_question_session'));
 await page.close();
 page=await browser.newPage({storageState:persisted,viewport:{width:1440,height:1000}});activePage=page;
 page.on('dialog',dialog=>dialog.dismiss());
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(!['127.0.0.1','localhost'].includes(u.hostname)){external.push(u.origin);await route.abort();return;}
  await route.continue();
 });
 await page.goto('http://127.0.0.1:5173');await gotoStudy();
 await page.locator('.option-card.correct').waitFor();
 assert.equal(await page.evaluate(()=>localStorage.getItem('fiscalstudy_active_question_session')),priorSession);
 assert.equal(count('PREDICTION_COMMITTED'),1);assert.equal(count('ANSWER_SUBMITTED'),1);
 await waitFor(async()=>await page.locator('.session-map-bar').getAttribute('data-answered-count')==='1');
 await page.screenshot({path:path.join(root,'04-new-runtime-recovery.png'),fullPage:true});
 // Switch quickly while preparation is pending. The response must not select/complete another item.
 await page.getByRole('button',{name:'Próxima ➔',exact:true}).click();
 await page.getByRole('button',{name:'⬅ Anterior',exact:true}).click();
 await page.locator('.option-card.correct').waitFor();
 assert.equal(count('ANSWER_SUBMITTED'),1);
 // No grade leaks in question presentation.
 const item=await (await page.request.get('http://127.0.0.1:8080/api/v1/questions/batch?limit=2')).json();
 for(const q of item)assert(!('correctOption' in q));
 // Full running filter: no unauthenticated export, wrong-origin or rebound Host access.
 const endpoint='http://127.0.0.1:8080/api/v1/learning-lab/prospective-export';
 assert.equal((await page.request.get(endpoint)).status(),403);
 assert.equal((await page.request.get(endpoint,{headers:{'X-FiscalStudy-Admin-Token':process.env.FISCALSTUDY_ADMIN_TOKEN,Origin:'https://untrusted.invalid'}})).status(),403);
 const response=await page.request.get(endpoint,{headers:{'X-FiscalStudy-Admin-Token':process.env.FISCALSTUDY_ADMIN_TOKEN}});
 assert.equal(response.status(),200);
 const envelope=await response.json();
 assert.equal(JSON.parse(envelope.inputJson).sourceKind,'SYNTHETIC_FIXTURE');
 fs.writeFileSync(path.join(root,'browser-export.json'),JSON.stringify(envelope));
 // A separate automated attempt must not add eligible FSRS evidence.
 const qid=JSON.parse(frozen.payload_json).questionId,id=crypto.randomUUID(),sid='test-browser-ineligible';
 await page.request.post('http://127.0.0.1:8080/api/v1/questions/'+qid+'/predictions',{data:{attemptId:id,sessionId:sid}});
 const answer=await page.request.post('http://127.0.0.1:8080/api/v1/questions/'+qid+'/attempts',{data:{attemptId:id,sessionId:sid,selectedOption:'A',confidenceLevel:4,activeTimeMs:1000,usedHelp:false}});
 assert.equal(answer.status(),200);assert.equal(memory(),1);
 assert.equal(external.length,0);
 fs.writeFileSync(path.join(root,'browser-summary.json'),JSON.stringify({source_kind:'SYNTHETIC_FIXTURE',checks:['preparation_before_answer','lost_preparation_ack_reload','lost_answer_ack_reload','double_click','completed_reload','frontend_runtime_restart','rapid_question_switch','no_grade_leak','export_authorization','ineligible_fsrs_exclusion'],attempts:count('ANSWER_SUBMITTED'),memory_evidence:memory(),can_apply:false,can_schedule:false},null,2));
 await browser.close();
 console.log('Real-browser synthetic homolocation passed; personal validation NOT_EXECUTED.');
})().catch(async error=>{
 const message=String(error.message).split(process.env.FISCALSTUDY_ADMIN_TOKEN || 'NEVER_A_TOKEN').join('[REDACTED]');
 console.error(message);
 fs.writeFileSync(path.join(root,'browser-failure.json'),JSON.stringify({source_kind:'SYNTHETIC_FIXTURE',status:'FAILED',message}));
 if(activePage) await activePage.screenshot({path:path.join(root,'browser-failure.png'),fullPage:true,timeout:5000}).catch(()=>{});
 if(runningBrowser) await runningBrowser.close().catch(()=>{});
 process.exitCode=1;
});
