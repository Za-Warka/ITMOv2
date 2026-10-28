"""Save functional/security test output for a working tree or an isolated Git baseline.

python3 security/verify.py --output evidence/after
python3 security/verify.py --baseline-ref HEAD --output evidence/before-final
Baseline security failures are expected and recorded, not converted to passing tests.
"""

import argparse
from contextlib import ExitStack
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

from harness import ROOT


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--baseline-ref")
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    if (output / "test-summary.json").exists():
        raise SystemExit("Refusing to replace existing test evidence")
    with ExitStack() as stack:
        root = ROOT
        if args.baseline_ref:
            root = Path(stack.enter_context(tempfile.TemporaryDirectory(prefix="shop-test-baseline-")))
            (root / "lab").mkdir()
            (root / "security").mkdir()
            for name in ("service.py", "sandbox.py", "test_service.py", "test_http.py"):
                content = subprocess.check_output(
                    ["git", "show", f"{args.baseline_ref}:practices/practice_06/lab/{name}"], cwd=ROOT)
                (root / "lab" / name).write_bytes(content)
            for name in ("harness.py", "test_security.py"):
                shutil.copyfile(ROOT / "security" / name, root / "security" / name)
        summary = {"service_source": args.baseline_ref or "working tree", "python": sys.version,
                   "service_sha256": hashlib.sha256((root / "lab/service.py").read_bytes()).hexdigest(),
                   "security_tests_sha256": hashlib.sha256((root / "security/test_security.py").read_bytes()).hexdigest(),
                   "suites": {}}
        for suite in ("lab", "security"):
            command = [sys.executable, "-m", "unittest", "discover", "-s", str(root / suite), "-p", "test_*.py", "-v"]
            run = subprocess.run(command, cwd=root, env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
                                 capture_output=True, text=True, timeout=120)
            log = run.stdout + run.stderr
            (output / f"test-{suite}.txt").write_text(log, encoding="utf-8")
            count = re.search(r"Ran (\d+) tests?", log)
            summary["suites"][suite] = {"returncode": run.returncode, "tests_run": int(count[1]) if count else None,
                                         "command": command}
        (output / "test-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(summary, indent=2))
        if args.baseline_ref:
            expected = summary["suites"]["lab"]["returncode"] == 0 and summary["suites"]["security"]["returncode"] == 1
        else:
            expected = all(suite["returncode"] == 0 for suite in summary["suites"].values())
        if not expected:
            raise SystemExit(1)


if __name__ == "__main__":
    main()
