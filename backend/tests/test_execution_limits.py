"""Exercise execution-provider failures and streamed upload limits without network I/O."""

import base64
import io
import json
import os
import unittest
from unittest.mock import patch

from app.body_limit import BodyLimitMiddleware
from app.safe_execution import execute_cases


class ExecutionTests(unittest.TestCase):
    def test_runner_diagnostics_are_opt_in_and_bounded(self):
        payload = {
            "status": {"id": 6, "description": "Compilation Error"},
            "compile_output": base64.b64encode(b"Syntax error " + b"x" * 1500).decode(),
        }
        with patch.dict(os.environ, {"JUDGE0_API_URL": "https://judge.example.test"}), patch(
            "app.safe_execution.urlopen",
            side_effect=lambda *args, **kwargs: io.BytesIO(json.dumps(payload).encode()),
        ):
            args = ("invalid", "python", [{"args": [], "expected": None}])
            public = execute_cases(*args, include_diagnostics=True)["results"][0]
            private = execute_cases(*args)["results"][0]
        self.assertTrue(public["diagnostic"].startswith("Syntax error"))
        self.assertEqual(len(public["diagnostic"]), 1200)
        self.assertFalse(public["has_return_value"])
        self.assertNotIn("diagnostic", private)

    def test_nonfinite_and_deep_outputs_cannot_break_the_api_response(self):
        for output in (
            "NaN",
            "Infinity",
            "1e999",
            "[1, NaN]",
            "[" * 1100 + "0" + "]" * 1100,
        ):
            with self.subTest(output=output[:30]):
                result = self.execute(output)
                self.assertEqual(result["status"], "evaluated")
                self.assertEqual(result["passed"], 0)
                json.dumps(result, allow_nan=False)

    def test_malformed_provider_status_fails_closed(self):
        for payload in ({"status": 3}, {"status": []}, {"status": {"id": 3.0}}, []):
            with patch.dict(
                os.environ, {"JUDGE0_API_URL": "https://judge.example.test"}
            ), patch(
                "app.safe_execution.urlopen",
                return_value=io.BytesIO(json.dumps(payload).encode()),
            ):
                result = execute_cases(
                    "pass", "python", [{"args": [], "expected": None}]
                )
                self.assertEqual(result["status"], "unavailable")

    def execute(self, output, status=3, expected=None, unordered_pair=False):
        payload = {
            "status": {"id": status, "description": "Synthetic status"},
            "stdout": base64.b64encode(output.encode()).decode(),
        }
        with patch.dict(
            os.environ, {"JUDGE0_API_URL": "https://judge.example.test"}
        ), patch(
            "app.safe_execution.urlopen",
            return_value=io.BytesIO(json.dumps(payload).encode()),
        ) as provider:
            result = execute_cases(
                "def solve(): return None",
                "python",
                [{"args": [], "expected": expected, "unordered_pair": unordered_pair}],
            )
            request = json.loads(provider.call_args.args[0].data)
            self.assertFalse(request["enable_network"])
            self.assertNotIn("expected_output", request)
            return result

    def test_invalid_stdout_is_a_failed_test_not_an_outage(self):
        result = self.execute("not JSON")
        self.assertEqual(result["status"], "evaluated")
        self.assertEqual(result["passed"], 0)

    def test_empty_output_does_not_pass_null_expectation(self):
        self.assertEqual(self.execute("")["passed"], 0)
        self.assertEqual(self.execute("null")["passed"], 1)

    def test_booleans_do_not_equal_integers_in_nested_outputs(self):
        self.assertEqual(self.execute("[true]", expected=[1])["passed"], 0)
        self.assertEqual(self.execute("[1]", expected=[1])["passed"], 1)

    def test_runtime_error_is_failed_but_pending_provider_is_unavailable(self):
        self.assertEqual(self.execute("", status=11)["status"], "evaluated")
        self.assertEqual(self.execute("", status=2)["status"], "unavailable")

    def test_two_sum_allows_either_order_without_weakening_ordered_problems(self):
        self.assertEqual(
            self.execute("[1,0]", expected=[0, 1], unordered_pair=True)["passed"], 1
        )
        self.assertEqual(self.execute("[1,0]", expected=[0, 1])["passed"], 0)


class BodyLimitTests(unittest.IsolatedAsyncioTestCase):
    async def call(self, chunks, limit):
        events = []
        observed = []

        async def app(scope, receive, send):
            observed.append(await receive())

        messages = iter(
            {"type": "http.request", "body": chunk, "more_body": i < len(chunks) - 1}
            for i, chunk in enumerate(chunks)
        )

        async def receive():
            return next(messages)

        async def send(event):
            events.append(event)

        await BodyLimitMiddleware(app, max_bytes=limit)(
            {"type": "http", "method": "POST"}, receive, send
        )
        return observed, events

    async def test_chunked_body_over_limit_never_reaches_parser(self):
        observed, events = await self.call([b"1234", b"5678"], 6)
        self.assertEqual(observed, [])
        self.assertEqual(events[0]["status"], 413)

    async def test_body_at_limit_is_replayed_once(self):
        observed, events = await self.call([b"123", b"456"], 6)
        self.assertEqual(
            observed, [{"type": "http.request", "body": b"123456", "more_body": False}]
        )
        self.assertEqual(events, [])
