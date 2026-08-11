import json
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

TIMEOUT_MS = 8000


def _harness(language: str, user_code: str, test_cases: list[dict]) -> str:
    cases_json = json.dumps(test_cases)
    if language == "javascript":
        return "\n".join([
            user_code,
            "(function() {",
            "  const cases = " + cases_json + ";",
            "  for (const c of cases) {",
            "    let out;",
            "    try {",
            "      const args = JSON.parse(c.input);",
            "      out = solve(...(Array.isArray(args) ? args : [args]));",
            "    }",
            "    catch (e) { out = '<error ' + e.message + '>'; }",
            "    const exp = JSON.parse(c.expected);",
            "    const pass = JSON.stringify(out) === JSON.stringify(exp);",
            "    console.log(pass ? 'PASS' : 'FAIL ' + JSON.stringify(out) + ' expected ' + JSON.stringify(exp));",
            "  }",
            "})();",
        ])
    return "\n".join([
        user_code,
        "import json",
        "cases = " + cases_json,
        "for c in cases:",
        "    try:",
        "        args = json.loads(c['input'])",
        "        out = solve(*args) if isinstance(args, list) else solve(args)",
        "    except Exception as e:",
        "        out = '<error %s>' % e",
        "    exp = json.loads(c['expected'])",
        "    print('PASS' if out == exp else 'FAIL ' + str(out) + ' expected ' + str(exp))",
    ])


def run_code(language: str, code: str, test_cases: list[dict]) -> dict:
    ext = "mjs" if language == "javascript" else "py"
    tmp = Path(tempfile.gettempdir())
    file = tmp / f"isp_{uuid.uuid4().hex}.{ext}"
    file.write_text(_harness(language, code, test_cases), encoding="utf-8")

    cmd = ["node", str(file)] if language == "javascript" else [sys.executable, str(file)]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT_MS / 1000)
    except subprocess.TimeoutExpired:
        return {"error": "execution timed out", "results": [], "passed": 0, "total": len(test_cases)}
    finally:
        try:
            file.unlink()
        except OSError:
            pass

    if proc.returncode != 0:
        return {"error": (proc.stderr or proc.stdout or "execution failed").strip(),
                "results": [], "passed": 0, "total": len(test_cases)}

    lines = [l.strip() for l in proc.stdout.splitlines() if l.strip()]
    passed = sum(1 for l in lines if l.startswith("PASS"))
    return {"results": lines, "passed": passed, "total": len(test_cases)}