"""Desired security contracts: these intentionally fail on the original service.

Run from practice_06: python3 -m unittest discover -s security -p 'test_*.py' -v
No expectedFailure markers: the same tests must turn green after remediation.
"""

import unittest
import http.client
import json
from urllib.parse import urlencode
from urllib.parse import urlsplit

from harness import LocalShop


class SecurityTest(unittest.TestCase):
    def setUp(self):
        manager = LocalShop()
        self.shop = manager.__enter__()
        self.addCleanup(manager.__exit__, None, None, None)
        self.alice = self.shop.login()

    def denied(self, response):
        self.assertIn(response["status"], (400, 401, 403, 404, 422), response)

    def test_private_profile_requires_auth(self):
        self.denied(self.shop.call("GET", "/profile?id=1"))

    def test_customer_cannot_read_other_profile(self):
        self.denied(self.shop.call("GET", "/profile?id=2", headers=self.alice))

    def test_search_does_not_disclose_other_customer(self):
        response = self.shop.call("GET", "/search?q=", headers=self.alice)
        self.assertNotIn("TEST_BOB", str(response["body"]))

    def test_orders_require_auth(self):
        self.denied(self.shop.call("GET", "/orders"))

    def test_customer_sees_only_own_orders(self):
        response = self.shop.call("GET", "/orders", headers=self.alice)
        self.assertEqual(response["status"], 200)
        self.assertTrue(all(order["owner"] == 1 for order in response["body"]), response)

    def test_profile_sql_injection_rejected(self):
        self.denied(self.shop.call("GET", "/profile?" + urlencode({"id": "1 OR 1=1"}), headers=self.alice))

    def test_search_sql_injection_no_foreign_profiles(self):
        response = self.shop.call("GET", "/search?" + urlencode({"q": "' OR 1=1 --"}), headers=self.alice)
        self.assertNotIn("TEST_BOB", str(response["body"]))

    def test_context_sql_injection_rejected(self):
        self.denied(self.shop.call("GET", "/assistant/context?" + urlencode({"order_id": "1 OR 1=1"}), headers=self.alice))

    def test_role_header_is_not_authorization(self):
        self.denied(self.shop.call("GET", "/admin/export", headers={"X-Role": "staff"}))

    def test_customer_cannot_forge_staff(self):
        self.denied(self.shop.call("GET", "/admin/export", headers={**self.alice, "X-Role": "staff"}))

    def test_server_controls_price(self):
        response = self.shop.call("POST", "/orders", {"product": "chair", "price": -100}, self.alice)
        self.assertTrue(response["status"] in (400, 422) or
                        (response["status"] == 201 and response["body"]["price"] == 5000), response)

    def test_receipt_requires_auth(self):
        self.denied(self.shop.call("GET", "/files?user=alice&path=receipt.txt"))

    def test_customer_cannot_read_foreign_receipt(self):
        self.denied(self.shop.call("GET", "/files?user=bob&path=receipt.txt", headers=self.alice))

    def test_traversal_to_private_note_denied(self):
        self.denied(self.shop.call("GET", "/files?" + urlencode({"user": "alice", "path": "../../private/operator-note.txt"}), headers=self.alice))

    def test_review_html_is_escaped(self):
        payload = '<script>document.title="SHOP_XSS_PROBE"</script>'
        self.shop.call("POST", "/reviews", {"product": "chair", "text": payload}, self.alice)
        response = self.shop.call("GET", "/reviews/view")
        self.assertNotIn(payload, response["body"])

    def test_logs_not_public(self):
        self.denied(self.shop.call("GET", "/debug/logs"))

    def test_logs_do_not_include_passwords_or_tokens(self):
        auth = self.shop.login("staff")
        response = self.shop.call("GET", "/debug/logs", headers=auth)
        self.assertNotIn("learn-alice", str(response["body"]))
        self.assertNotIn(self.alice["X-Token"], str(response["body"]))

    def test_context_requires_auth(self):
        self.denied(self.shop.call("GET", "/assistant/context?order_id=1"))

    def test_context_checks_order_owner(self):
        self.denied(self.shop.call("GET", "/assistant/context?order_id=2", headers=self.alice))

    def test_execute_requires_auth(self):
        self.denied(self.shop.call("POST", "/assistant/execute", {"decision": {"tool": "export_profiles", "arguments": {}}}))

    def test_execute_cannot_read_foreign_receipt(self):
        self.denied(self.shop.call("POST", "/assistant/execute", {"decision": {"tool": "read_file", "arguments": {"path": "files/bob/receipt.txt"}}}, self.alice))

    def test_execute_cannot_read_private_note(self):
        self.denied(self.shop.call("POST", "/assistant/execute", {"decision": {"tool": "read_file", "arguments": {"path": "private/operator-note.txt"}}}, self.alice))

    def test_execute_cannot_export_profiles(self):
        self.denied(self.shop.call("POST", "/assistant/execute", {"decision": {"tool": "export_profiles", "arguments": {}}}, self.alice))

    def test_execute_cannot_delete_fixture_root(self):
        before = self.shop.snapshot()
        response = self.shop.call("POST", "/assistant/execute", {"decision": {"tool": "delete_tree", "arguments": {"path": "."}}}, self.alice)
        self.assertEqual(self.shop.snapshot(), before, response)
        self.denied(response)

    def test_malformed_json_is_client_error(self):
        response = self.shop.call("POST", "/login", raw=b"{")
        self.assertIn(response["status"], (400, 422), response)

    def test_wrong_json_shape_is_client_error(self):
        response = self.shop.call("POST", "/orders", [], self.alice)
        self.assertIn(response["status"], (400, 422), response)

    def test_errors_do_not_leak_exception_or_path(self):
        response = self.shop.call("GET", "/files?path=missing", headers=self.alice)
        self.assertNotIn(str(self.shop.files), str(response["body"]))
        self.assertNotIn("FileNotFoundError", str(response["body"]))

    def test_review_length_is_bounded(self):
        response = self.shop.call("POST", "/reviews", {"product": "chair", "text": "x" * 16000}, self.alice)
        self.assertIn(response["status"], (400, 413, 422), response)

    def test_content_type_is_validated(self):
        response = self.shop.call("POST", "/reviews", {"product": "chair", "text": "probe"}, {**self.alice, "Content-Type": "text/plain"})
        self.assertIn(response["status"], (400, 415), response)

    def test_content_type_requires_exact_media_type(self):
        for media_type in ("application/jsonp", "application/json-evil"):
            with self.subTest(media_type=media_type):
                response = self.shop.call("POST", "/reviews", {"product": "chair", "text": "probe"},
                                          {**self.alice, "Content-Type": media_type})
                self.assertEqual(response["status"], 415, response)
        response = self.shop.call("POST", "/reviews", {"product": "chair", "text": "valid"},
                                  {**self.alice, "Content-Type": "Application/JSON; charset=utf-8"})
        self.assertEqual(response["status"], 201, response)

    def test_lowercase_token_is_not_logged(self):
        address = urlsplit(self.shop.base)
        connection = http.client.HTTPConnection(address.hostname, address.port, timeout=5)
        self.addCleanup(connection.close)
        connection.request("GET", "/profile?id=1", headers={"x-token": self.alice["X-Token"]})
        response = connection.getresponse()
        self.assertEqual(response.status, 200)
        response.read()
        logs = self.shop.call("GET", "/debug/logs", headers=self.shop.login("staff"))
        self.assertEqual(logs["status"], 200)
        self.assertNotIn(self.alice["X-Token"], json.dumps(logs["body"]))

    def test_logs_exclude_nested_secrets_and_query_strings(self):
        secret = "SYNTHETIC_NESTED_SECRET"
        self.shop.call("POST", "/reviews?password=" + secret,
                       {"product": "chair", "text": "valid", "extra": {"password": secret}}, self.alice)
        logs = self.shop.call("GET", "/debug/logs", headers=self.shop.login("staff"))
        self.assertEqual(logs["status"], 200)
        self.assertNotIn(secret, json.dumps(logs["body"]))

    def test_logs_have_bounded_retention(self):
        for _ in range(140):
            self.shop.call("GET", "/health")
        logs = self.shop.call("GET", "/debug/logs", headers=self.shop.login("staff"))
        self.assertEqual(logs["status"], 200)
        self.assertLessEqual(len(logs["body"]), 128)

    def test_reviews_require_valid_fields(self):
        for body in ({}, {"product": "chair"}, {"text": "valid"},
                     {"product": "chair", "text": "   "}, {"product": [], "text": "valid"},
                     {"product": "unknown", "text": "valid"}, {"product": "chair", "text": 12}):
            with self.subTest(body=body):
                response = self.shop.call("POST", "/reviews", body, self.alice)
                self.assertEqual(response["status"], 400, response)
        self.assertNotIn("<p>", self.shop.call("GET", "/reviews/view")["body"])

    def test_decision_requires_valid_schema(self):
        for decision in (None, [], {}, {"tool": []}, {"tool": "read_file", "arguments": []}):
            with self.subTest(decision=decision):
                response = self.shop.call("POST", "/assistant/execute", {"decision": decision}, self.alice)
                self.assertEqual(response["status"], 400, response)
                self.assertNotIn("TypeError", str(response["body"]))

    def test_review_count_is_bounded(self):
        for _ in range(32):
            self.assertEqual(self.shop.call("POST", "/reviews", {"product": "chair", "text": "ok"}, self.alice)["status"], 201)
        response = self.shop.call("POST", "/reviews", {"product": "chair", "text": "overflow"}, self.alice)
        self.assertEqual(response["status"], 429, response)
        self.assertNotIn("overflow", self.shop.call("GET", "/reviews/view")["body"])

    def test_review_total_storage_is_bounded(self):
        for _ in range(8):
            self.assertEqual(self.shop.call("POST", "/reviews", {"product": "chair", "text": "x" * 8192}, self.alice)["status"], 201)
        response = self.shop.call("POST", "/reviews", {"product": "chair", "text": "overflow"}, self.alice)
        self.assertEqual(response["status"], 413, response)
        self.assertNotIn("overflow", self.shop.call("GET", "/reviews/view")["body"])

    def test_context_is_bounded_with_escaped_review_text(self):
        for index in range(16):
            response = self.shop.call("POST", "/reviews", {"product": "chair", "text": "\n" * 4095 + str(index % 10)}, self.alice)
            self.assertEqual(response["status"], 201, response)
        context = self.shop.call("GET", "/assistant/context?order_id=1", headers=self.alice)
        self.assertEqual(context["status"], 200, context)
        self.assertLess(len(context["body"]["prompt"]), 20000)
        response = self.shop.call("GET", "/assistant/context?" + urlencode({"order_id": 1, "question": "x" * 2049}), headers=self.alice)
        self.assertEqual(response["status"], 414, response)

    def test_context_includes_only_order_product_reviews(self):
        for product, text in (("lamp", "LAMP_ONLY_MARKER"), ("chair", "CHAIR_ONLY_MARKER")):
            self.assertEqual(self.shop.call("POST", "/reviews", {"product": product, "text": text}, self.alice)["status"], 201)
        context = self.shop.call("GET", "/assistant/context?order_id=1", headers=self.alice)
        self.assertIn("CHAIR_ONLY_MARKER", context["body"]["prompt"])
        self.assertNotIn("LAMP_ONLY_MARKER", context["body"]["prompt"])


if __name__ == "__main__":
    unittest.main()
