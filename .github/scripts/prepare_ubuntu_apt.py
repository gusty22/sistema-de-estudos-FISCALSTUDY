"""Configure only the disposable Ubuntu CI runner; never production machines."""
from pathlib import Path
import re

def configure(root=Path("/")):
    apt = root / "etc/apt"
    paths = [apt/"sources.list", *sorted((apt/"sources.list.d").glob("*.sources")),
             *sorted((apt/"sources.list.d").glob("*.list"))]
    found = False
    for path in paths:
        if not path.is_file():
            continue
        before = path.read_text()
        after = re.sub(r"mirror\+file:/etc/apt/apt-mirrors(?:-security)?\.txt",
                       "https://archive.ubuntu.com/ubuntu", before)
        after = re.sub(r"https?://azure\.archive\.ubuntu\.com/ubuntu",
                       "https://archive.ubuntu.com/ubuntu", after)
        found |= after != before or "archive.ubuntu.com/ubuntu" in after
        path.write_text(after)
        if "azure.archive.ubuntu.com" in after or "mirror+file:/etc/apt/apt-mirrors" in after:
            raise RuntimeError("Unresolved runner Ubuntu mirror: " + str(path))
    for path in sorted(apt.glob("apt-mirrors*.txt")):
        # Also remove the indirection's stale Azure target for subsequent tools.
        path.write_text("https://archive.ubuntu.com/ubuntu\n")
    if not found:
        raise RuntimeError("Recognized Ubuntu source configuration missing")
    (apt/"apt.conf.d/80-fiscalstudy-network").write_text(
        'Acquire::Retries "1";\nAcquire::http::Timeout "20";\n'
        'Acquire::https::Timeout "20";\nAPT::Update::Error-Mode "any";\n')
    for path in paths:
        if path.is_file():
            print(str(path) + "\n" + path.read_text())

if __name__ == "__main__":
    configure()
