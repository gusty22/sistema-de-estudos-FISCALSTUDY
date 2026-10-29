/* Real product bank/viewer routes + actual active-session fallback component, synthetic-only SQLite. */
const {chromium}=require(process.env.FISCALSTUDY_PLAYWRIGHT_MODULE);
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=process.env.FISCALSTUDY_BROWSER_DIR;
assert(path.resolve(root).startsWith(path.resolve(process.env.RUNNER_TEMP)+path.sep));
const enabled=process.env.FISCALSTUDY_COVERAGE_ENABLED==='true';
function rows(type){const code="import sqlite3,json,sys\nc=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True)\nc.row_factory=sqlite3.Row\nprint(json.dumps([dict(x) for x in c.execute('select rowid,* from event_store where event_type=? order by rowid',(sys.argv[2],))]))";const p=spawnSync('python3',['-c',code,path.join(root,'data/fiscalstudy.db'),type],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);}
const count=t=>rows(t).length;
async function wait(fn){for(let i=0;i<150;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('Coverage condition timed out');}
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.FISCALSTUDY_CHROMIUM_PATH});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('dialog',d=>d.dismiss());
 try{
 await page.goto('http://127.0.0.1:5173');
 await page.getByRole('button',{name:/Banco de Questões/}).click();await page.getByRole('button',{name:'Todo o Acervo',exact:true}).click();
 let dropped=false;
 if(enabled)await page.route('**/api/v1/questions/*/predictions',async route=>{const response=await route.fetch();if(!dropped){dropped=true;await route.abort('failed');}else await route.fulfill({response});});
 await page.locator('button[data-question-id]').first().click();
 const modal=page.locator('.resolucao-modal-container');await modal.waitFor();const qid=await modal.getAttribute('data-question-id');
 if(enabled){await modal.getByRole('button',{name:'Tentar novamente',exact:true}).click();await wait(()=>count('PREDICTION_COMMITTED')===1);}
 await modal.locator('[role=radio][aria-disabled=false]').first().waitFor();
 await modal.getByRole('radio').first().click();
 if(enabled){let lose=true;await page.route('**/api/v1/questions/*/attempts',async route=>{const response=await route.fetch();if(lose){lose=false;await route.abort('failed');}else await route.fulfill({response});});}
 await modal.getByRole('button',{name:'Confirmar Resposta',exact:true}).evaluate(el=>{el.click();el.click();});
 await wait(()=>count('ANSWER_SUBMITTED')===1);
 if(enabled){
  const first=JSON.parse(rows('ANSWER_SUBMITTED')[0].payload_json);assert.equal(first.helpDeclarationProvided,false);assert(first.prospectivePredictionId);
  await modal.getByRole('button',{name:'Fechar resolução e voltar ao Banco',exact:true}).click();
  await page.locator('button[data-question-id="'+qid+'"]').click();await modal.locator('.is-correct-target').waitFor();
  assert.equal(count('ANSWER_SUBMITTED'),1);assert.equal(count('PREDICTION_COMMITTED'),1);
  await page.reload();await page.getByRole('button',{name:/Banco de Questões/}).click();await page.getByRole('button',{name:'Todo o Acervo',exact:true}).click();await page.locator('button[data-question-id="'+qid+'"]').click();
  await modal.locator('.is-correct-target').waitFor();assert.equal(count('ANSWER_SUBMITTED'),1);
  // Rapid question switch keeps the recovered result attached to its original item.
  const next=modal.getByRole('button',{name:'Próxima questão',exact:true});if(await next.count() && !await next.isDisabled()){
    await next.click();await modal.getByRole('button',{name:'Questão anterior',exact:true}).click();await modal.locator('.is-correct-target').waitFor();assert.equal(await modal.getAttribute('data-question-id'),qid);
  }
  await modal.getByRole('button',{name:'Nova tentativa',exact:true}).click();await modal.locator('[role=radio][aria-disabled=false]').first().waitFor();
  await modal.getByLabel('Ajuda nesta tentativa').selectOption('NO');await modal.getByRole('radio').first().click();
  await modal.getByRole('button',{name:'Confirmar Resposta',exact:true}).click();await wait(()=>count('ANSWER_SUBMITTED')===2);
  assert.notEqual(JSON.parse(rows('ANSWER_SUBMITTED')[0].payload_json).attemptId,JSON.parse(rows('ANSWER_SUBMITTED')[1].payload_json).attemptId);
 }
 await modal.getByRole('button',{name:'Fechar resolução e voltar ao Banco',exact:true}).click();
 // Actual QuestionViewer route, with the same gate and optional-help semantics.
 await page.getByRole('button',{name:/Sessão de questões/}).click();await page.getByRole('button',{name:/Iniciar Sessão de Estudo/}).click();
 await page.locator('.options[aria-busy="false"]').waitFor();await page.getByRole('radio').first().click();await page.locator('.conf-btn').nth(3).click();
 if(enabled)await page.getByLabel('Ajuda nesta tentativa').selectOption('NO');
 const before=count('ANSWER_SUBMITTED');await page.locator('.submit-btn').click();await wait(()=>count('ANSWER_SUBMITTED')===before+1);
 if(enabled){
  // Real parent component fallback, mounted only by a synthetic-guarded test entry (not a product route).
  await page.goto('http://127.0.0.1:5173/tests/fixtures/question_flow_coverage/active.html');
  await page.getByRole('button',{name:'Resolução de Questões',exact:true}).click();await page.getByRole('button',{name:'Resolver Questões de Fixação Embutidas',exact:true}).click();
  await modal.waitFor();await modal.locator('[role=radio][aria-disabled=false]').first().waitFor();await modal.getByLabel('Ajuda nesta tentativa').selectOption('YES');await modal.getByRole('radio').first().click();
  const n=count('ANSWER_SUBMITTED');await modal.getByRole('button',{name:'Confirmar Resposta',exact:true}).click();await wait(()=>count('ANSWER_SUBMITTED')===n+1);
  assert.equal(JSON.parse(rows('ANSWER_SUBMITTED').at(-1).payload_json).usedHelp,true);
 }else{
  assert.equal(count('PREDICTION_COMMITTED'),0);
  const denied=await page.request.post('http://127.0.0.1:8080/api/v1/questions/'+qid+'/predictions',{data:{attemptId:crypto.randomUUID(),sessionId:'synthetic-disabled'}});assert.equal(denied.status(),409);
  assert.equal(count('PREDICTION_COMMITTED'),0);
 }
 if(enabled){
  const pending=await page.request.post('http://127.0.0.1:8080/api/v1/questions/'+qid+'/predictions',{data:{attemptId:crypto.randomUUID(),sessionId:'synthetic-pending'}});assert.equal(pending.status(),200);
  const noForecast=crypto.randomUUID();
  assert.equal((await page.request.post('http://127.0.0.1:8080/api/v1/questions/'+qid+'/attempts',{data:{attemptId:noForecast,sessionId:'synthetic-unforecasted',selectedOption:'A',confidenceLevel:4,activeTimeMs:1000}})).status(),200);
  assert.equal((await page.request.post('http://127.0.0.1:8080/api/v1/questions/'+qid+'/predictions',{data:{attemptId:noForecast,sessionId:'synthetic-unforecasted'}})).status(),409);assert(!rows('PREDICTION_COMMITTED').some(row=>JSON.parse(row.payload_json).attemptId===noForecast));
 }
 // Strict chronology and append identity, not just expected selected actions.
 for(const f of rows('PREDICTION_COMMITTED')){const p=JSON.parse(f.payload_json);const a=rows('ANSWER_SUBMITTED').find(x=>JSON.parse(x.payload_json).attemptId===p.attemptId);if(a){assert(f.rowid<a.rowid);const ns=t=>{const m=t.match(/^(.*?)(?:\.(\d+))?Z$/);return BigInt(Date.parse(m[1]+'Z'))*1000000n+BigInt((m[2]||'').padEnd(9,'0'));};assert(ns(f.recorded_at)<ns(a.occurred_at));}}
 const response=await page.request.get('http://127.0.0.1:8080/api/v1/learning-lab/prospective-export',{headers:{'X-FiscalStudy-Admin-Token':process.env.FISCALSTUDY_ADMIN_TOKEN}});assert.equal(response.status(),200);
 assert.equal(response.headers()['x-fiscalstudy-export-kind'],'PROSPECTIVE_EVENT_SNAPSHOT');
 const csv=await page.request.get('http://127.0.0.1:8080/api/v1/analytics/export');assert.equal(csv.headers()['x-fiscalstudy-export-kind'],'DESCRIPTIVE_CSV');assert((await csv.text()).startsWith('question_id,'));
 const envelope=await response.json();assert.equal(JSON.parse(envelope.inputJson).sourceKind,'SYNTHETIC_FIXTURE');fs.writeFileSync(path.join(root,'browser-export.json'),JSON.stringify(envelope));
 fs.writeFileSync(path.join(root,'browser-summary.json'),JSON.stringify({scope:'SYNTHETIC_ONLY',enabled,forecasts:count('PREDICTION_COMMITTED'),answers:count('ANSWER_SUBMITTED'),checks:['real_bank_modal','real_question_viewer','export_kind_separation',...(enabled ? ['immutable_retry','unknown_help_excluded','active_parent_fallback_fixture','no_backfill'] : ['default_off_no_commit','direct_preparation_disabled'])],can_apply:false,can_schedule:false}));
 console.log('Synthetic question flow coverage passed, enabled='+enabled);
 }catch(e){await page.screenshot({path:path.join(root,'failure.png'),fullPage:true});fs.writeFileSync(path.join(root,'failure.html'),await page.content());throw e;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
