import { useSpeech } from "../hooks/useSpeech"

export default function VoicePanel({ onUseTranscript }) {
  const {
    supported,
    listening,
    transcript,
    fluency,
    start,
    stop,
    setTranscript,
  } = useSpeech()

  if (!supported) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/60 p-3 text-xs text-yellow-400/80">
        Voice speech input requires Google Chrome or a browser with Web Speech API.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/70 backdrop-blur-md p-3 text-sm space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={listening ? stop : start}
            className={`rounded-full px-4 py-1 text-xs font-semibold text-white transition-all ${
              listening
                ? "bg-red-500 hover:bg-red-600 animate-pulse"
                : "bg-primary hover:bg-violet-700"
            }`}
          >
            {listening ? "● Stop Listening" : "🎙️ Speak / Record"}
          </button>
          {listening && (
            <span className="text-[10px] text-green-400 animate-pulse font-mono">
              Listening live...
            </span>
          )}
        </div>

        {fluency && (
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span className="rounded bg-violet-950/60 px-2 py-0.5 text-violet-300 border border-violet-500/30">
              fluency: {fluency.score}%
            </span>
            <span className="rounded bg-yellow-950/60 px-2 py-0.5 text-yellow-300 border border-yellow-500/30">
              fillers: {fluency.fillers}
            </span>
            <span className="rounded bg-blue-950/60 px-2 py-0.5 text-blue-300 border border-blue-500/30">
              pauses: {fluency.pauses}
            </span>
          </div>
        )}
      </div>

      <p className="min-h-[2.5rem] max-h-[5rem] overflow-y-auto rounded-lg bg-white/5 p-2 text-xs text-white/90 leading-relaxed font-sans border border-white/5">
        {transcript || (
          <span className="text-white/40 italic">
            Captions and live speech transcription will appear here...
          </span>
        )}
      </p>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={() => setTranscript("")}
          className="rounded-md bg-white/10 hover:bg-white/20 px-3 py-1 text-xs text-white/70 transition-colors"
        >
          Clear
        </button>
        <button
          onClick={() => onUseTranscript(transcript)}
          disabled={!transcript.trim()}
          className="rounded-md bg-green-600 hover:bg-green-700 disabled:opacity-40 px-4 py-1 text-xs font-semibold text-white transition-all shadow-md"
        >
          Use as answer 🚀
        </button>
      </div>
    </div>
  )
}
