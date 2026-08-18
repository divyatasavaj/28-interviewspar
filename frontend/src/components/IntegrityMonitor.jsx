import { useEffect, useRef, useState } from "react"
import { logIntegrity, logTabSwitch, logFullscreenExit } from "../api/auth"

// Browser-side integrity monitoring. Rule-based event detection only
// (tab-switch, blur, fullscreen exit, visibility). Runs during an active session;
// monitoring starts only after explicit user consent.
export default function IntegrityMonitor({ sessionId, active }) {
  const [consent, setConsent] = useState(false)
  const [monitoring, setMonitoring] = useState(false)
  const [isFs, setIsFs] = useState(false)
  const started = useRef(false)

  // Requires a user gesture in most browsers, so this is only ever called from
  // click handlers. Rejections (embedded contexts, user declining the prompt)
  // are swallowed — the interview continues in the normal windowed view.
  const requestFullscreenSafe = async () => {
    const el = document.documentElement
    if (!document.fullscreenElement && el.requestFullscreen) {
      try {
        await el.requestFullscreen()
      } catch (err) {
        console.info("[integrity] Fullscreen request declined, continuing windowed:", err?.message || err)
      }
    }
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    } else {
      requestFullscreenSafe()
    }
  }

  useEffect(() => {
    if (!active || !consent || started.current) return
    started.current = true
    setMonitoring(true)
    logIntegrity(sessionId, "session-start", { extra: { fullscreen: !!document.fullscreenElement } }).catch(() => {})

    const onBlur = () => logTabSwitch(sessionId).catch(() => {})
    const onVis = () => {
      if (document.hidden) logTabSwitch(sessionId).catch(() => {})
    }
    const onFs = () => {
      setIsFs(!!document.fullscreenElement)
      // Only react to EXITING fullscreen — the entry transition sets
      // fullscreenElement, so entering never fires a spurious exit event.
      if (!document.fullscreenElement) logFullscreenExit(sessionId).catch(() => {})
    }

    window.addEventListener("blur", onBlur)
    document.addEventListener("visibilitychange", onVis)
    document.addEventListener("fullscreenchange", onFs)

    return () => {
      window.removeEventListener("blur", onBlur)
      document.removeEventListener("visibilitychange", onVis)
      document.removeEventListener("fullscreenchange", onFs)
    }
  }, [active, consent, sessionId])

  if (!active) return null

  if (!consent) {
    return (
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-md rounded-xl border border-white/10 bg-black/70 backdrop-blur-md px-4 py-3 text-sm">
        <p className="mb-2 text-white/70">
          This session may record integrity signals (tab switches, focus loss, fullscreen exit) for your report.
          Video never leaves your browser.
        </p>
        <button
          onClick={() => {
            setConsent(true)
            requestFullscreenSafe()
          }}
          className="rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white"
        >
          Consent & begin monitoring
        </button>
      </div>
    )
  }

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[10px] text-white backdrop-blur-md">
      <span className="text-green-400">● monitoring</span>
      <button
        onClick={toggleFullscreen}
        className="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20"
      >
        {isFs ? "Exit fullscreen" : "Go fullscreen"}
      </button>
      {monitoring && <span className="text-white/50">integrity: on</span>}
    </div>
  )
}