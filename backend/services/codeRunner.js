// STEP 4 — local sandboxed code runner. Runs user code against the problem's test cases
// with a hard timeout. Supports JavaScript (node) and Python (python3).
// NOTE: for production use Judge0's free API or a Docker sandbox (architecture.md §4).
// This local runner is acceptable for local MVP dev only.
import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const TIMEOUT_MS = 5000;

function harness(language, userCode, testCases) {
  const casesJson = JSON.stringify(testCases);
  if (language === "javascript") {
    return [
      userCode,
      "(function() {",
      "  const cases = " + casesJson + ";",
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
    ].join("\n");
  }
  // python
  return [
    userCode,
    "import json",
    "cases = " + casesJson,
    "for c in cases:",
    "    try:",
    "        args = json.loads(c['input'])",
    "        out = solve(*args) if isinstance(args, list) else solve(args)",
    "    except Exception as e:",
    "        out = '<error %s>' % e",
    "    exp = json.loads(c['expected'])",
    "    print('PASS' if out == exp else 'FAIL ' + str(out) + ' expected ' + str(exp))",
  ].join("\n");
}

function runWithTimeout(file, lang) {
  return new Promise((resolve) => {
    const cmd = lang === "javascript" ? "node" : "python3";
    const child = execFile(cmd, [file], { timeout: TIMEOUT_MS }, (err, stdout, stderr) => {
      if (err && err.killed) return resolve({ error: "execution timed out" });
      if (err) return resolve({ error: stderr || err.message });
      resolve({ output: stdout });
    });
    child.on("error", (e) => resolve({ error: `could not run ${cmd}: ${e.message}` }));
  });
}

export async function runCode({ language, code, testCases }) {
  const ext = language === "javascript" ? "mjs" : "py";
  const file = join(tmpdir(), `isp_${randomUUID()}.${ext}`);
  await writeFile(file, harness(language, code, testCases), "utf8");
  const { output, error } = await runWithTimeout(file, language);
  if (error) return { error };
  const lines = output.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const passed = lines.filter((l) => l.startsWith("PASS")).length;
  return { results: lines, passed, total: testCases.length };
}
