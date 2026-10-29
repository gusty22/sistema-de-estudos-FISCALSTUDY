"""Read-only local export evaluation. Does not start study, contact services or write SQLite."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import subprocess
import sys
import stat
import tempfile
from datetime import datetime, timezone

MAX_EXPORT_BYTES = 32 * 1024 * 1024  # Project policy for this local tool.
ENGINE = Path(__file__).resolve().parents[1]

def sha(data):
    return hashlib.sha256(data).hexdigest()

def bounded_read(path, limit):
    # Bound the read itself, including growth/replacement after stat().
    with Path(path).open("rb") as stream:
        if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
            raise ValueError("Regular evidence/key file required")
        raw = stream.read(limit + 1)
    if len(raw) > limit:
        raise ValueError("Evidence/key exceeds local processing limit")
    return raw


def make_private_directory(path):
    path.mkdir(mode=0o700, exist_ok=False)
    if os.name != "nt":
        if stat.S_IMODE(path.stat().st_mode) & 0o077:
            raise RuntimeError("Private POSIX directory required")
        return "POSIX_0700"
    # chmod is not a Windows DACL. Restrict BEFORE copying any input, then audit.
    command = r"""
$ErrorActionPreference='Stop'
$p=$env:FISCALSTUDY_PRIVATE_DIRECTORY
if ([IO.DriveInfo]::new([IO.Path]::GetPathRoot($p)).DriveFormat -ne 'NTFS') { throw 'NTFS required' }
$user=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$allowed=@($user,'S-1-5-18','S-1-5-32-544')
$acl=[Security.AccessControl.DirectorySecurity]::new()
$acl.SetAccessRuleProtection($true,$false)
foreach($sid in $allowed) {
  $rule=[Security.AccessControl.FileSystemAccessRule]::new(
    [Security.Principal.SecurityIdentifier]::new($sid), 'FullControl',
    'ContainerInherit,ObjectInherit', 'None', 'Allow')
  $acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $p -AclObject $acl
$checked=Get-Acl -LiteralPath $p
if (!$checked.AreAccessRulesProtected) { throw 'Inherited directory ACL' }
$rules=$checked.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])
foreach($rule in $rules) {
  if ($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -notin $allowed) { throw 'Broad ACL' }
}
if (!($rules | Where-Object { $_.IdentityReference.Value -eq $user -and $_.AccessControlType -eq 'Allow' })) { throw 'Owner access absent' }
"""
    env = os.environ.copy()
    env["FISCALSTUDY_PRIVATE_DIRECTORY"] = str(path)
    check = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command],
                           env=env, capture_output=True, timeout=30, check=False)
    if check.returncode:
        raise RuntimeError("Cannot establish/audit private NTFS directory; no input copied")
    return "NTFS_PROTECTED_USER_SYSTEM_ADMINISTRATORS"


def validate_export(path, synthetic_test=False, trusted_custody=False):
    raw = bounded_read(path, MAX_EXPORT_BYTES)
    envelope = json.loads(raw.decode("utf-8"))
    if envelope.get("contractVersion") != "prospective-question-v1" or envelope.get("can_apply") is not False or envelope.get("can_schedule") is not False:
        raise ValueError("Unsupported authority/contract")
    payload = envelope.get("inputJson")
    if not isinstance(payload, str) or sha(payload.encode("utf-8")) != envelope.get("inputSha256"):
        raise ValueError("Export integrity mismatch; not an authenticity check")
    source = json.loads(payload)
    if source.get("sourceKind") == "SYNTHETIC_FIXTURE" and not synthetic_test:
        raise ValueError("Synthetic exports require explicit test mode")
    if synthetic_test and source.get("sourceKind") != "SYNTHETIC_FIXTURE":
        raise ValueError("Test mode cannot relabel personal/unknown data")
    if not synthetic_test and not trusted_custody:
        raise ValueError("Personal evaluation requires an externally trusted signing key and source identity")
    return raw, source.get("sourceKind")

def private_write(path, data):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as target:
        target.write(data)

def evaluate_local(input_path, output, rscript="Rscript", synthetic_test=False,
                   trusted_public_key=None, trusted_source_id=None):
    input_path = Path(input_path).resolve()
    if bool(trusted_public_key) != bool(trusted_source_id):
        raise ValueError("Both external trust inputs required")
    attested = bool(trusted_public_key and trusted_source_id)
    raw, source = validate_export(input_path, synthetic_test, attested)
    output = Path(output).resolve()
    storage_privacy = make_private_directory(output)  # Refuse reuse; audit before input copy.
    private_write(output / "input-envelope.json", raw)
    manifest = {
        "contract_version": "personal-pilot-execution-v1",
        "status": "RUNNING",
        "source_kind": source,
        "storage_privacy": storage_privacy,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "input_file_sha256": sha(raw),
        "workflow_protocol": "personal-prospective-pilot-v2",
        "scoring_protocol": "personal-prospective-pilot-v1",
        "cohort": "ALL_PRECOMMITTED_FORECASTS_IN_SNAPSHOT_NOT_A_DELAYED_OR_NOVEL_ITEM_TRIAL",
        "personal_validation": "NOT_ESTABLISHED",
        "can_apply": False, "can_schedule": False,
        "code_sha256": {str(file.relative_to(ENGINE)): sha(file.read_bytes()) for file in sorted(
            list((ENGINE / "R").glob("*.R")) + [ENGINE / name for name in
            ["lab/prospective_evaluation.R", "lab/attested_prospective_evaluation.R", "lab/prospective_scorecard.R", "lab/individual_calibration.R", "lab/personal_pilot.py"]])},
    }
    error = None
    trusted_bytes = None
    temporary_root = None
    try:
        argv = [rscript, str(ENGINE / ("lab/attested_prospective_evaluation.R" if attested else "lab/prospective_evaluation.R")),
                str(output / "input-envelope.json"), str(output / "pending-metrics.json")]
        if attested:
            # Freeze the externally provisioned public key for replay; never accept an embedded key.
            trusted_bytes = bounded_read(trusted_public_key, 64 * 1024)
            private_write(output / "trusted-public.pem", trusted_bytes)
            argv += [str(output / "trusted-public.pem"), trusted_source_id,
                     "synthetic-test" if synthetic_test else "operational"]
        # R rejects spaces in R_TempDir on POSIX; reports/inputs may still use them.
        temporary_root = tempfile.TemporaryDirectory(prefix="fiscalstudy-r-")
        temporary = Path(temporary_root.name) / "private"
        manifest["temporary_storage_privacy"] = make_private_directory(temporary)
        r_temp = str(temporary)
        if os.name == "nt" and " " in r_temp:
            import ctypes
            buffer = ctypes.create_unicode_buffer(32768)
            count = ctypes.windll.kernel32.GetShortPathNameW(r_temp, buffer, len(buffer))
            if not count or count >= len(buffer):
                raise RuntimeError("R requires a no-space private TEMP directory")
            r_temp = buffer.value
        if " " in r_temp:
            raise RuntimeError("R requires a no-space private TEMP directory")
        child_env = os.environ.copy()
        for name in ("TMPDIR", "TMP", "TEMP"):
            child_env[name] = r_temp
        run = subprocess.run(
            argv,
            cwd=ENGINE, env=child_env, capture_output=True, timeout=120, check=False)
        private_write(output / "r-output.log", run.stdout + run.stderr)
        if run.returncode:
            raise RuntimeError("R evaluation failed; private log retained")
        metrics_bytes = bounded_read(output / "pending-metrics.json", MAX_EXPORT_BYTES)
        metrics = json.loads(metrics_bytes.decode("utf-8"))
        if metrics.get("can_apply") is not False or metrics.get("can_schedule") is not False:
            raise RuntimeError("Unexpected analytical authority")
        envelope = json.loads(raw.decode("utf-8"))
        required = ("forecast_count", "scored_count", "excluded_count")
        if (metrics.get("contract_version") != "prospective-evaluation-v1"
                or metrics.get("input_sha256") != envelope["inputSha256"]
                or metrics.get("source_kind") != source
                or any(type(metrics.get(key)) is not int or metrics[key] < 0 for key in required)
                or metrics["scored_count"] > metrics["forecast_count"]
                or not isinstance(metrics.get("metrics"), dict)
                or not isinstance(metrics.get("scientific_scorecard"), dict)):
            raise RuntimeError("Incomplete or mismatched analytical report")
        expected_auth = ("VERIFIED_SIGNATURE_SYNTHETIC_INTEGRATION_ONLY" if synthetic_test else
                         "VERIFIED_SIGNATURE_EXTERNALLY_TRUSTED_INSTALLATION")
        if attested and metrics.get("source_authentication") != expected_auth:
            raise RuntimeError("Custody verification missing from R report")
        n = metrics["scored_count"]
        score = metrics["scientific_scorecard"]
        if (score.get("version") != "prospective-scorecard-v1" or score.get("n") != n
                or score.get("can_apply") is not False or score.get("can_schedule") is not False
                or (n == 0 and metrics["metrics"].get("status") != "INSUFFICIENT_EVIDENCE")
                or (n > 0 and metrics["metrics"].get("n") != n)):
            raise RuntimeError("Incomplete scientific scorecard")
        if bounded_read(input_path, MAX_EXPORT_BYTES) != raw:
            raise RuntimeError("Input changed during execution")
        if attested and bounded_read(trusted_public_key, 64 * 1024) != trusted_bytes:
            raise RuntimeError("External trust file changed during execution")
        if bounded_read(output / "input-envelope.json", MAX_EXPORT_BYTES) != raw:
            raise RuntimeError("Frozen input was replaced")
        if attested and bounded_read(output / "trusted-public.pem", 64 * 1024) != trusted_bytes:
            raise RuntimeError("Frozen trust file was replaced")
        private_write(output / "metrics.json", metrics_bytes)
        (output / "pending-metrics.json").unlink()
        manifest["source_authentication"] = metrics.get("source_authentication", "NOT_AUTHENTICATED")
        if attested:
            manifest["custody"] = metrics["custody"]
        manifest["status"] = "SUCCEEDED_SOFTWARE_EVALUATION_ONLY"
        manifest["metrics_sha256"] = sha((output / "metrics.json").read_bytes())
    except Exception as failed:
        manifest["status"] = "FAILED"
        manifest["failure_type"] = type(failed).__name__
        error = RuntimeError("Evaluation incomplete; inspect local private report")
    finally:
        if temporary_root is not None:
            temporary_root.cleanup()
        # On POSIX enforce private outputs; Windows ACLs must be checked separately.
        for file in output.iterdir():
            if file.is_file():
                file.chmod(0o600)
        private_write(output / "manifest.json", json.dumps(manifest, indent=2).encode("utf-8"))
    if error:
        raise error
    return manifest

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--rscript", default="Rscript")
    parser.add_argument("--synthetic-test", action="store_true")
    parser.add_argument("--trusted-public-key")
    parser.add_argument("--trusted-source-id")
    args = parser.parse_args()
    try:
        report = evaluate_local(args.input, args.output, args.rscript, args.synthetic_test,
                                args.trusted_public_key, args.trusted_source_id)
        print(json.dumps({"status": report["status"], "personal_validation": "NOT_ESTABLISHED", "can_apply": False, "can_schedule": False}))
    except Exception:
        print("Local pilot evaluation failed; no personal data or credentials printed.", file=sys.stderr)
        sys.exit(1)
