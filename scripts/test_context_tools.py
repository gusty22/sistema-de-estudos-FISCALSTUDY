import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
def load(name):
    spec = importlib.util.spec_from_file_location(name, HERE / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
kb = load("obsidian_kb")
idx = load("context_index")

class KnowledgeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="context-á ")
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.vault = self.base / "technical-notes"
        self.vault.mkdir()
        self.db = self.base / "index.sqlite"
        self.note = self.vault / "Decisão.md"
        self.note.write_text("# Arquitetura\n## Contrato\nR não escreve no operacional. Fonte: contrato v1.", encoding="utf-8")

    def test_sections_utf8_read_only_and_limit(self):
        self.assertTrue(kb.sync_vault(self.vault, self.db))
        before = self.db.read_bytes()
        result = kb.search_vault("Contrato", self.db, limit=1, max_chars=30)
        self.assertEqual(result[0]["rel_path"], "Decisão.md")
        self.assertLessEqual(len(result[0]["excerpt"]), 30)
        self.assertEqual(before, self.db.read_bytes())

    def test_incremental_same_timestamp_deletion_and_exclusion(self):
        private = self.vault / "private"
        private.mkdir()
        (private / "segredo.md").write_text("naoindexar", encoding="utf-8")
        kb.sync_vault(self.vault, self.db)
        original_time = self.note.stat().st_mtime
        self.note.write_text("# Alteração\nnovo_contrato", encoding="utf-8")
        os.utime(self.note, (original_time, original_time))
        kb.sync_vault(self.vault, self.db)
        self.assertTrue(kb.search_vault("novo_contrato", self.db))
        self.assertFalse(kb.search_vault("naoindexar", self.db))
        self.note.unlink()
        kb.sync_vault(self.vault, self.db)
        self.assertFalse(kb.search_vault("novo_contrato", self.db))

    def test_noop_and_unavailable_do_not_destroy_index(self):
        kb.sync_vault(self.vault, self.db)
        before = self.db.read_bytes()
        kb.sync_vault(self.vault, self.db)
        self.assertEqual(before, self.db.read_bytes())
        self.assertFalse(kb.sync_vault(self.base / "missing", self.db))
        self.assertEqual(before, self.db.read_bytes())

    def test_source_binding_and_custom_exclusion(self):
        kb.sync_vault(self.vault, self.db, excludes=["Decisão.md"])
        self.assertFalse(kb.search_vault("Contrato", self.db))
        other = self.base / "other"
        other.mkdir()
        with self.assertRaises(ValueError):
            kb.sync_vault(other, self.db)

    def test_sync_refuses_to_write_inside_source_or_operational_name(self):
        with self.assertRaises(ValueError):
            kb.sync_vault(self.vault, self.vault / "index.db")
        with self.assertRaises(ValueError):
            kb.sync_vault(self.vault, self.base / "fiscalstudy.db")
        self.assertEqual(list(self.vault.glob("*.db")), [])

    def test_sync_refuses_unrelated_existing_database(self):
        conn = sqlite3.connect(self.db)
        conn.execute("CREATE TABLE unrelated (id INT)")
        conn.commit()
        conn.close()
        before = self.db.read_bytes()
        with self.assertRaises(ValueError):
            kb.sync_vault(self.vault, self.db)
        self.assertEqual(before, self.db.read_bytes())

    def test_query_never_syncs_or_creates_db(self):
        proc = subprocess.run([os.sys.executable, str(HERE / "obsidian_kb.py"),
                               "--query", "contrato", "--db", str(self.db)],
                              capture_output=True)
        self.assertEqual(proc.returncode, 2)
        self.assertFalse(self.db.exists())

class GraphLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        source = self.root / "backend/src/Service.java"
        source.parent.mkdir(parents=True)
        source.write_text("class Service {}", encoding="utf-8")
        (self.root / "db").mkdir()
        (self.root / "db/private.py").write_text("sensitive")
        subprocess.run(["git", "add", "."], cwd=self.root, check=True)

    def test_scope_unavailable_and_read_only_status(self):
        self.assertEqual(list(idx.inventory(self.root)), ["backend/src/Service.java"])
        self.assertEqual(idx.refresh(self.root)["status"], "stale")
        self.assertFalse((self.root / "graphify-out").exists())
        with patch.object(idx.shutil, "which", return_value=None):
            self.assertEqual(idx.refresh(self.root, run=True)["status"], "unavailable")

    def test_update_noop_edit_and_removal(self):
        def fake_run(args, **kwargs):
            if args[0] == "git":
                return real_run(args, **kwargs)
            graph = self.root / "graphify-out/source/graphify-out/graph.json"
            graph.parent.mkdir(parents=True, exist_ok=True)
            graph.write_text('{"nodes": [], "edges": []}')
            return subprocess.CompletedProcess(args, 0, b"", b"")
        real_run = subprocess.run
        with patch.object(idx.shutil, "which", return_value="graphify"), patch.object(idx.subprocess, "run", side_effect=fake_run):
            self.assertEqual(idx.refresh(self.root, run=True)["status"], "updated")
            self.assertEqual(idx.refresh(self.root, run=True)["status"], "fresh")
            (self.root / "backend/src/Service.java").write_text("class Renamed {}")
            self.assertEqual(idx.refresh(self.root)["changed"], 1)
            self.assertEqual(idx.refresh(self.root, run=True)["status"], "updated")
            (self.root / "backend/src/Service.java").unlink()
            self.assertEqual(idx.refresh(self.root, run=True)["removed"], 1)
            self.assertFalse((self.root / "graphify-out/source/backend/src/Service.java").exists())

    def test_failed_update_is_not_fresh(self):
        real_run = subprocess.run
        def failure(args, **kwargs):
            return real_run(args, **kwargs) if args[0] == "git" else subprocess.CompletedProcess(args, 1, b"", b"failed")
        with patch.object(idx.shutil, "which", return_value="graphify"), patch.object(idx.subprocess, "run", side_effect=failure):
            self.assertEqual(idx.refresh(self.root, run=True)["status"], "error")
            self.assertEqual(idx.refresh(self.root)["status"], "stale")

if __name__ == "__main__":
    unittest.main()
