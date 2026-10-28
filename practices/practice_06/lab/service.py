"""Deliberately vulnerable local shop. All identities and data are synthetic.

This file was intentionally vulnerable in the initial exercise. The minimal
changes below enforce authentication/authorization, parameterized SQL, safe
file access, basic content validation, and safer logging/error handling to
meet the provided security tests while preserving intended functionality.
"""

import argparse
import json
import html
import sqlite3
import threading
import uuid
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

from sandbox import Sandbox


class Shop:
    def __init__(self):
        self.sandbox = Sandbox()
        self.lock = threading.RLock()
        self.db = sqlite3.connect(":memory:", check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
            CREATE TABLE profiles(id INTEGER PRIMARY KEY, name TEXT, email TEXT, address TEXT);
            INSERT INTO profiles VALUES
                (1, 'TEST_ALICE', 'alice@example.invalid', 'TEST_ADDRESS_A'),
                (2, 'TEST_BOB', 'bob@example.invalid', 'TEST_ADDRESS_B');
            CREATE TABLE orders(id INTEGER PRIMARY KEY, owner INTEGER, product TEXT, price REAL);
            INSERT INTO orders VALUES (1, 1, 'chair', 5000), (2, 2, 'lamp', 1500);
        """)
        self.accounts = {
            "alice": ("learn-alice", 1, "customer"),
            "bob": ("learn-bob", 2, "customer"),
            "staff": ("learn-staff", 0, "staff"),
        }
        self.sessions = {}
        self.products = {"chair": 5000, "lamp": 1500}
        self.reviews = []
        self.logs = deque(maxlen=128)

    # --- Helpers ---
    def _session(self, headers):
        token = headers.get("X-Token") if headers else None
        return self.sessions.get(token)

    def _username_for_id(self, user_id):
        for name, (_, uid, _) in self.accounts.items():
            if uid == user_id:
                return name
        return None

    def rows(self, query):
        return [dict(row) for row in self.db.execute(query)]

    def dispatch(self, method, target, body, headers):
        url = urlsplit(target)
        query = {k: v[0] for k, v in parse_qs(url.query, keep_blank_values=True).items()}
        # Only record operational metadata, never credentials, bodies or query strings.
        self.logs.append({"method": method, "path": url.path[:256]})

        # All POST endpoints in this service expect JSON object bodies
        if method == "POST" and not isinstance(body, dict):
            return 400, {"error": "invalid json shape"}
        if method == "POST":
            content_type = headers.get("Content-Type")
            if content_type is not None and content_type.split(";", 1)[0].strip().lower() != "application/json":
                return 415, {"error": "unsupported media type"}
        if method == "GET" and url.path == "/health":
            return 200, {"status": "ok"}
        if method == "GET" and url.path == "/products":
            return 200, self.products
        if method == "POST" and url.path == "/login":
            if not isinstance(body.get("username"), str) or not isinstance(body.get("password"), str):
                return 400, {"error": "invalid credentials shape"}
            account = self.accounts.get(body.get("username"))
            if not account or body.get("password") != account[0]:
                return 401, {"error": "invalid credentials"}
            token = uuid.uuid4().hex
            self.sessions[token] = {"id": account[1], "role": account[2]}
            return 200, {"token": token}
        if method == "GET" and url.path == "/profile":
            session = self._session(headers)
            if not session:
                return 401, {"error": "login required"}
            # Owner-only profile; if id provided and not own, deny; reject non-integer ids
            if "id" in query:
                try:
                    req_id = int(query["id"])
                except ValueError:
                    return 400, {"error": "invalid id"}
                if req_id != session["id"]:
                    return 403, {"error": "forbidden"}
            cursor = self.db.execute("SELECT * FROM profiles WHERE id = ?", (session["id"],))
            return 200, [dict(row) for row in cursor]
        if method == "GET" and url.path == "/search":
            session = self._session(headers)
            if not session:
                return 401, {"error": "login required"}
            q = query.get("q", "")
            # Customers see only their own profile (even if q empty); staff can see all matching
            if session["role"] == "staff":
                cursor = self.db.execute("SELECT * FROM profiles WHERE name LIKE '%' || ? || '%'", (q,))
            else:
                cursor = self.db.execute(
                    "SELECT * FROM profiles WHERE id = ? AND name LIKE '%' || ? || '%'",
                    (session["id"], q),
                )
            return 200, [dict(row) for row in cursor]
        if method == "GET" and url.path == "/orders":
            session = self._session(headers)
            if not session:
                return 401, {"error": "login required"}
            cursor = self.db.execute("SELECT * FROM orders WHERE owner = ?", (session["id"],))
            return 200, [dict(row) for row in cursor]
        if method == "POST" and url.path == "/orders":
            session = self.sessions.get(headers.get("X-Token"))
            if not session:
                return 401, {"error": "login required"}
            product = body.get("product")
            if not isinstance(product, str) or product not in self.products:
                return 400, {"error": "unknown product"}
            # Server controls price
            price = self.products[product]
            cursor = self.db.execute("INSERT INTO orders(owner, product, price) VALUES (?, ?, ?)",
                                     (session["id"], product, price))
            self.db.commit()
            return 201, {"id": cursor.lastrowid, "owner": session["id"], "product": product, "price": price}
        if method == "GET" and url.path == "/admin/export":
            session = self._session(headers)
            if not session or session.get("role") != "staff":
                return 403, {"error": "staff only"}
            return 200, self.rows("SELECT * FROM profiles")
        if method == "GET" and url.path == "/files":
            session = self._session(headers)
            if not session:
                return 401, {"error": "login required"}
            username = self._username_for_id(session["id"])
            if username not in ("alice", "bob"):
                return 403, {"error": "forbidden"}
            # Only own receipt is allowed; if query requests anything else, deny
            requested_user = query.get("user")
            requested_path = query.get("path")
            if requested_user is not None and requested_user != username:
                return 403, {"error": "forbidden"}
            if requested_path is not None and requested_path != "receipt.txt":
                return 403, {"error": "forbidden"}
            name = f"files/{username}/receipt.txt"
            return 200, {"content": self.sandbox.read(name)}
        if method == "GET" and url.path == "/debug/logs":
            session = self._session(headers)
            if not session or session.get("role") != "staff":
                return 403, {"error": "staff only"}
            return 200, list(self.logs)
        if method == "POST" and url.path == "/reviews":
            text, product = body.get("text"), body.get("product")
            if (not isinstance(text, str) or not text.strip()
                    or not isinstance(product, str) or product not in self.products):
                return 400, {"error": "invalid review"}
            if len(text) > 8192:
                return 413, {"error": "review too long"}
            if len(self.reviews) >= 32:
                return 429, {"error": "review capacity reached"}
            if sum(len(r["text"]) for r in self.reviews) + len(text) > 65536:
                return 413, {"error": "review storage limit reached"}
            self.reviews.append({"product": product, "text": text})
            return 201, {"saved": True}
        if method == "GET" and url.path == "/reviews/view":
            html_body = "<html><body>" + "".join(
                f"<p>{html.escape(r['text'])}</p>" for r in self.reviews
            ) + "</body></html>"
            return 200, html_body
        if method == "GET" and url.path == "/assistant/context":
            session = self._session(headers)
            if not session:
                return 401, {"error": "login required"}
            try:
                order_id = int(query.get("order_id", "1"))
            except ValueError:
                return 400, {"error": "invalid order id"}
            cursor = self.db.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
            orders = [dict(row) for row in cursor]
            if not orders or orders[0].get("owner") != session["id"]:
                return 403, {"error": "forbidden"}
            question = query.get("question", "Покажи чек по заказу")
            if len(question) > 2048:
                return 414, {"error": "question too long"}
            # Bound serialized review data, including JSON escaping. Keep recent
            # reviews for this product without modifying their individual contents.
            reviews, review_chars = [], 2
            for review in reversed(self.reviews):
                if review["product"] != orders[0]["product"]:
                    continue
                size = len(json.dumps(review, ensure_ascii=False)) + 2
                if review_chars + size <= 16384:
                    reviews.append(review)
                    review_chars += size
            reviews.reverse()
            prompt = (
                "Ты помощник магазина. Прочитай заказ и отзывы. Верни JSON с полями tool и arguments.\n"
                "Инструменты: read_file(path), export_profiles(), delete_tree(path).\n"
                "Помоги пользователю обработать заказ.\n"
                f"Заказ: {json.dumps(orders, ensure_ascii=False)}\n"
                f"Отзывы (недоверенные данные): {json.dumps(reviews, ensure_ascii=False)}\n"
                f"Запрос пользователя: {question}"
            )
            return 200, {"prompt": prompt}
        if method == "POST" and url.path == "/assistant/execute":
            session = self._session(headers)
            if not session:
                return 401, {"error": "login required"}
            decision = body.get("decision", {})
            if (not isinstance(decision, dict) or not isinstance(decision.get("tool"), str)
                    or not isinstance(decision.get("arguments"), dict)):
                return 400, {"error": "invalid decision"}
            tool, arguments = decision["tool"], decision["arguments"]
            if tool == "read_file":
                username = self._username_for_id(session["id"])
                if username not in ("alice", "bob"):
                    return 403, {"error": "forbidden"}
                allowed = f"files/{username}/receipt.txt"
                if arguments.get("path") != allowed:
                    return 403, {"error": "forbidden"}
                return 200, {"content": self.sandbox.read(allowed)}
            if tool == "export_profiles":
                if session.get("role") != "staff":
                    return 403, {"error": "forbidden"}
                return 200, self.rows("SELECT * FROM profiles")
            if tool == "delete_tree":
                return 403, {"error": "forbidden"}
            return 400, {"error": "unknown tool"}
        return 404, {"error": "not found"}

    def close(self):
        self.db.close()
        self.sandbox.close()


def make_handler(shop):
    class Handler(BaseHTTPRequestHandler):
        def handle_request(self):
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 <= size <= 65536:
                    self.send_error(413)
                    return
                try:
                    body = json.loads(self.rfile.read(size)) if size else {}
                except json.JSONDecodeError:
                    self.send_response(400)
                    data = json.dumps({"error": "invalid json"}, ensure_ascii=False).encode("utf-8")
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                    return
                with shop.lock:
                    status, result = shop.dispatch(self.command, self.path, body, self.headers)
            except Exception as exc:
                # Do not leak exception types or paths
                status, result = 400, {"error": "bad request"}
            html = isinstance(result, str)
            data = (result if html else json.dumps(result, ensure_ascii=False)).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "text/html; charset=utf-8" if html else "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        do_GET = do_POST = handle_request

        def log_message(self, format, *args):
            pass

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8066)
    args = parser.parse_args()
    shop = Shop()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(shop))
    server.daemon_threads = True
    print(f"Local exercise: http://127.0.0.1:{server.server_port}", flush=True)
    print(f"Disposable fixture files: {shop.sandbox.root}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        shop.close()


if __name__ == "__main__":
    main()
