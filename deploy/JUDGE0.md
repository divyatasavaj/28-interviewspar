# Live coding runner

InterviewSpar sends JavaScript and Python submissions to a configured Judge0
instance. Run the service on a dedicated Linux host or isolated VM. Start with
the official [Judge0 CE release and deployment instructions](https://github.com/judge0/judge0/releases/tag/v1.13.1).

1. Configure the runner with distinct PostgreSQL and Redis passwords. Enable
   synchronous results and set an authentication token using `X-Auth-Token`.
   Keep execution networking disabled and restrict access to the runner to the
   application backend.
2. Set `JUDGE0_API_URL` in the backend environment to the Judge0 base URL and
   `JUDGE0_API_KEY` to the runner token. A runner on the same machine can use a
   loopback URL. Use the private service address or HTTPS for a remote runner.
3. Verify both language runners before testing with interview submissions. Run
   this from `backend` with the Python environment activated.

```sh
python - <<'PY'
from dotenv import load_dotenv
from app.safe_execution import execute_cases

load_dotenv()
cases = [{"args": [2, 3], "expected": 5}, {"args": [-2, 3], "expected": 1}]
solutions = {
    "python": "def solve(a, b): return a + b",
    "javascript": "function solve(a, b) { return a + b; }",
}
for language, code in solutions.items():
    result = execute_cases(code, language, cases)
    if result["status"] != "evaluated" or result["passed"] != len(cases):
        raise SystemExit(f"{language} grading failed. Check the configured Judge0 service.")
    print(f"{language}: {result['passed']}/{result['total']} passed")
PY
```

The editor displays expected and returned values for public samples and bounded
compile or runtime diagnostics when provided. Hidden cases remain server-side
and are reported as counts.
