export default function InterviewAnalytics({
  faceCount = 0,
  faceDetected = false,
  bodyCount = 0,
  handCount = 0,
  phoneDetected = false,
  attentionScore = 0,
  confidenceScore = 0,
  integrityFlags = [],
  fluencyScore = 0,
  isActive = false,
  fdDebug = null,
}) {
  const multiFace = faceCount > 1
  const attentionLevel = attentionScore >= 70 ? "high" : attentionScore >= 40 ? "medium" : "low"
  const confLevel = confidenceScore >= 70 ? "high" : confidenceScore >= 40 ? "medium" : "low"

  const faceLabel = !faceDetected ? "None" : faceCount === 1 ? "Single" : "Multiple"
  const bodyLabel = bodyCount === 0 ? "None" : bodyCount === 1 ? "Single person" : "Multiple persons"
  const handLabel = handCount === 0 ? "None" : handCount === 1 ? "Hand in frame" : "Multiple hands"

  const colorMap = {
    high: "text-green-400",
    medium: "text-yellow-400",
    low: "text-red-400",
  }

  if (!isActive) return null

  return (
    <div className="absolute bottom-4 left-4 z-30 max-w-[220px]">
      <div className="bg-gray-900/90 backdrop-blur-md border border-white/10 rounded-xl p-3 space-y-2.5 text-[11px]">
        <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
          <span className="text-white/40 font-semibold tracking-wider uppercase text-[9px]">Live Analytics</span>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-white/60">Face</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${faceDetected ? "bg-green-400" : "bg-red-400"}`} />
            <span className={`font-semibold ${faceDetected ? "text-green-400" : "text-red-400"}`}>
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
          <span className={`font-semibold ${bodyCount === 0 ? "text-red-400" : bodyCount === 1 ? "text-green-400" : "text-red-400"}`}>
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
          <span className="text-white/60">Device</span>
          <span className={`font-semibold ${phoneDetected ? "text-red-400 animate-pulse" : "text-green-400"}`}>
            {phoneDetected ? "Phone Detected" : "Clear"}
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
                  flag.type === "mobile_phone_detected" || flag.type === "face_not_detected" || flag.type === "multi_face_detected"
                    ? "bg-red-400" : "bg-yellow-400"
                }`} />
                <span className="text-white/50">
                  {flag.type === "mobile_phone_detected" && "Mobile Phone Detected"}
                  {flag.type === "mobile_phone_cleared" && "Phone Cleared"}
                  {flag.type === "face_not_detected" && "Face lost"}
                  {flag.type === "multi_face_detected" && "Multiple faces"}
                  {flag.type === "single_face_restored" && "Single face restored"}
                  {flag.type === "tab_switch" && "Tab switched"}
                  {flag.type === "copy_paste" && "Copy/paste detected"}
                  {flag.type === "code_similarity_flag" && "Code similarity"}
                  {flag.type === "looking_away" && (flag.detail || "Looking away")}
                  {!["mobile_phone_detected","mobile_phone_cleared","face_not_detected","multi_face_detected","single_face_restored","tab_switch","copy_paste","code_similarity_flag","looking_away"].includes(flag.type) && flag.type}
                </span>
              </div>
            ))}
          </div>
        )}

        {fdDebug && (
          <div className="pt-1.5 border-t border-white/5">
            <span className="text-white/30 font-semibold tracking-wider uppercase text-[8px]">Worker Engine</span>
            <div className="mt-1 flex items-center gap-1.5 text-[9px] text-cyan-400 font-mono">
              <span>{fdDebug.stats?.fps ?? fdDebug.fps ?? 0} FPS</span>
              <span>({fdDebug.stats?.ms ?? fdDebug.inferenceMs ?? 0}ms)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}