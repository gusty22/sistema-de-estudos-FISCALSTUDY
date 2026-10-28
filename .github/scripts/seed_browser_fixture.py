"""Only seeds an empty, disposable CI SQLite database; refuses other targets."""
import os,sys,sqlite3,pathlib,json
root=pathlib.Path(os.environ["FISCALSTUDY_BROWSER_DIR"]).resolve()
allowed=pathlib.Path(os.environ["RUNNER_TEMP"]).resolve()
assert root.is_relative_to(allowed) and root!=allowed
db=root/"data"/"fiscalstudy.db"
assert db.is_file()
with sqlite3.connect(db) as c:
    assert c.execute("select count(*) from questions").fetchone()[0]==0
    assert c.execute("select count(*) from event_store").fetchone()[0]==0
    c.execute("insert into concursos(id,nome,orgao,cargo,banca,ano) values(?,?,?,?,?,?)",
              ("fixture-contest","SYNTHETIC_FIXTURE","Fixture","Fiscal","FIXTURE",2026))
    for n in range(1,4):
        c.execute("insert into questions(id,enunciado,options_json,correct_option,disciplina,assunto,banca,ano,orgao,cargo,status) values(?,?,?,?,?,?,?,?,?,?,?)",
          ("fixture-q"+str(n),"SYNTHETIC_FIXTURE "+str(n)+": selecione a alternativa A.",
           json.dumps(["A) Correta","B) Outra","C) Terceira","D) Quarta","E) Quinta"]),"A","Matemática","Frações","FIXTURE",2026,"Fixture","Fiscal","VALIDADA"))
    c.execute("insert into questions(id,enunciado,options_json,correct_option,disciplina,assunto,banca,ano,status) values(?,?,?,?,?,?,?,?,?)",
      ("fixture-held","SYNTHETIC_HELD_ITEM_NEVER_DISPLAY",json.dumps(["A) Held","B) Other"]),"A","Matemática","Frações","FIXTURE",2026,"VALIDADA"))
    c.execute("insert into diagnostic_reservation_events values(?,?,?,?,?,?,?,?,?,?,?,?)",
      ("fixture-res-event","fixture-reservation","fixture-held",None,"RESERVED","synthetic-protocol","CI quarantine only","2026-10-27T00:00:00Z","{}","EXTERNAL_EXPOSURE_UNKNOWN","Synthetic fixture only","diagnostic-quarantine-v1"))
print("Seeded 3 study items and 1 quarantined synthetic item; production reservation creation remains disabled.")
