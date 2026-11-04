/** Local illustration only; its speaking animation follows playback, not inferred emotion. */
export default function HumanAvatar({size=100,status='idle',ariaLabel='AI interviewer'}) {
  return <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={ariaLabel}>
    <circle cx="60" cy="60" r="58" fill="#dcefff"/>
    <path d="M22 120v-14q8-21 38-21t38 21v14" fill="#126fa4"/>
    <path d="M49 79h22v17q-11 12-22 0" fill="#c98961"/>
    <ellipse cx="60" cy="52" rx="29" ry="35" fill="#e8af84"/>
    <path d="M30 50V35Q32 9 59 12q32 0 32 30v8L79 31Q64 44 35 34Z" fill="#193449"/>
    <path d="M40 48h13m14 0h13" stroke="#193449" strokeWidth="3" strokeLinecap="round"/>
    <circle cx="48" cy="54" r="3" fill="#193449"/><circle cx="72" cy="54" r="3" fill="#193449"/>
    <path d="M60 55l-3 10h6" fill="none" stroke="#ad704c" strokeWidth="2"/>
    <ellipse className={status==='speaking'?'avatar-mouth-speaking':''} cx="60" cy="76" rx="8" ry="3" fill="#773e36"/>
  </svg>;
}
