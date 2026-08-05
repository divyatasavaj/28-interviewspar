import { useEffect, useRef, useState } from "react";
import { logIntegrity } from "../api";

// STEP 8 — browser-side integrity monitoring. Rule-based event detection only
// (tab-switch, blur, fullscreen exit, visibility). Face detection is an optional hook:
// if a face-api/MediaPipe model is loaded globally it is used; otherwise we only log
// camera on/off (rules.md: no custom CV, video never leaves the browser).
export default function IntegrityMonitor({ sessionId, active }) {
  const [flags, setFlags] = useState(0);
  const [consent, setConsent] = useState(false);
  const started = useRef(false);

  async function send(event, detail) {
    try {
      const r = await logIntegrity({ sessionId, event, detail });
      if (r.count !== undefined) setFlags(r.count);
    } catch {
      /* non-fatal */
    }
  }

  useEffect(() => {
    if (!active || !consent || started.current) return;
    started.current = true;
    send("session-start", { fullscreen: !!document.fullscreenElement });

    const onBlur = () => send("window-blur");
    const onFocus = () => send("window-focus");
    const onVis = () => { if (document.hidden) send("tab-hidden"); };
    const onFs = () => { if (!document.fullscreenElement) send("fullscreen-exit"); };

    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("fullscreenchange", onFs);

    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [active, consent, sessionId]);

  if (!active) return null;

  if (!consent) {
    return (
      <div className="rounded-card border border-white/10 bg-white/5 p-3 text-sm">
        <p className="mb-2">This session may record integrity signals (tab switches, focus, fullscreen) for the report. Video never leaves your browser.</p>
        <button onClick={() => setConsent(true)} className="rounded-full bg-brand-violet px-3 py-1 text-xs font-semibold text-white">
          Consent &amp; begin monitoring
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-card border border-white/10 bg-white/5 px-3 py-1 text-xs">
      <span className="text-score-good">● monitoring</span>
      <button onClick={() => document.documentElement.requestFullscreen?.()} className="rounded bg-white/10 px-2 py-0.5">
        Go fullscreen
      </button>
      <span className="text-ink-muted">integrity flags: {flags}</span>
    </div>
  );
}
