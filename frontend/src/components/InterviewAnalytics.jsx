import { useState } from "react"

export default function InterviewAnalytics({
  faceCount = 0,
  faceDetected = false,
  bodyCount = 0,
  handCount = 0,
  attentionScore = 0,
  confidenceScore = 0,
  integrityFlags = [],
  fluencyScore = 0,
  isActive = false,
  fdDebug = null,
}) {
  const [open, setOpen] = useState(false)
  const multiFace = faceCount > 1
  const attentionLevel = attentionScore >= 70 ? "high" : attentionScore >= 40 ? "medium" : "low"
  const confLevel = confidenceScore >= 70 ? "high" : confidenceScore >= 40 ? "medium" : "low"

  const faceLabel = !faceDetected ? "Not visible" : faceCount === 1 ? "In frame" : "Multiple"
  // Candidate-present mirrors FaceDetection's personSignal OR-gate; the
  // combined multi-person count drives the "additional person" wording.
  const multiPerson = fdDebug?.stats?.multiPerson ?? Math.max(faceCount, bodyCount)
  const candidatePresent = faceDetected || bodyCount >= 1
  const bodyLabel = !candidatePresent ? "Candidate not visible" : multiPerson > 1 ? "Additional person detected" : "Candidate in frame"
  const handLabel = handCount === 0 ? "None" : handCount === 1 ? "Hand in frame" : "Multiple hands"

  const colorMap = {
    high: "text-green-400",
    medium: "text-yellow-400",
    low: "text-red-400",
  }

  if (!isActive) return null

  // Compact strip: single overall state badge (Task A labels). Driven by the
  // sustained alert flags when present (ambient interrupt — pulses without the
  // drawer needing to be open), else the instantaneous candidate state.
  const f = fdDebug?.flags
  const strip =
    f?.personGone ? { tone: "bad", text: "Candidate not visible" }
    : f?.multiPerson ? { tone: "bad", text: "Additional person detected" }
    : f?.handIntrusion ? { tone: "bad", text: "Unidentified hand in frame" }
    : f?.faceGone ? { tone: "warn", text: "Face not visible" }
    : !candidatePresent ? { tone: "bad", text: "Candidate not visible" }
    : multiPerson > 1 ? { tone: "bad", text: "Additional person detected" }
    : { tone: "ok", text: "Candidate in frame" }
  const stripBadge = (tone, text) => (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
      tone === "ok" ? "bg-black/50 text-green-400"
      : tone === "warn" ? "bg-yellow-500/80 text-white"
      : "bg-red-500/80 text-white"
    } ${tone !== "ok" ? "animate-pulse" : ""}`}>
      {text}
    </span>
  )

  return (
    <div className="absolute bottom-4 left-4 z-30 w-[220px]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-gray-900/90 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 text-[11px] flex items-center justify-between gap-2 cursor-pointer hover:border-white/20 transition-colors"
      >
        {stripBadge(strip.tone, strip.text)}
        <svg
          className={`w-3 h-3 text-white/40 flex-shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${open ? "max-h-[70vh] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="mt-1.5 bg-gray-900/90 backdrop-blur-md border border-white/10 rounded-xl p-3 space-y-2.5 text-[11px] max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
            <span className="text-white/40 font-semibold tracking-wider uppercase text-[9px]">Live Analytics</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-white/60">Face</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${faceDetected ? (faceCount > 1 ? "bg-red-400" : "bg-green-400") : "bg-yellow-400"}`} />
              <span className={`font-semibold ${faceDetected ? (faceCount > 1 ? "text-red-400" : "text-green-400") : "text-yellow-400"}`}>
                {faceLabel}
              </span>
            </div>
          </div>

        {multiFace && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
            <svg className="w-3 h-3 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-red-400 font-semibold text-[10px]">Multiple faces detected</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-white/60">Body</span>
          <span className={`font-semibold ${bodyLabel === "Candidate in frame" ? "text-green-400" : "text-red-400"}`}>
            {bodyLabel}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-white/60">Hands</span>
          <span className={`font-semibold ${handCount === 0 ? "text-white/40" : handCount === 1 ? "text-yellow-400" : "text-red-400"}`}>
            {handLabel}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-white/60">Attention</span>
          <span className={`font-semibold ${colorMap[attentionLevel]}`}>
            {attentionScore}%
          </span>
        </div>

        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              attentionLevel === "high" ? "bg-green-400" :
              attentionLevel === "medium" ? "bg-yellow-400" : "bg-red-400"
            }`}
            style={{ width: `${attentionScore}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-white/60">Confidence</span>
          <span className={`font-semibold ${colorMap[confLevel]}`}>
            {confidenceScore}%
          </span>
        </div>

        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              confLevel === "high" ? "bg-green-400" :
              confLevel === "medium" ? "bg-yellow-400" : "bg-red-400"
            }`}
            style={{ width: `${confidenceScore}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-white/60">Fluency</span>
          <span className="font-semibold text-blue-400">
            {Math.round(fluencyScore * 100)}%
          </span>
        </div>

        {integrityFlags.length > 0 && (
          <div className="pt-1.5 border-t border-white/5 space-y-1">
            <span className="text-white/40 font-semibold tracking-wider uppercase text-[9px]">Alerts</span>
            {integrityFlags.slice(-3).map((flag, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px]">
                <span className={`w-1 h-1 rounded-full ${
                  flag.type === "person_not_detected" || flag.type === "multi_person_detected" || flag.type === "hand_intrusion_detected" || flag.type === "multi_face_detected" || flag.type === "looking_away"
                    ? "bg-red-400"
                    : flag.type === "face_not_detected"
                    ? "bg-yellow-400"
                    : flag.type === "single_face_restored" || flag.type === "face_detected" || flag.type === "person_detected" || flag.type === "person_count_restored"
                    ? "bg-green-400"
                    : "bg-yellow-400"
                }`} />
                <span className="text-white/50">
                  {flag.type === "person_not_detected" && "Candidate not visible"}
                  {flag.type === "multi_person_detected" && "Additional person detected"}
                  {flag.type === "hand_intrusion_detected" && "Unidentified hand in frame"}
                  {flag.type === "face_not_detected" && "Face not visible"}
                  {flag.type === "face_detected" && "Face back in frame"}
                  {flag.type === "person_detected" && "Candidate back in frame"}
                  {flag.type === "person_count_restored" && "Extra person gone"}
                  {flag.type === "multi_face_detected" && "Multiple faces"}
                  {flag.type === "single_face_restored" && "Single face restored"}
                  {flag.type === "tab_switch" && "Tab switched"}
                  {flag.type === "copy_paste" && "Copy/paste detected"}
                  {flag.type === "code_similarity_flag" && "Code similarity"}
                  {flag.type === "looking_away" && (flag.detail || "Looking away")}
                  {!["person_not_detected","multi_person_detected","hand_intrusion_detected","face_not_detected","face_detected","person_detected","person_count_restored","multi_face_detected","single_face_restored","tab_switch","copy_paste","code_similarity_flag","looking_away"].includes(flag.type) && flag.type}
                </span>
              </div>
            ))}
          </div>
        )}

        {fdDebug && (
          <div className="pt-1.5 border-t border-white/5">
            <span className="text-white/30 font-semibold tracking-wider uppercase text-[8px]">Detection</span>
            <div className="mt-1 flex items-center gap-1.5 text-[9px] text-white/40 font-mono">
              <span className={`w-1 h-1 rounded-full ${
                fdDebug.tier === "native" ? "bg-green-400" :
                fdDebug.tier === "human" ? "bg-blue-400" : "bg-yellow-500"
              }`} />
              <span className="uppercase font-semibold tracking-wider">
                {fdDebug.tier === "human" ? "human" : fdDebug.tier}
              </span>
              <span>c:{fdDebug.confidence?.toFixed(2) ?? "?"}</span>
              <span>v:{fdDebug.variance}</span>
              {fdDebug.stats && fdDebug.stats.rawBodies > 0 && (
                <span className={fdDebug.stats.rawBodies === fdDebug.stats.bodies ? "text-green-400" : "text-yellow-400"}>
                  b:{fdDebug.stats.rawBodies}→{fdDebug.stats.bodies}
                </span>
              )}
              {fdDebug.stats && fdDebug.stats.multiPerson > 0 && (
                <span className={fdDebug.stats.multiPerson > 1 ? "text-red-400" : "text-green-400"}>
                  p:{fdDebug.stats.multiPerson}
                </span>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}