"""Run only the bundled loopback service in a disposable subprocess."""

import json
import os
from pathlib import Path
import signal
import subprocess
import sys
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, build_opener

ROOT = Path(__file__).resolve().parents[1]


class LocalShop:
    def __init__(self, service_dir=None):
        self.service_dir = Path(service_dir) if service_dir is not None else ROOT / "lab"

    def __enter__(self):
        self.process = subprocess.Popen(
            [sys.executable, "-u", "service.py", "--port", "0"],
            cwd=self.service_dir, env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        )
        line = self.process.stdout.readline().strip()
        if not line.startswith("Local exercise: http://127.0.0.1:"):
            self.process.terminate()
            _, error = self.process.communicate(timeout=5)
            raise RuntimeError(f"Local server failed: {line} {error}")
        self.base = line.removeprefix("Local exercise: ")
        self.files = Path(self.process.stdout.readline().strip().removeprefix("Disposable fixture files: "))
        self.opener = build_opener(ProxyHandler({}))
        return self

    def call(self, method, path, body=None, headers=None, raw=None):
        if not path.startswith("/") or path.startswith("//"):
            raise ValueError("Only relative routes of the owned loopback service are allowed")
        request_headers = {"Content-Type": "application/json", **(headers or {})}
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        request = Request(self.base + path, data=data, headers=request_headers, method=method)
        try:
            response = self.opener.open(request, timeout=5)
        except HTTPError as exc:
            response = exc
        with response:
            text = response.read().decode()
            try:
                result = json.loads(text)
            except json.JSONDecodeError:
                result = text
            return {"status": response.status, "headers": dict(response.headers), "body": result}

    def login(self, username="alice"):
        response = self.call("POST", "/login", {"username": username, "password": f"learn-{username}"})
        if response["status"] != 200:
            raise AssertionError(response)
        return {"X-Token": response["body"]["token"]}

    def snapshot(self):
        return {str(p.relative_to(self.files)): p.read_text() for p in sorted(self.files.rglob("*")) if p.is_file()}

    def __exit__(self, *args):
        self.process.send_signal(signal.SIGINT)
        try:
            self.process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.communicate()

