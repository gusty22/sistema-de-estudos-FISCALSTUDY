#!/usr/bin/env python3
"""
scripts/test_task_registry.py — Testes automatizados do registro de tarefas.
"""

import sys
import unittest
import tempfile
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import task_registry


class TestTaskRegistry(unittest.TestCase):
    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp())

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_create_and_get_task(self):
        task = task_registry.create_task(
            task_id="TASK-001",
            title="Teste Unitário",
            objective="Verificar criação correta de tarefas",
            agent="antigravity",
            branch="feature/teste",
            modules=["core-app/knowledge"],
            relevant_files=["knowledge/README.md"],
            tasks_dir=self.temp_dir,
        )
        self.assertEqual(task["id"], "TASK-001")
        self.assertEqual(task["status"], "PLANNED")
        self.assertEqual(task["agent"], "antigravity")

        loaded = task_registry.get_task("TASK-001", tasks_dir=self.temp_dir)
        self.assertEqual(loaded["title"], "Teste Unitário")
        self.assertEqual(loaded["modules"], ["core-app/knowledge"])

    def test_update_status_and_fields(self):
        task_registry.create_task(
            task_id="TASK-002",
            title="Implementação",
            objective="Implementar funcionalidade",
            tasks_dir=self.temp_dir,
        )

        updated = task_registry.update_task(
            task_id="TASK-002",
            status="IN_PROGRESS",
            discoveries="Descoberta importante A",
            changes="Modificado arquivo X",
            tasks_dir=self.temp_dir,
        )
        self.assertEqual(updated["status"], "IN_PROGRESS")
        self.assertEqual(updated["discoveries"], "Descoberta importante A")

        reloaded = task_registry.get_task("TASK-002", tasks_dir=self.temp_dir)
        self.assertEqual(reloaded["status"], "IN_PROGRESS")
        self.assertEqual(reloaded["changes"], "Modificado arquivo X")

    def test_invariant_validated_requires_evidence(self):
        task_registry.create_task(
            task_id="TASK-003",
            title="Validação sem teste",
            objective="Tentar validar sem teste",
            tasks_dir=self.temp_dir,
        )
        # Deve falhar sem testes e sem evidência
        with self.assertRaises(ValueError) as ctx:
            task_registry.update_task(
                task_id="TASK-003",
                status="VALIDATED",
                tasks_dir=self.temp_dir,
            )
        self.assertIn("Invariante violada", str(ctx.exception))

        # Deve passar quando há testes e evidências
        updated = task_registry.update_task(
            task_id="TASK-003",
            status="VALIDATED",
            tests="py -3 -m unittest discover",
            evidence="Ran 26 tests in 12s. OK",
            tasks_dir=self.temp_dir,
        )
        self.assertEqual(updated["status"], "VALIDATED")

    def test_invariant_merged_requires_confirmation(self):
        task_registry.create_task(
            task_id="TASK-004",
            title="Tentativa de merge prematuro",
            objective="Verificar bloqueio de MERGED",
            tasks_dir=self.temp_dir,
        )
        with self.assertRaises(ValueError) as ctx:
            task_registry.update_task(
                task_id="TASK-004",
                status="MERGED",
                tasks_dir=self.temp_dir,
            )
        self.assertIn("sem confirmação expressa", str(ctx.exception))

        updated = task_registry.update_task(
            task_id="TASK-004",
            status="MERGED",
            pr="https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/pull/99",
            pr_confirmed=True,
            tasks_dir=self.temp_dir,
        )
        self.assertEqual(updated["status"], "MERGED")

    def test_list_tasks(self):
        task_registry.create_task("T-1", "Tarefa 1", "Obj 1", tasks_dir=self.temp_dir)
        task_registry.create_task("T-2", "Tarefa 2", "Obj 2", tasks_dir=self.temp_dir)
        task_registry.update_task(
            "T-2",
            status="VALIDATED",
            tests="Test suite",
            evidence="20/20 passed",
            tasks_dir=self.temp_dir,
        )

        all_tasks = task_registry.list_tasks(tasks_dir=self.temp_dir)
        self.assertEqual(len(all_tasks), 2)

        planned_only = task_registry.list_tasks(status="PLANNED", tasks_dir=self.temp_dir)
        self.assertEqual(len(planned_only), 1)
        self.assertEqual(planned_only[0]["id"], "T-1")


if __name__ == "__main__":
    unittest.main()
