import copy
import unittest

from check_pr_contract import validate


def sample():
    return {
        "repository": {"full_name": "gusty22/sistema-de-estudos-FISCALSTUDY"},
        "pull_request": {
            "number": 101,
            "body": "Issue: #99\nDepends-on: none\nTestes: 12 testes passaram\nRiscos: sem risco conhecido",
            "user": {"login": "gusty22"},
            "head": {"ref": "feature/exemplo", "repo": {"full_name": "gusty22/sistema-de-estudos-FISCALSTUDY"}},
            "base": {"ref": "main"},
        },
    }


def compare(_base, _head):
    return {"ahead_by": 1, "behind_by": 0}


class ContractTests(unittest.TestCase):
    def test_main_clean(self):
        self.assertEqual([], validate(sample(), lambda _: {}, compare))

    def test_stacked_open(self):
        event = sample()
        event["pull_request"]["base"]["ref"] = "feature/pr-mae"
        event["pull_request"]["body"] = event["pull_request"]["body"].replace("Depends-on: none", "Depends-on: #55")
        parent = {"state": "open", "head": {"ref": "feature/pr-mae"}, "merged_at": None}
        self.assertEqual([], validate(event, lambda _: parent, compare))

    def test_parent_merged_retarget_main(self):
        event = sample()
        event["pull_request"]["body"] = event["pull_request"]["body"].replace("Depends-on: none", "Depends-on: #55")
        parent = {"state": "closed", "head": {"ref": "feature/pr-mae"}, "merged_at": "2026-10-30T00:00:00Z"}
        self.assertEqual([], validate(event, lambda _: parent, compare))

    def test_reject_missing_issue_and_wrong_author(self):
        event = sample()
        event["pull_request"]["body"] = "Depends-on: none"
        event["pull_request"]["user"]["login"] = "bot"
        failures = validate(event, lambda _: {}, compare)
        self.assertTrue(any("Issue:" in x for x in failures))
        self.assertTrue(any("Autor" in x for x in failures))

    def test_reject_stale_base(self):
        failures = validate(sample(), lambda _: {}, lambda *_: {"ahead_by": 1, "behind_by": 2})
        self.assertTrue(any("desatualizada" in x for x in failures))

    def test_reject_missing_parent(self):
        event = sample()
        event["pull_request"]["base"]["ref"] = "feature/outro"
        failures = validate(event, lambda _: {}, compare)
        self.assertTrue(any("sem dependencia" in x for x in failures))


if __name__ == "__main__":
    unittest.main()
