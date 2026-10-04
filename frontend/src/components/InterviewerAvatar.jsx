export default function InterviewerAvatar({ status, interviewType }) {
  const speaking = status === "speaking"
  const listening = status === "listening"
  const thinking = status === "thinking"

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center">
        <div className="relative">
          <div
            className={`w-28 h-28 md:w-36 md:h-36 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl transition-all duration-500 ${
              speaking ? "scale-110 shadow-primary/50" : ""
            }`}
          >
            <svg className="w-14 h-14 md:w-20 md:h-20 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          {speaking && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-end gap-1 h-6">
              <span className="w-1.5 bg-white/80 rounded-full animate-pulse" style={{ height: "60%", animationDelay: "0ms" }} />
              <span className="w-1.5 bg-white/80 rounded-full animate-pulse" style={{ height: "100%", animationDelay: "150ms" }} />
              <span className="w-1.5 bg-white/80 rounded-full animate-pulse" style={{ height: "40%", animationDelay: "300ms" }} />
              <span className="w-1.5 bg-white/80 rounded-full animate-pulse" style={{ height: "80%", animationDelay: "100ms" }} />
              <span className="w-1.5 bg-white/80 rounded-full animate-pulse" style={{ height: "50%", animationDelay: "250ms" }} />
            </div>
          )}

          {listening && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
                <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" style={{ animationDelay: "300ms" }} />
                <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" style={{ animationDelay: "600ms" }} />
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 text-center">
          <h3 className="text-white font-bold text-base md:text-lg">AI Interviewer</h3>
          <p className="text-gray-400 text-xs md:text-sm mt-0.5">
            {speaking && "Speaking..."}
            {listening && "Listening to you..."}
            {thinking && "Evaluating your answer..."}
            {status === "idle" && (interviewType === "hr" ? "HR / Behavioral" : "Technical")}
          </p>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 text-[10px] text-gray-500">
        <span className={`w-1.5 h-1.5 rounded-full ${status === "listening" ? "bg-green-400" : status === "speaking" ? "bg-blue-400" : "bg-gray-500"}`} />
        {status === "listening" ? "Your turn to speak" : status === "speaking" ? "AI is speaking" : status === "thinking" ? "Analyzing" : "Ready"}
      </div>
    </div>
  )
}
