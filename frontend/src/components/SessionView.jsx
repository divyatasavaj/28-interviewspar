import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { io } from "socket.io-client";
import {
  submitCalibration, sendInterviewMessage, uploadResume, getProblems, runCode,
  logIntegrity, checkSimilarity, endSession,
} from "../api";
import IntegrityMonitor from "./IntegrityMonitor.jsx";
import FaceDetection from "./FaceDetection.jsx";
import VoicePanel from "./VoicePanel.jsx";
import { useWebcam } from "../hooks/useWebcam.js";
import { useSpeech } from "../hooks/useSpeech.js";

// STEP 9/UI — browser Text-to-Speech for the AI interviewer (no API key, Chrome only).
function speakAi(text, onStart, onEnd) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1; u.pitch = 1;
  u.onstart = onStart; u.onend = onEnd; u.onerror = onEnd;
  window.speechSynthesis.speak(u);
}
function stopSpeak() {
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
}

export default function SessionView({ session }) {
  if (!session) {
    return (
      <div className="mx-auto max-w-md p-6 text-ink-muted">
        No active session. Go to <b>Home</b> to start one.
      </div>
    );
  }
  return <Interview session={session} />;
}

// Owns the full session: calibration questions first, then the adaptive interview.
// Both phases can run in the 🎥 Live Room (AI speaks the question, you answer by voice).
function Interview({ session }) {
  const [phase, setPhase] = useState("calibration"); // calibration | interview
  const [calIdx, setCalIdx] = useState(0);
  const [calText, setCalText] = useState("");
  const [calDone, setCalDone] = useState(0);

  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState(null);
  const [showResume, setShowResume] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [roomMode, setRoomMode] = useState(false);
  const scrollRef = useRef(null);

  const webcam = useWebcam();
  const speech = useSpeech();
  const [aiSpeaking, setAiSpeaking] = useState(false);

  const questions = session.calibrationQuestions || [];

  // Seed the first adaptive interview question once calibration completes.
  useEffect(() => {
    if (phase !== "interview" || history.length > 0) return;
    (async () => {
      setBusy(true);
      try {
        const h = [{ role: "user", content: "I have completed the calibration questions. Please begin the main interview." }];
        const res = await sendInterviewMessage({ sessionId: session.sessionId, history: h });
        setProvider(res.provider);
        setHistory([...h, { role: "assistant", content: res.reply }]);
      } catch (e) {
        setHistory([{ role: "assistant", content: `Error: ${e.message}` }]);
      } finally {
        setBusy(false);
      }
    })();
  }, [phase, session.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, busy, calIdx, calText]);

  // In the Live Room, the AI SPEAKS the current question (calibration or interview).
  useEffect(() => {
    if (!roomMode) return;
    const text = phase === "calibration"
      ? questions[calIdx]
      : [...history].reverse().find((m) => m.role === "assistant")?.content;
    if (text && !String(text).startsWith("Error:")) {
      speakAi(text, () => setAiSpeaking(true), () => setAiSpeaking(false));
    }
  }, [roomMode, phase, calIdx, history]);

  // When the mic stops in the Live Room, auto-send the spoken answer (calibration or interview).
  useEffect(() => {
    if (!roomMode || speech.listening) return;
    const t = speech.transcript.trim();
    if (t) {
      speech.setTranscript("");
      if (phase === "calibration") submitCal(t);
      else send(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.listening, roomMode, phase]);

  async function submitCal(textOverride) {
    const value = (textOverride ?? calText).trim();
    if (!value) return;
    await submitCalibration({
      sessionId: session.sessionId,
      question: questions[calIdx],
      answer: value,
    });
    const next = calIdx + 1;
    setCalDone(next);
    setCalText("");
    if (next >= questions.length) setPhase("interview");
    else setCalIdx(next);
  }

  async function send(textOverride) {
    const value = (textOverride ?? input).trim();
    if (!value || busy) return;
    const next = [...history, { role: "user", content: value }];
    setHistory(next); setInput(""); setBusy(true);
    try {
      const res = await sendInterviewMessage({ sessionId: session.sessionId, history: next });
      setProvider(res.provider);
      setHistory([...next, { role: "assistant", content: res.reply, tag: res.mistakeTag }]);
    } catch (e) {
      setHistory([...next, { role: "assistant", content: `Error: ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  }

  function toggleRoom() {
    const next = !roomMode;
    setRoomMode(next);
    if (next) webcam.start();
    else { webcam.stop(); stopSpeak(); setAiSpeaking(false); speech.stop(); }
  }

  const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
  const lastTag = lastAssistant?.tag;
  const currentQuestion = phase === "calibration"
    ? (questions[calIdx] || "")
    : (lastAssistant?.content || (busy ? "Interviewer is preparing your next question…" : "…"));

  if (roomMode) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={toggleRoom} className="rounded-full bg-brand-green px-3 py-1 text-xs font-semibold text-white">
            Exit Live Room
          </button>
          <IntegrityMonitor sessionId={session.sessionId} active={true} />
          {!speech.supported && (
            <span className="text-xs text-score-warn">Voice needs Chrome (Web Speech API)</span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="relative overflow-hidden rounded-card border border-white/10 bg-black aspect-video">
            <video ref={webcam.videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            <FaceDetection videoRef={webcam.videoRef} sessionId={session.sessionId} active={webcam.on} />
            <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
              {webcam.on ? "● You" : webcam.error ? "Camera blocked" : "Camera off"}
            </span>
          </div>
          <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-card border border-white/10 bg-white/5 aspect-video">
            <div className={`flex h-20 w-20 items-center justify-center rounded-full text-3xl ${aiSpeaking ? "bg-brand-violet animate-pulse" : "bg-white/10"}`}>🤖</div>
            <span className="mt-2 text-xs text-ink-muted">{aiSpeaking ? "AI is speaking…" : "AI interviewer"}</span>
          </div>
        </div>

        <div className="rounded-card border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-ink-muted mb-1">
            {phase === "calibration" ? `Calibration question ${Math.min(calDone + 1, questions.length)}/${questions.length} (asked by AI)` : "AI interviewer:"}
          </p>
          <p className="text-lg">{currentQuestion}</p>
          {phase === "interview" && lastTag && lastTag.label && (
            <div className="mt-2">
              <span className="rounded-full bg-ink-sidebar px-2 py-0.5 text-xs text-score-warn">
                Verdict: {lastTag.label}{lastTag.confidence ? ` (${Math.round(lastTag.confidence * 100)}%)` : ""}
              </span>
              {lastTag.top_features && (
                <span className="ml-2 text-[10px] text-ink-muted">
                  {lastTag.top_features.map((f) => `${f.feature}=${f.value}`).join(" · ")}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="rounded-card border border-white/10 bg-ink-sidebar p-3">
          <p className="text-xs text-ink-muted mb-1">Your spoken answer (captions):</p>
          <p className="min-h-[2rem] text-sm">{speech.transcript || "Tap mic and answer out loud — it auto-sends when you stop."}</p>
          {speech.fluency && (
            <p className="mt-1 text-[10px] text-ink-muted">
              fluency {speech.fluency.score} · fillers {speech.fluency.fillers} · pauses {speech.fluency.pauses} · words {speech.fluency.words}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          <button onClick={() => (speech.listening ? speech.stop() : speech.start())}
            disabled={!speech.supported}
            className={`rounded-full px-6 py-3 text-sm font-semibold text-white ${speech.listening ? "bg-score-poor" : "bg-brand-violet"} disabled:opacity-50`}>
            {speech.listening ? "■ Stop & Send" : "🎤 Answer by voice"}
          </button>
          <button onClick={() => { stopSpeak(); speakAi(currentQuestion, () => setAiSpeaking(true), () => setAiSpeaking(false)); }}
            className="rounded-full bg-white/10 px-4 py-3 text-sm">🔊 Replay</button>
        </div>

        {provider && <p className="text-center text-xs text-ink-muted">provider: {provider}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setShowResume((v) => !v)} className="rounded-full bg-white/10 px-3 py-1 text-xs">
          {showResume ? "Hide" : "Upload"} Resume
        </button>
        <button onClick={() => setShowCode((v) => !v)} className="rounded-full bg-white/10 px-3 py-1 text-xs">
          {showCode ? "Hide" : "Open"} Code Editor
        </button>
        <button onClick={() => setShowVoice((v) => !v)} className="rounded-full bg-white/10 px-3 py-1 text-xs">
          {showVoice ? "Hide" : "Voice"}
        </button>
        <button onClick={toggleRoom} className="rounded-full bg-brand-green px-3 py-1 text-xs font-semibold text-white">
          🎥 Live Room
        </button>
        <IntegrityMonitor sessionId={session.sessionId} active={true} />
      </div>

      {showVoice && <VoicePanel onUseTranscript={(t) => (phase === "calibration" ? setCalText(t) : setInput(t))} />}
      {showResume && <ResumePanel sessionId={session.sessionId} />}
      {showCode && <CodePanel sessionId={session.sessionId} />}

      {/* Calibration phase (text by default; use 🎥 Live Room for spoken Q&A) */}
      {phase === "calibration" ? (
        <div className="rounded-card border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-sm text-ink-muted">Calibration question (baseline, asked by the AI — switch to 🎥 Live Room to answer by voice):</p>
          <p className="mb-3 font-medium">{questions[calIdx]}</p>
          <textarea className="w-full rounded bg-ink-sidebar p-3 text-sm outline-none" rows={4}
            value={calText} onChange={(e) => setCalText(e.target.value)} placeholder="Your answer…" />
          <button onClick={() => submitCal()} className="mt-2 rounded-full bg-brand-violet px-4 py-2 text-sm font-semibold text-white">
            {calIdx + 1 >= questions.length ? "Finish calibration" : "Next question"}
          </button>
        </div>
      ) : (
        <>
          <div className="h-[50vh] space-y-3 overflow-y-auto rounded-card border border-white/10 bg-white/5 p-4">
            {history.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                <span className={`inline-block max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-brand-violet text-white" : "bg-white/10"
                }`}>{m.content}</span>
                {m.tag && m.tag.label && (
                  <div className="mt-1 text-left">
                    <span className="rounded-full bg-ink-sidebar px-2 py-0.5 text-xs text-score-warn">
                      Tag: {m.tag.label}
                      {m.tag.confidence ? ` (${Math.round(m.tag.confidence * 100)}%)` : ""}
                    </span>
                    {m.tag.top_features && (
                      <span className="ml-2 text-[10px] text-ink-muted">
                        {m.tag.top_features.map((f) => `${f.feature}=${f.value}`).join(" · ")}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
            {busy && <p className="text-sm text-ink-muted">Interviewer is typing…</p>}
            <div ref={scrollRef} />
          </div>

          <div className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type your answer…"
              className="flex-1 rounded-full bg-ink-sidebar px-4 py-2 text-sm outline-none" />
            <button onClick={() => send()} disabled={busy}
              className="rounded-full bg-brand-violet px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Send
            </button>
          </div>
        </>
      )}

      {phase === "interview" && (
        <div className="text-right">
          <button onClick={async () => { await endSession(session.sessionId); }}
            className="rounded-full bg-brand-green px-3 py-1 text-xs font-semibold text-white">
            End & Report
          </button>
        </div>
      )}
      {provider && <p className="text-center text-xs text-ink-muted">provider: {provider}</p>}
    </div>
  );
}

function ResumePanel({ sessionId }) {
  const [status, setStatus] = useState(null);
  const [file, setFile] = useState(null);

  async function doUpload() {
    if (!file) return;
    setStatus("parsing…");
    try {
      const data = await uploadResume(sessionId, file);
      setStatus(data);
    } catch (e) {
      setStatus({ error: e.message });
    }
  }

  return (
    <div className="rounded-card border border-white/10 bg-white/5 p-3 text-sm">
      <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={doUpload} className="ml-2 rounded-full bg-brand-green px-3 py-1 text-xs font-semibold text-white">
        Parse
      </button>
      {status && (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-ink-muted">
          {status.error ? `Error: ${status.error}` : `Extracted (${status.resumeText.length} chars)\n\n${status.resumeText.slice(0, 600)}\n\nSummary: ${JSON.stringify(status.summary, null, 2)}`}
        </pre>
      )}
    </div>
  );
}

function CodePanel({ sessionId }) {
  const [problems, setProblems] = useState([]);
  const [pid, setPid] = useState("");
  const [lang, setLang] = useState("javascript");
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [sim, setSim] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    getProblems().then((p) => { setProblems(p); setPid(p[0]?.id); setCode(p[0]?.starter?.[lang] || ""); });
    const socket = io();
    socketRef.current = socket;
    socket.emit("code:join", sessionId);
    return () => socket.disconnect();
  }, [sessionId]);

  useEffect(() => {
    const prob = problems.find((p) => p.id === pid);
    setCode(prob?.starter?.[lang] || "");
  }, [lang, pid]); // eslint-disable-line

  function onCodeChange(val) {
    setCode(val);
    socketRef.current?.emit("code:keystroke", { sessionId, code: val });
  }

  function onMount(editor) {
    editor.onDidPaste(() => {
      logIntegrity({ sessionId, event: "code-paste" }).catch(() => {});
    });
  }

  async function run() {
    setResult("running…");
    try {
      const r = await runCode({ problemId: pid, language: lang, code });
      setResult(r);
      try {
        const s = await checkSimilarity({ problemId: pid, language: lang, code });
        setSim(s);
      } catch {
        setSim(null);
      }
    } catch (e) {
      setResult({ error: e.message });
    }
  }

  return (
    <div className="rounded-card border border-white/10 bg-white/5 p-3">
      <div className="mb-2 flex gap-2 text-sm">
        <select value={pid} onChange={(e) => setPid(e.target.value)} className="rounded bg-ink-sidebar px-2 py-1">
          {problems.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded bg-ink-sidebar px-2 py-1">
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
        </select>
        <button onClick={run} className="rounded-full bg-brand-violet px-3 py-1 text-xs font-semibold text-white">Run</button>
      </div>
      <div className="h-64 overflow-hidden rounded border border-white/10">
        <Editor height="100%" defaultLanguage={lang} language={lang} value={code} onChange={onCodeChange} onMount={onMount} theme="vs-dark" />
      </div>
      {result && (
        <pre className="mt-2 max-h-32 overflow-auto text-xs">
          {result.error ? `Error: ${result.error}` : `${result.passed}/${result.total} passed\n${result.results.join("\n")}`}
        </pre>
      )}
      {sim && (
        <p className="mt-1 text-xs text-ink-muted">
          Code similarity vs known solution: <b className={sim.flag === "high" ? "text-score-poor" : "text-score-warn"}>{sim.similarity} ({sim.flag})</b>
        </p>
      )}
    </div>
  );
}
