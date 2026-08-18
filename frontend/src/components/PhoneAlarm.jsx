import { useState, useEffect, useRef, useCallback } from "react"
import { PHONE_STATE } from "../lib/phoneLogic"

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = "sine"
    osc1.frequency.value = 880
    gain1.gain.value = 0.3
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start()
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc1.stop(ctx.currentTime + 0.15)

    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = "sine"
    osc2.frequency.value = 1100
    gain2.gain.value = 0.3
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(ctx.currentTime + 0.2)
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc2.stop(ctx.currentTime + 0.35)
  } catch {
    /* audio not available */
  }
}

export default function PhoneAlarm({ phoneState, phoneAlert, onDismiss }) {
  const [visible, setVisible] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (phoneState === PHONE_STATE.CONFIRMED && !visible) {
      setVisible(true)
      setDismissing(false)
      playBeep()
      timerRef.current = setTimeout(() => {
        handleDismiss()
      }, 5000)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [phoneState])

  const handleDismiss = useCallback(() => {
    setDismissing(true)
    setTimeout(() => {
      setVisible(false)
      setDismissing(false)
      onDismiss?.()
    }, 300)
  }, [onDismiss])

  if (!visible) {
    if (phoneState === PHONE_STATE.WARM) {
      return (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 transition-opacity duration-300">
          <span className="rounded-full bg-amber-500/80 text-white text-[10px] font-semibold px-3 py-1 animate-pulse">
            device in view
          </span>
        </div>
      )
    }
    return null
  }

  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
        dismissing ? "opacity-0" : "opacity-100"
      }`}
      style={{ backgroundColor: "rgba(180, 20, 20, 0.92)" }}
    >
      <div className="text-center px-8 max-w-md">
        <svg className="w-16 h-16 text-white mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <h2 className="text-white text-xl font-bold mb-2">Phone Detected</h2>
        <p className="text-white/80 text-sm mb-6">
          Put your phone away or your session will be flagged.
        </p>
        <button
          onClick={handleDismiss}
          className="bg-white text-red-700 font-semibold px-6 py-2 rounded-full hover:bg-white/90 transition-colors"
        >
          I understand (5s)
        </button>
        {phoneAlert && (
          <p className="text-white/50 text-[10px] mt-4">
            signal: {phoneAlert.corroboration} · confidence: {(phoneAlert.confidence * 100).toFixed(0)}%
          </p>
        )}
      </div>
    </div>
  )
}
