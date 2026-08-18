import { useEffect, useRef, useState } from "react"

export default function PhoneAlarmModal({ isOpen, onClose, alertDetails }) {
  const [countdown, setCountdown] = useState(5)
  const audioCtxRef = useRef(null)

  // Initialize Web Audio API synth beep
  const playAlarmSound = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (AudioCtx) audioCtxRef.current = new AudioCtx()
      }
      const ctx = audioCtxRef.current
      if (!ctx || ctx.state === "suspended") {
        ctx?.resume()
      }
      if (!ctx) return

      const now = ctx.currentTime
      // Beep 1
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = "sine"
      osc1.frequency.setValueAtTime(880, now) // A5
      gain1.gain.setValueAtTime(0.3, now)
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.2)

      // Beep 2
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = "sine"
      osc2.frequency.setValueAtTime(880, now + 0.25) // A5
      gain2.gain.setValueAtTime(0.3, now + 0.25)
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now + 0.25)
      osc2.stop(now + 0.45)
    } catch {
      /* Audio playback blocked by browser or uninitialized */
    }
  }

  useEffect(() => {
    if (!isOpen) {
      setCountdown(5)
      return
    }

    playAlarmSound()

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          onClose?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-950/80 backdrop-blur-md animate-fade-in p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-red-500/30 bg-gradient-to-b from-gray-900/90 to-black/95 p-6 shadow-2xl shadow-red-500/20 text-center">
        {/* Glowing warning icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 border border-red-500/40 text-red-500 shadow-lg shadow-red-500/30 animate-pulse">
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
          Mobile Device Detected
        </h2>
        <p className="text-sm text-red-200/90 mb-6 leading-relaxed">
          Phone detected — put your phone away or your interview session will be flagged for compliance review.
        </p>

        {alertDetails && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs font-mono text-red-300 text-left">
            <div>Confidence: {(alertDetails.confidence * 100).toFixed(0)}%</div>
            <div>Time: {new Date(alertDetails.timestamp || Date.now()).toLocaleTimeString()}</div>
            <div>Signal: Fused hand &amp; pose corroboration</div>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-gray-400">
            Auto-dismissing in <span className="font-bold text-red-400">{countdown}s</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-red-600 hover:bg-red-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-600/30 transition-all hover:scale-105 active:scale-95"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  )
}
