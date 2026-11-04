import HumanAvatar from './HumanAvatar';

/** Local, accessible interviewer presence driven by actual playback/recognition state. */
export default function InterviewerAvatar({status = 'idle'}) {
  const labels = {idle:'Ready when you are', preparing:'Preparing microphone…', finalizing:'Finishing your transcript…', 'loading-question':'Preparing question audio…', speaking:'Asking your question', listening:'Listening to your answer', thinking:'Saving your answer', review:'Review your transcript'};
  return <div className={`call-avatar call-avatar-${status}`}>
    <div className="call-avatar-mark" aria-hidden="true"><HumanAvatar size={90} status={status}/></div>
    <h2>AI interviewer</h2>
    <p role="status">{labels[status] || labels.idle}</p>
    {status === 'speaking' && <div className="call-wave" aria-hidden="true">{[0,1,2,3,4].map(i=><i key={i} style={{animationDelay:`${i*.12}s`}}/>)}</div>}
    <span className="call-avatar-note">AI practice partner</span>
  </div>;
}
