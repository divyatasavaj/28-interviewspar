import HumanAvatar from "./HumanAvatar.jsx";

export default function InterviewerAvatar({ status, interviewType }) {
  const speaking = status === "speaking";
  const listening = status === "listening";
  const thinking = status === "thinking";

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
          {/* Human Avatar with DiceBear personas */}
          <HumanAvatar
            seed="interviewer-main"
            size={96}
            status={status}
            persona={interviewType === "hr" ? "hr" : "tech"}
            ariaLabel={interviewType === "hr" ? "AI HR Interviewer" : "AI Technical Interviewer"}
          />

          {/* Real-time Dynamic Soundwave Visualizer */}
          {speaking && (
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-gray-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-purple-500/40 shadow-lg">
              <span className="w-1 h-3.5 bg-purple-400 rounded-full animate-[soundwave_1.1s_ease-in-out_infinite]" />
              <span className="w-1 h-5 bg-purple-300 rounded-full animate-[soundwave_0.8s_ease-in-out_infinite]" />
              <span className="w-1 h-2.5 bg-indigo-400 rounded-full animate-[soundwave_1.3s_ease-in-out_infinite]" />
              <span className="w-1 h-6 bg-purple-200 rounded-full animate-[soundwave_0.7s_ease-in-out_infinite]" />
              <span className="w-1 h-4 bg-purple-400 rounded-full animate-[soundwave_1.0s_ease-in_out_infinite]" />
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
          <h3 className="text-white font-bold text-base md:text-lg tracking-tight">
            {interviewType === "hr" ? "AI HR Recruiter" : "AI Technical Recruiter"}
          </h3>
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