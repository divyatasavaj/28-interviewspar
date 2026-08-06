// STEP 6 — backend client that calls the Python classifier (ml/infer.py) via subprocess.
// Keeps the Node API thin; all ML stays in Python per rules.md.
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ML_DIR = join(__dirname, "..", "..", "ml"); // backend/ -> repo -> ml/

export function classifyAnswer({ answerText, responseLatency = 0, codeCorrect = 0 }) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ answer_text: answerText, response_latency: responseLatency, code_correct: codeCorrect });
    const child = execFile(
      "python3",
      ["infer.py"],
      { cwd: ML_DIR, timeout: 15000 },
      (err, stdout) => {
        if (err) {
          console.warn("classifier subprocess failed:", err.message);
          return resolve({ label: null, error: err.message });
        }
        try {
          const parsed = JSON.parse(stdout.trim().split("\n").pop());
          resolve(parsed);
        } catch (e) {
          resolve({ label: null, error: "bad classifier output" });
        }
      }
    );
    child.stdin?.write(payload);
    child.stdin?.end();
  });
}
