#!/usr/bin/env python3
"""Fetch a reviewed release into a disposable directory; verify fixed SHA256."""
import argparse
import hashlib
import io
from pathlib import Path
import platform
import tarfile
import urllib.request
import zipfile
VERSION = "8.30.1"
ARTIFACTS = {
    "Linux": ("linux_x64.tar.gz", "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"),
    "Windows": ("windows_x64.zip", "d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e"),
}
def install(output):
    if platform.machine().lower() not in {"amd64", "x86_64"}:
        raise SystemExit("Only reviewed x64 artifacts supported")
    suffix, digest = ARTIFACTS[platform.system()]
    url = f"https://github.com/gitleaks/gitleaks/releases/download/v{VERSION}/gitleaks_{VERSION}_{suffix}"
    with urllib.request.urlopen(url, timeout=60) as response:
        data = response.read(40_000_001)
    if len(data) > 40_000_000 or hashlib.sha256(data).hexdigest() != digest:
        raise SystemExit("Release checksum/size mismatch")
    name = "gitleaks.exe" if suffix.endswith(".zip") else "gitleaks"
    if suffix.endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            executable = archive.read(name)
    else:
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
            member = archive.getmember(name)
            if not member.isfile() or member.size > 100_000_000:
                raise SystemExit("Unexpected executable member")
            executable = archive.extractfile(member).read()
    output.mkdir(parents=True, exist_ok=True)
    target = output / name
    target.write_bytes(executable)
    target.chmod(0o700)
    print(target.resolve())
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    install(parser.parse_args().output)
