export default function InterviewerAvatar({ status, interviewType }) {
  const speaking = status === "speaking"
  const listening = status === "listening"
  const thinking = status === "thinking"

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
      <div className="absolute inset-0 bg-radial-at-c from-primary/10 via-transparent to-transparent pointer-events-none" />

      {/* Subtle outer breathing ring when active */}
      {speaking && (
        <div className="absolute w-60 h-60 rounded-full border border-purple-500/20 animate-ping opacity-30 pointer-events-none" />
      )}
      {listening && (
        <div className="absolute w-60 h-60 rounded-full border border-emerald-500/20 animate-ping opacity-30 pointer-events-none" />
      )}

      <div className="relative z-10 flex flex-col items-center">
        <div className="relative">
          <div
            className={`w-28 h-28 md:w-36 md:h-36 rounded-3xl bg-gradient-to-tr from-primary via-indigo-600 to-purple-500 flex items-center justify-center shadow-2xl transition-all duration-500 border border-white/20 ${
              speaking
                ? "scale-105 shadow-primary/60 ring-4 ring-primary/30"
                : listening
                ? "scale-100 ring-4 ring-emerald-500/30"
                : ""
            }`}
          >
            <div className="w-14 h-14 md:w-18 md:h-18 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-8 h-8 md:w-10 md:h-10 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
            </div>
          </div>

          {/* Real-time Dynamic Soundwave Visualizer */}
          {speaking && (
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-gray-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-purple-500/40 shadow-lg">
              <span className="w-1 h-3.5 bg-purple-400 rounded-full animate-[soundwave_1.1s_ease-in-out_infinite]" />
              <span className="w-1 h-5 bg-purple-300 rounded-full animate-[soundwave_0.8s_ease-in-out_infinite]" />
              <span className="w-1 h-2.5 bg-indigo-400 rounded-full animate-[soundwave_1.3s_ease-in-out_infinite]" />
              <span className="w-1 h-6 bg-purple-200 rounded-full animate-[soundwave_0.7s_ease-in-out_infinite]" />
              <span className="w-1 h-4 bg-purple-400 rounded-full animate-[soundwave_1.0s_ease-in-out_infinite]" />
            </div>
          )}

          {listening && (
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-gray-900/90 backdrop-blur-md px-3 py-1 rounded-full border border-emerald-500/40 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Listening</span>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <h3 className="text-white font-bold text-base md:text-lg tracking-tight">AI Technical Recruiter</h3>
          <p className="text-gray-400 text-xs md:text-sm mt-1">
            {speaking && "Articulating interview question..."}
            {listening && "Listening closely to your answer..."}
            {thinking && "Analyzing answer clarity & structure..."}
            {status === "idle" && (interviewType === "hr" ? "Campus HR & Culture Assessment" : "Technical & Systems Round")}
          </p>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 text-[10px] text-gray-400 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/5">
        <span className={`w-2 h-2 rounded-full ${
          status === "listening" ? "bg-emerald-400 animate-pulse" :
          status === "speaking" ? "bg-purple-400 animate-pulse" :
          status === "thinking" ? "bg-amber-400 animate-pulse" : "bg-gray-500"
        }`} />
        <span className="font-medium text-gray-300">
          {status === "listening" ? "Candidate Response Turn" :
           status === "speaking" ? "Interviewer Speaking" :
           status === "thinking" ? "Synthesizing Rubric" : "Calibrated & Ready"}
        </span>
      </div>
    </div>
  )
}
