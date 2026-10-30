import unittest
from contextlib import redirect_stdout
from io import StringIO
from unittest.mock import patch

from audit_orphan_branches import REPO, audit, main


def branch(name="feature/nova", sha="abc"):
    return {"name": name, "commit": {"sha": sha}}


def pr(state="closed", base="main", merged=None, sha="abc"):
    return {
        "state": state, "merged_at": merged,
        "base": {"ref": base}, "head": {"ref": "feature/nova", "sha": sha},
    }


class BranchAuditTests(unittest.TestCase):
    def test_no_pr_is_candidate_if_ahead(self):
        result = audit([branch()], [], lambda _: {"ahead_by": 2})
        self.assertEqual(1, len(result))
        self.assertIn("Nenhuma PR", result[0]["reason"])

    def test_merged_head_still_requires_ancestry_comparison(self):
        result = audit([branch()], [pr(merged="2026-10-30")], lambda _: {"ahead_by": 2})
        self.assertEqual(1, len(result))
        self.assertIn("Historico mudou", result[0]["reason"])

    def test_merged_ancestor_is_not_candidate(self):
        result = audit([branch()], [pr(merged="2026-10-30")], lambda _: {"ahead_by": 0})
        self.assertEqual([], result)

    def test_comparison_uses_captured_commit_not_mutable_branch_name(self):
        compared = []

        def compare(sha):
            compared.append(sha)
            return {"ahead_by": 1}

        audit([branch(sha="captured-commit")], [], compare)
        self.assertEqual(["captured-commit"], compared)

    def test_merged_into_other_branch_requires_review(self):
        result = audit([branch()], [pr(base="feature/mae", merged="2026-10-30")],
                       lambda _: {"ahead_by": 1})
        self.assertIn("outra branch", result[0]["reason"])

    def test_open_pr_is_already_tracked(self):
        result = audit([branch()], [pr(state="open")], lambda _: {"ahead_by": 4})
        self.assertEqual([], result)

    def test_behind_only_is_not_candidate(self):
        result = audit([branch()], [], lambda _: {"ahead_by": 0})
        self.assertEqual([], result)

    @patch.dict("os.environ", {}, clear=True)
    @patch("audit_orphan_branches.get")
    @patch("audit_orphan_branches.pages")
    def test_main_compares_both_snapshot_shas(self, pages, get):
        pages.return_value = [branch("main", "main-snapshot"), branch(sha="head-snapshot")]
        get.side_effect = [[], {"ahead_by": 0}]
        with redirect_stdout(StringIO()) as output:
            main()
        self.assertEqual(f"/repos/{REPO}/compare/main-snapshot...head-snapshot",
                         get.call_args.args[0])
        self.assertIn("main-snapshot", output.getvalue())


if __name__ == "__main__":
    unittest.main()
