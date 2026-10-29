"""Disposable synthetic full-stack test only. No operational databases or signing keys."""
import argparse,json,os,pathlib,secrets,sqlite3,subprocess,time,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[4]

def wait(url):
    for _ in range(120):
        try:
            with urllib.request.urlopen(url,timeout=2) as r:
                if r.status==200:return
        except Exception:time.sleep(.5)
    raise RuntimeError('Synthetic server readiness failed')

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',required=True);args=p.parse_args()
    output=pathlib.Path(args.output).resolve();allowed=pathlib.Path(os.environ['RUNNER_TEMP']).resolve()
    assert output.is_relative_to(allowed) and output!=allowed
    output.mkdir(mode=0o700,exist_ok=False)
    for enabled in (False,True):
        folder=output/('enabled' if enabled else 'disabled');folder.mkdir()
        env=os.environ.copy();env.update(FISCALSTUDY_DATA_DIR=str(folder/'data'),FISCALSTUDY_PROJECT_ROOT=str(ROOT),
            FISCALSTUDY_BROWSER_DIR=str(folder),FISCALSTUDY_ADMIN_TOKEN=secrets.token_hex(24),
            FISCALSTUDY_BIND='127.0.0.1',FISCALSTUDY_PORT='8080',FISCALSTUDY_ANKI_NETWORK_ALLOWED='false',
            FISCALSTUDY_COVERAGE_ENABLED=str(enabled).lower())
        env.pop('VITE_FISCALSTUDY_PROSPECTIVE_CAPTURE',None)
        if enabled:env['VITE_FISCALSTUDY_PROSPECTIVE_CAPTURE']='true'
        logs=[open(folder/name,'wb') for name in ('backend.log','frontend.log')]
        commands=[['java','-jar',str(ROOT/'backend/target/backend-0.0.1-SNAPSHOT.jar'),
            '--spring.profiles.active=isolated','--fiscalstudy.event-origin=REAL_STUDY',
            '--fiscalstudy.prospective.source-kind=SYNTHETIC_FIXTURE']]
        if enabled:commands[0]+=['--fiscalstudy.prospective.capture-authorized=true','--fiscalstudy.prospective.capture-enabled=true']
        processes=[]
        try:
            processes.append(subprocess.Popen(commands[0],cwd=ROOT,env=env,stdout=logs[0],stderr=subprocess.STDOUT))
            wait('http://127.0.0.1:8080/api/v1/learning-lab/prospective-status')
            with sqlite3.connect(folder/'data/fiscalstudy.db') as db:
                assert db.execute('select count(*) from event_store').fetchone()[0]==0
                assert db.execute('select count(*) from questions').fetchone()[0]==0
                db.execute("insert into concursos(id,nome,orgao,cargo,banca,ano) values('flow-contest','SYNTHETIC_FLOW','Fixture','Fiscal','FIXTURE',2026)")
                for n in range(1,4):
                    db.execute('insert into questions(id,enunciado,options_json,correct_option,disciplina,assunto,banca,ano,status,orgao,cargo) values(?,?,?,?,?,?,?,?,?,?,?)',
                        ('flow-q'+str(n),'SYNTHETIC_FLOW '+str(n)+': selecione A.',json.dumps(['A) Correta','B) Outra','C) Terceira','D) Quarta']),'A','Matemática','Frações','FIXTURE',2026,'VALIDADA','Fixture','Fiscal'))
            processes.append(subprocess.Popen(['npm','run','dev','--','--host','127.0.0.1','--strictPort'],cwd=ROOT/'frontend',env=env,stdout=logs[1],stderr=subprocess.STDOUT,start_new_session=True))
            wait('http://127.0.0.1:5173/')
            subprocess.run(['node',str(ROOT/'frontend/tests/browser/question-flow-coverage.cjs')],cwd=ROOT,env=env,check=True,timeout=200)
            # R scores the actual event-store export, not a manually reconstructed JSON registry.
            subprocess.run([env.get('FISCALSTUDY_RSCRIPT','Rscript'),'lab/prospective_evaluation.R',str(folder/'browser-export.json'),str(folder/'metrics.json')],cwd=ROOT/'analytics-engine',env=env,check=True,timeout=120)
            subprocess.run([env.get('FISCALSTUDY_RSCRIPT','Rscript'),'lab/prospective_evaluation.R',str(folder/'browser-export.json'),str(folder/'metrics-replay.json')],cwd=ROOT/'analytics-engine',env=env,check=True,timeout=120)
            assert (folder/'metrics.json').read_bytes()==(folder/'metrics-replay.json').read_bytes()
            report=json.loads((folder/'metrics.json').read_text())
            if not enabled:assert report['forecast_count']==0 and report['unforecasted_attempt_count']>=2
            else:assert report['scored_count']>=2 and report['excluded_count']>=3 and report['unforecasted_attempt_count']==1
            assert report['personal_validation']=='NOT_ESTABLISHED' and not report['can_apply'] and not report['can_schedule']
            print(json.dumps({'scope':'SYNTHETIC_ONLY','enabled':enabled,'forecasts':report['forecast_count'],'scored':report['scored_count'],'excluded':report['excluded_count'],'unforecasted':report['unforecasted_attempt_count']}),flush=True)
        finally:
            for proc in reversed(processes):
                if proc.poll() is None:
                    if proc is processes[-1] and len(processes)>1:
                        import signal
                        os.killpg(proc.pid,signal.SIGTERM)
                    else:proc.terminate()
                    try:proc.wait(timeout=15)
                    except subprocess.TimeoutExpired:proc.kill();proc.wait()
            for log in logs:log.close()
if __name__=='__main__':main()
