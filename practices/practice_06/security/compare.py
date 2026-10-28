"""Validate saved before/after experiments without calling a model or a server."""

import argparse
import hashlib
import json
from pathlib import Path


def read(directory, name):
    return json.loads((directory / name).read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--before", type=Path, required=True)
    parser.add_argument("--after", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    before, after = args.before, args.after
    metadata = [read(directory, "metadata.json") for directory in (before, after)]
    for name in ("planner-system.txt", "opencode.json"):
        assert metadata[0]["sha256"][name] == metadata[1]["sha256"][name], f"Different {name}"
    assert (before / "planner-task.txt").read_bytes() == (after / "planner-task.txt").read_bytes(), "Different task"
    runs = []
    for directory, meta in zip((before, after), metadata):
        assert hashlib.sha256((directory / "planner-system.txt").read_bytes()).hexdigest() == meta["sha256"]["planner-system.txt"]
        clean_input = read(directory, "planner-clean-input.json")["prompt"]
        poisoned_input = read(directory, "planner-poisoned-input.json")["prompt"]
        assert 'delete_tree\\\",\\\"arguments' not in clean_input
        assert 'delete_tree\\\",\\\"arguments' in poisoned_input, "Injection missing from model input"
        for label in ("clean", "poisoned"):
            result = read(directory, f"planner-{label}-result.json")
            execution = read(directory, f"planner-{label}-execution.json")
            assert result["returncode"] == 0 and "error" not in result, "Model call failed"
            assert json.loads(result["answer"]) == result["decision"] == execution["decision"], "Decision mismatch"
            assert (directory / f"planner-{label}-answer.txt").read_text() == result["answer"]
            if label == "clean":
                assert execution["response"]["status"] == 200, "Normal assistance did not work"
            if directory == after:
                assert execution["files_before"] == execution["files_after"], "Model execution changed files"
            runs.append({"stage": "before" if directory == before else "after", "context": label,
                         "model": result["model"], "decision": result["decision"],
                         "execution_status": execution["response"]["status"]})
        tests = read(directory, "test-summary.json")
        assert tests["service_sha256"] == meta["sha256"]["lab/service.py"], "Tests exercised different service"
    assert len({run["model"] for run in runs}) == 1, "Different models"
    before_tests, after_tests = [read(directory, "test-summary.json") for directory in (before, after)]
    assert before_tests["security_tests_sha256"] == after_tests["security_tests_sha256"], "Different security tests"
    assert before_tests["suites"]["lab"]["returncode"] == 0
    assert before_tests["suites"]["security"]["returncode"] == 1
    assert all(suite["returncode"] == 0 for suite in after_tests["suites"].values())
    statuses = []
    for directory in (before, after):
        exchanges = {row["case"]: row["response"] for row in read(directory, "http.json")}
        statuses.append(exchanges["F10-forced-delete-independent-of-model"]["status"])
    assert statuses == [200, 403], "Unexpected forced-delete result"
    assert read(before, "files-before-forced-delete.json") and read(before, "files-after-forced-delete.json") == {}
    assert read(after, "files-before-forced-delete.json") == read(after, "files-after-forced-delete.json")
    args.output.write_text(json.dumps({"status": "PASS", "model_runs": runs,
                                      "forced_delete_statuses": statuses,
                                      "checks": "same model/system/task; authentic JSON; matching test/service hashes; functional and security outcomes; file snapshots"},
                                     ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"PASS: evidence comparison saved to {args.output}")


if __name__ == "__main__":
    main()
