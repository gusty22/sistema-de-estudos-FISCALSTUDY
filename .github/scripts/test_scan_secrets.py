import contextlib
import importlib.util
import io
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("scan_secrets", Path(__file__).with_name("scan_secrets.py"))
scanner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scanner)

class ScanTests(unittest.TestCase):
    def test_pull_request_uses_validated_range_and_redacts_logs(self):
        with tempfile.TemporaryDirectory() as tmp:
            report = Path(tmp) / "redacted.json"
            report.write_text('[{"RuleID":"test","Secret":"NEVER_PRINT","File":"x","StartLine":1}]')
            output = io.StringIO()
            event = {"pull_request":{"base":{"sha":"a"*40},"head":{"sha":"b"*40}}}
            with patch.object(scanner.subprocess, "run", return_value=subprocess.CompletedProcess([], 1)) as run, contextlib.redirect_stdout(output):
                self.assertEqual(scanner.scan("gitleaks", event, "pull_request", report), 1)
            command = run.call_args.args[0]
            self.assertIn("a"*40+".."+"b"*40, command)
            self.assertIn("--redact=100", command)
            self.assertNotIn("NEVER_PRINT", output.getvalue())

    def test_injected_sha_is_rejected_before_execution(self):
        event = {"before":"--all;bad", "after":"b"*40}
        with patch.object(scanner.subprocess, "run") as run:
            with self.assertRaises(ValueError):
                scanner.scan("gitleaks", event, "push", Path("unused"))
            run.assert_not_called()

    def test_history_is_opt_in(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "report").write_text("[]")
            for event, kind in [({}, "dir"), ({"inputs":{"history":True}}, "git")]:
                with patch.object(scanner.subprocess, "run", return_value=subprocess.CompletedProcess([], 0)) as run:
                    scanner.scan("gitleaks", event, "workflow_dispatch", Path(tmp) / "report")
                    self.assertEqual(run.call_args.args[0][1], kind)
if __name__ == "__main__":
    unittest.main()
