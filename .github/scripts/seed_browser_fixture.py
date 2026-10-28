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
      ("fixture-held","SYNTHETIC_HELD_ITEM_NEVER_DISPLAY SYNTHETIC_SOURCE_ITEM",json.dumps(["A) Held","B) Other"]),"A","Matemática","Frações","FIXTURE",2026,"VALIDADA"))
    c.execute("insert into diagnostic_reservation_events values(?,?,?,?,?,?,?,?,?,?,?,?)",
      ("fixture-res-event","fixture-reservation","fixture-held",None,"RESERVED","synthetic-protocol","CI quarantine only","2026-10-27T00:00:00Z","{}","EXTERNAL_EXPOSURE_UNKNOWN","Synthetic fixture only","diagnostic-quarantine-v1"))
print("Seeded 3 study items and 1 quarantined synthetic item; production reservation creation remains disabled.")

# The PDF and staging occurrence are synthetic copies with different identifiers.
source=root/"data"/"materials"/"source-fixture.pdf"
source.parent.mkdir(parents=True,exist_ok=True)
objects=[b"<< /Type /Catalog /Pages 2 0 R >>",b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
 b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 500] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
 b"<< /Length 69 >>\nstream\nBT /F1 12 Tf 20 400 Td (SYNTHETIC_SOURCE_ITEM) Tj ET\nendstream",
 b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
stream=b"BT /F1 12 Tf 20 400 Td (SYNTHETIC_HELD_ITEM_NEVER_DISPLAY SYNTHETIC_SOURCE_ITEM) Tj ET\n"
objects[3]=b"<< /Length "+str(len(stream)).encode()+b" >>\nstream\n"+stream+b"endstream"
pdf=bytearray(b"%PDF-1.4\n");offsets=[0]
for index,obj in enumerate(objects,1):
 offsets.append(len(pdf));pdf.extend(str(index).encode()+b" 0 obj\n"+obj+b"\nendobj\n")
xref=len(pdf);pdf.extend(b"xref\n0 6\n0000000000 65535 f \n")
for offset in offsets[1:]:pdf.extend(("%010d 00000 n \n"%offset).encode())
pdf.extend(("trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n"%xref).encode())
source.write_bytes(pdf)
with sqlite3.connect(db) as c:
 c.execute("insert into study_materials(id,disciplina,titulo,url_ou_caminho) values(?,?,?,?)",
  ("source-fixture","Matemática","SYNTHETIC_SOURCE_ITEM",str(source)))
with sqlite3.connect(root/"data"/"staging.db") as c:
 c.execute("insert into staging_files(id,rel_path,filename,file_size_bytes,sha256,total_pages) values(?,?,?,?,?,?)",
  ("source-copy","source-fixture.pdf","source-fixture.pdf",len(pdf),__import__("hashlib").sha256(pdf).hexdigest(),1))
 c.execute("insert into staging_documents(id,file_id,doc_role,page_start,page_end) values('source-doc','source-copy','PROVA',1,1)")
 c.execute("insert into staging_questions(id,document_id,numero_original,statement,options_json,correct_option,pages_json) values(?,?,?,?,?,?,?)",
  ("different-source-id","source-doc",1,"SYNTHETIC_HELD_ITEM_NEVER_DISPLAY SYNTHETIC_SOURCE_ITEM",json.dumps(["A) Held","B) Other"]),"A","[1]"))
