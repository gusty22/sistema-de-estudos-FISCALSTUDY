import importlib.util
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location("prepare",Path(__file__).with_name("prepare_ubuntu_apt.py"))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class MirrorTests(unittest.TestCase):
    def test_direct_and_indirect_sources_and_idempotence(self):
        for uri in ("http://azure.archive.ubuntu.com/ubuntu",
                    "https://azure.archive.ubuntu.com/ubuntu",
                    "mirror+file:/etc/apt/apt-mirrors.txt",
                    "mirror+file:/etc/apt/apt-mirrors-security.txt"):
            with self.subTest(uri=uri), tempfile.TemporaryDirectory() as temp:
                root=Path(temp);apt=root/"etc/apt"
                (apt/"sources.list.d").mkdir(parents=True);(apt/"apt.conf.d").mkdir()
                source=apt/"sources.list.d/ubuntu.sources"
                source.write_text("Types: deb\nURIs: "+uri+"\nSuites: noble noble-security\nComponents: main universe\n")
                mirror=apt/"apt-mirrors.txt";mirror.write_text("http://azure.archive.ubuntu.com/ubuntu\n")
                module.configure(root);first=source.read_text();module.configure(root)
                self.assertEqual(first,source.read_text())
                self.assertIn("https://archive.ubuntu.com/ubuntu",first)
                self.assertIn("Suites: noble noble-security",first)
                self.assertNotIn("azure",mirror.read_text())
                self.assertIn('Timeout "20"',(apt/"apt.conf.d/80-fiscalstudy-network").read_text())

    def test_unknown_configuration_fails_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);(root/"etc/apt/sources.list.d").mkdir(parents=True)
            with self.assertRaisesRegex(RuntimeError,"missing"):
                module.configure(root)

if __name__=="__main__":unittest.main()
