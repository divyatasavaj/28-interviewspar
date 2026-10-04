import { useState, useEffect } from "react"
import { fetchTtsVoices } from "../api/tts"
import { playHumanSpeech, stopAnySpeech } from "../utils/naturalSpeech"

export default function VoiceControls({
  currentVoice,
  onChangeVoice,
  currentRate,
  onChangeRate,
  currentPitch,
  onChangePitch,
  onReplayQuestion,
  isSpeaking,
}) {
  const [open, setOpen] = useState(false)
  const [voices, setVoices] = useState([])
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    fetchTtsVoices().then((data) => {
      if (data && data.voices) {
        setVoices(data.voices)
      }
    })
  }, [])

  const handleTestVoice = async () => {
    if (testing) {
      stopAnySpeech()
      setTesting(false)
      return
    }
    setTesting(true)
    await playHumanSpeech(
      "Hello! I am your AI interviewer today. I speak with natural pacing, clear intonation, and human conversational cadence.",
      {
        voice: currentVoice,
        rate: currentRate,
        pitch: currentPitch,
        onEnd: () => setTesting(false),
        onError: () => setTesting(false),
      }
    )
    setTesting(false)
  }

  const selectedVoiceObj = voices.find((v) => v.id === currentVoice) || {
    name: "Ava",
    gender: "Female",
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {onReplayQuestion && (
          <button
            onClick={onReplayQuestion}
            title="Replay current question"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all text-xs flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Repeat Question</span>
          </button>
        )}

        <button
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
            open
              ? "bg-primary/20 border-primary text-white"
              : "bg-white/5 hover:bg-white/10 border-white/10 text-gray-300 hover:text-white"
          }`}
        >
          <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <span>Voice: <strong className="text-white">{selectedVoiceObj.name}</strong></span>
          {isSpeaking && (
            <span className="flex items-center gap-0.5 ml-1">
              <span className="w-1 h-2.5 bg-blue-400 rounded-full animate-pulse" />
              <span className="w-1 h-3.5 bg-blue-400 rounded-full animate-pulse delay-75" />
              <span className="w-1 h-1.5 bg-blue-400 rounded-full animate-pulse delay-150" />
            </span>
          )}
          <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 bottom-full mb-2 w-80 bg-gray-900/95 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-2xl z-50 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <h4 className="text-sm font-semibold text-white">AI Voice & Natural Cadence</h4>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
                aria-label="Close"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3.5 mt-3">
              {/* Voice Selection */}
              <div>
                <label className="text-[11px] font-medium text-gray-400 block mb-1.5">
                  Interviewer Persona
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {voices.map((v) => {
                    const isSelected = v.id === currentVoice
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => onChangeVoice(v.id)}
                        className={`text-left p-2 rounded-xl border text-xs transition-all ${
                          isSelected
                            ? "bg-primary/25 border-primary text-white font-medium"
                            : "bg-white/5 border-white/5 text-gray-300 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{v.name}</span>
                          <span className="text-[10px] text-gray-400">{v.gender}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">
                          {v.description}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Pacing */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-gray-400">
                    Conversational Pace
                  </label>
                  <span className="text-[10px] text-blue-400">
                    {currentRate === "-3%" ? "Natural Conversational" : currentRate === "-7%" ? "Calm & Thoughtful" : currentRate === "+0%" ? "Standard" : "Brisk"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { label: "Calm", value: "-7%" },
                    { label: "Natural", value: "-3%" },
                    { label: "Standard", value: "+0%" },
                  ].map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => onChangeRate(p.value)}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border text-center transition-all ${
                        currentRate === p.value
                          ? "bg-primary/30 border-primary text-white"
                          : "bg-white/5 border-white/5 text-gray-400 hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pitch */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-gray-400">
                    Tone & Pitch
                  </label>
                  <span className="text-[10px] text-blue-400">
                    {currentPitch === "+0Hz" ? "Natural Human" : currentPitch === "-2Hz" ? "Warm & Deep" : "Crisp"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { label: "Warm", value: "-2Hz" },
                    { label: "Natural", value: "+0Hz" },
                    { label: "Crisp", value: "+2Hz" },
                  ].map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => onChangePitch(p.value)}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border text-center transition-all ${
                        currentPitch === p.value
                          ? "bg-primary/30 border-primary text-white"
                          : "bg-white/5 border-white/5 text-gray-400 hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview Button */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestVoice}
                  className="w-full py-2 px-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 hover:text-white text-xs font-medium flex items-center justify-center gap-2 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                  {testing ? "Playing Preview... (Click to Stop)" : "Preview Voice & Cadence"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
