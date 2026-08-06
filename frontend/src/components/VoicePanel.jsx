import { useSpeech } from "../hooks/useSpeech.js";

// STEP 9 — subtitles + fluency panel. Shows live captions, filler/pause counts, a fluency
// score, and lets the user send the transcript as their answer. Grammar check (LanguageTool)
// is optional and skipped if no API is configured.
export default function VoicePanel({ onUseTranscript }) {
  const { supported, listening, transcript, fluency, start, stop, setTranscript } = useSpeech();

  if (!supported) {
    return <p className="text-xs text-ink-muted">Voice input needs Chrome / Web Speech API.</p>;
  }

  return (
    <div className="rounded-card border border-white/10 bg-white/5 p-3 text-sm">
      <div className="mb-2 flex items-center gap-2">
        <button onClick={listening ? stop : start} className="rounded-full bg-brand-violet px-3 py-1 text-xs font-semibold text-white">
          {listening ? "Stop" : "Speak"}
        </button>
        {fluency && (
          <span className="text-xs text-ink-muted">
            fluency {fluency.score} · fillers {fluency.fillers} · pauses {fluency.pauses}
          </span>
        )}
      </div>
      <p className="min-h-[3rem] rounded bg-ink-sidebar p-2 text-xs">{transcript || "…captions will appear here"}</p>
      <div className="mt-2 flex gap-2">
        <button onClick={() => onUseTranscript(transcript)} disabled={!transcript.trim()} className="rounded-full bg-brand-green px-3 py-1 text-xs font-semibold text-white">
          Use as answer
        </button>
        <button onClick={() => setTranscript("")} className="rounded bg-white/10 px-3 py-1 text-xs">Clear</button>
      </div>
    </div>
  );
}
