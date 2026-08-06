import { Router } from "express";
import { getSession, updateSession } from "../services/sessions.js";

const router = Router();

// STEP 3 — resume upload + extraction. PDF parsed locally (no API, no upload off-box).
// The client sends the raw PDF bytes as the request body with Content-Type: application/pdf
// and the session id as a query param (?sessionId=...).
// POST /api/resume/upload?sessionId=xxx   body: <raw pdf bytes>
router.post("/upload", async (req, res) => {
  const sessionId = req.query && req.query.sessionId;
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", async () => {
    try {
      const buf = Buffer.concat(chunks);
      if (buf.slice(0, 5).toString() !== "%PDF-") {
        return res.status(400).json({ error: "not a PDF (or malformed file)" });
      }
      const session = sessionId ? getSession(sessionId) : null;

      // Primary: pdf-parse (pdf.js). Falls back to a lenient regex extractor if the
      // strict xref parser chokes on a malformed/oddly-exported PDF (rules.md §3).
      let text = null;
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const result = await pdfParse(buf);
        text = (result.text || "").replace(/\s+/g, " ").trim();
      } catch (e) {
        console.warn("pdf-parse failed, using lenient fallback:", e.message);
        text = extractTextLenient(buf);
      }

      if (!text || text.length < 20) {
        // scanned/empty PDF — degrade gracefully (rules.md §3)
        return res.status(422).json({
          error: "couldn't read resume text — scanned or empty PDF. Please retype key points.",
        });
      }
      text = text.slice(0, 6000);

      const summary = buildSummary(text);
      if (session) updateSession(sessionId, { resumeText: text });
      res.json({ ok: true, resumeText: text, summary, source: "lenient-fallback" });
    } catch (err) {
      console.error("resume parse failed", err);
      res.status(500).json({ error: "resume parsing failed", detail: err.message });
    }
  });
});

// Lenient fallback: pull parenthesized strings out of PDF content streams.
// Works for normal text-based resumes when the strict xref parser fails.
function extractTextLenient(buf) {
  const s = buf.toString("latin1");
  const re = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
  const out = [];
  let m;
  while ((m = re.exec(s))) out.push(m[1].replace(/\\(.)/g, "$1"));
  return out.join(" ").replace(/\s+/g, " ").trim();
}

// Lightweight structured summary (no ML): pull likely email/skills lines.
function buildSummary(text) {
  const email = (text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0] || null;
  const lines = text.split(/(?<=[.!?])\s+|(?:\n|•|\||-)\s*/).map((l) => l.trim()).filter(Boolean);
  const skillsHit = lines.find((l) => /skills|technologies|tech stack/i.test(l)) || null;
  return {
    email,
    approxLength: text.length,
    skillsLine: skillsHit,
    note: "Resume text injected into the interviewer system prompt for personalized follow-ups.",
  };
}

export default router;
