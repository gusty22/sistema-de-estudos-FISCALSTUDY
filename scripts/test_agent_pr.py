import argparse
import unittest
from unittest.mock import patch

from agent_pr import dependency_base, ensure_rebased, ensure_worktree, pr_body


class AgentPrUnitTests(unittest.TestCase):
    def test_description_tracks_issue_and_dependency(self):
        args = argparse.Namespace(issue=12, depends_on=10, summary="Instrumentacao",
                                  tests="7 testes aprovados", risks="Nenhum identificado")
        body = pr_body(args, "feature/mae")
        self.assertIn("Issue: #12", body)
        self.assertIn("Depends-on: #10", body)
        self.assertIn("Testes: 7 testes", body)

    @patch("agent_pr.json_command")
    def test_stacked_pr_uses_open_parent_head(self, call):
        call.return_value = {"state": "OPEN", "headRefName": "feature/mae", "mergedAt": None}
        self.assertEqual("feature/mae", dependency_base(10))

    @patch("agent_pr.json_command")
    def test_merged_parent_returns_main(self, call):
        call.return_value = {"state": "MERGED", "headRefName": "feature/mae",
                             "mergedAt": "2026-10-30T00:00:00Z"}
        self.assertEqual("main", dependency_base(10))

    @patch("agent_pr.command")
    def test_reject_dirty_branch(self, call):
        call.side_effect = [
            type("Done", (), {"stdout": "feature/ok", "returncode": 0})(),
            type("Done", (), {"stdout": "?? secret.txt", "returncode": 0})(),
        ]
        with self.assertRaisesRegex(RuntimeError, "nao commitados"):
            ensure_worktree()

    @patch("agent_pr.command")
    def test_reject_outdated_base(self, call):
        call.side_effect = [
            type("Done", (), {"stdout": "", "returncode": 0})(),
            type("Done", (), {"stdout": "", "returncode": 1})(),
        ]
        with self.assertRaisesRegex(RuntimeError, "nao e ancestral"):
            ensure_rebased("main")


if __name__ == "__main__":
    unittest.main()
