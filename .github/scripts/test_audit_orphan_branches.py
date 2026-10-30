import unittest

from audit_orphan_branches import audit


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

    def test_merged_head_on_main_is_not_candidate(self):
        result = audit([branch()], [pr(merged="2026-10-30")], lambda _: {"ahead_by": 2})
        self.assertEqual([], result)

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


if __name__ == "__main__":
    unittest.main()
