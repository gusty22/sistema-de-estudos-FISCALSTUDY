import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
from personal_pilot import evaluate_local, validate_export, sha

class PersonalPilotTests(unittest.TestCase):
    def fixture(self, root):
        payload = json.dumps({"sourceKind": "SYNTHETIC_FIXTURE"})
        envelope = {"contractVersion": "prospective-question-v1", "can_apply": False,
                    "can_schedule": False, "inputJson": payload, "inputSha256": sha(payload.encode())}
        path = root / "export.json"
        path.write_text(json.dumps(envelope))
        return path

    def test_explicit_synthetic_mode_and_integrity(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.fixture(Path(directory))
            with self.assertRaises(ValueError):
                validate_export(path)
            self.assertEqual(validate_export(path, True)[1], "SYNTHETIC_FIXTURE")
            data = json.loads(path.read_text()); data["inputSha256"] = "0" * 64
            path.write_text(json.dumps(data))
            with self.assertRaises(ValueError):
                validate_export(path, True)

    def test_private_outputs_no_overwrite_and_original_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); path = self.fixture(root); original = path.read_bytes()
            def execute(argv, **kwargs):
                envelope = json.loads(path.read_text())
                Path(argv[-1]).write_text(json.dumps({"can_apply": False, "can_schedule": False,
                    "contract_version": "prospective-evaluation-v1", "input_sha256": envelope["inputSha256"],
                    "source_kind": "SYNTHETIC_FIXTURE", "forecast_count": 0, "scored_count": 0,
                    "excluded_count": 0, "metrics": {}, "scientific_scorecard": {}}))
                return SimpleNamespace(returncode=0, stdout=b"synthetic", stderr=b"")
            with patch("personal_pilot.subprocess.run", side_effect=execute):
                result = evaluate_local(path, root / "run", synthetic_test=True)
            self.assertEqual(result["status"], "SUCCEEDED_SOFTWARE_EVALUATION_ONLY")
            self.assertEqual(path.read_bytes(), original)
            if os.name != "nt":
                self.assertEqual((root / "run").stat().st_mode & 0o777, 0o700)
                self.assertEqual((root / "run/metrics.json").stat().st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError):
                evaluate_local(path, root / "run", synthetic_test=True)

    def test_failure_is_explicit_and_does_not_claim_success(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); path = self.fixture(root)
            with patch("personal_pilot.subprocess.run", return_value=SimpleNamespace(returncode=1, stdout=b"", stderr=b"synthetic failure")):
                with self.assertRaises(RuntimeError):
                    evaluate_local(path, root / "failed", synthetic_test=True)
            report = json.loads((root / "failed/manifest.json").read_text())
            self.assertEqual(report["status"], "FAILED")
            self.assertFalse(report["can_apply"])

    def test_incomplete_report_does_not_become_success(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); path = self.fixture(root)
            def incomplete(argv, **kwargs):
                Path(argv[-1]).write_text('{"can_apply":false,"can_schedule":false}')
                return SimpleNamespace(returncode=0, stdout=b"", stderr=b"")
            with patch("personal_pilot.subprocess.run", side_effect=incomplete):
                with self.assertRaises(RuntimeError):
                    evaluate_local(path, root / "incomplete", synthetic_test=True)
            self.assertEqual(json.loads((root / "incomplete/manifest.json").read_text())["status"], "FAILED")
