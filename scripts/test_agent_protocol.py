# Deterministic protocol/CLI tests; these do not execute an AI model.
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import test_context_tools as base
load = base.load

cli = load("context")

class ProtocolTests(unittest.TestCase):
    def test_adapters_reference_one_policy(self):
        root = cli.ROOT
        for name in ("CLAUDE.md", "GEMINI.md"):
            self.assertEqual((root / name).read_text().strip(), "@AGENTS.md")
        self.assertIn("../AGENTS.md", (root / ".github/copilot-instructions.md").read_text())
        rule = (root / ".cursor/rules/fiscalstudy.mdc").read_text()
        self.assertIn("alwaysApply: true", rule)
        self.assertIn("AGENTS.md", rule)
        # Byte budgets guard startup growth; no claim of semantic instruction following.
        self.assertLess(len((root / "AGENTS.md").read_bytes()), 5000)
        self.assertLess(len((root / ".agents/memory/CONTEXT.md").read_bytes()), 2600)

    def test_skill_resources_exist_without_executable_installers(self):
        for name in ("domain-modeling", "fiscalstudy-context-and-evidence"):
            skill = cli.ROOT / ".agents/skills" / name
            text = (skill / "SKILL.md").read_text(encoding="utf-8")
            self.assertTrue(text.startswith("---\n"))
            self.assertIn("name: " + name, text)
        self.assertTrue((cli.ROOT / ".agents/skills/domain-modeling/LICENSE").exists())

class CliBehaviorTests(unittest.TestCase):
    setUp = base.GraphLifecycleTests.setUp
    # Reuses a disposable tracked-source repository, not product data.
    def test_missing_graph_finds_service_and_missing_knowledge_falls_back(self):
        result = cli.locate("Service", "backend", root=self.root)
        self.assertEqual(result["backend"], "tracked-path")
        self.assertEqual(result["matches"][0]["path"], "backend/src/Service.java")
        doc = self.root / "docs/architecture/decision.md"
        doc.parent.mkdir(parents=True)
        doc.write_text("# Decision\nR never writes operational SQLite.", encoding="utf-8")
        cli.subprocess.run(["git", "add", "."], cwd=self.root, check=True)
        result = cli.decision("SQLite", root=self.root)
        self.assertEqual(result["backend"], "versioned-docs")
        self.assertIn("SQLite", result["matches"][0]["excerpt"])
        self.assertFalse((self.root / "graphify-out").exists())

    def test_homonyms_require_full_id(self):
        graph = self.root / "graph.json"
        graph.write_text(json.dumps({"nodes": [
            {"id": "class_service", "label": "Service", "source_file": "backend/src/Service.java", "source_location": "L1"},
            {"id": "ctor_service", "label": "Service", "source_file": "backend/src/Service.java", "source_location": "L1"}]}))
        with patch.object(cli.index, "refresh", return_value={"status":"fresh", "graph":"graph.json"}):
            self.assertTrue(cli.locate("Service", root=self.root)["ambiguous"])
            result = cli.locate("class_service", root=self.root)
            self.assertFalse(result["ambiguous"])
            self.assertEqual(result["matches"][0]["id"], "class_service")

    def test_invalid_graph_falls_back_without_blocking(self):
        (self.root / "graph.json").write_text("not-json")
        with patch.object(cli.index, "refresh", return_value={"status":"fresh", "graph":"graph.json"}):
            result = cli.locate("Service", root=self.root)
            self.assertEqual(result["backend"], "tracked-path")
            self.assertEqual(result["index_status"], "invalid")

    def test_snippet_refuses_path_escape(self):
        with self.assertRaises(ValueError):
            cli.snippet("../outside.md", 1, root=self.root)
