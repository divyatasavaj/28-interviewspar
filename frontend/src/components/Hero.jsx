import { Link } from "react-router-dom";
import { useState } from "react";
import UiIcon from "./UiIcon";

export default function Hero() {
  const [activeTab, setActiveTab] = useState("technical");
  return <section className="home-hero" aria-labelledby="hero-heading">
    <div className="page-enter">
      <div className="hero-label"><UiIcon name="spark"/>A little practice. A bigger next step.</div>
      <h1 id="hero-heading" className="hero-title">Your next interview.<br/>A little more<br/><em>you’ve got this.</em></h1>
      <p className="hero-intro">Turn what you know into answers that sound like you. Practice interview questions, explore your resume, and find one thing to improve each time.</p>
      <div className="hero-actions"><Link className="spar-button" to="/interview/start">Start practicing <UiIcon name="arrow"/></Link><Link className="spar-button secondary" to="/practice-tracks">Explore the tracks</Link></div>
      <div className="hero-promises">{['Free to practice', 'Resume optional', 'AI is your choice'].map(text=><span key={text}><UiIcon name="check"/>{text}</span>)}</div>
    </div>
    <div className="hero-scene">
      <div className="hero-sky" aria-hidden="true"/><div className="hero-sun" aria-hidden="true"/>
      <div className="practice-window">
        <div className="window-title"><div className="window-dots" aria-hidden="true"><i/><i/><i/></div><span>A LOOK INSIDE YOUR PRACTICE</span><UiIcon name="chat"/></div>
        <div className="window-tabs" aria-label="Example question track"><button onClick={()=>setActiveTab('technical')} aria-pressed={activeTab==='technical'}>Technical thinking</button><button onClick={()=>setActiveTab('hr')} aria-pressed={activeTab==='hr'}>HR & behavioral</button></div>
        <div className="window-question" aria-live="polite"><p className="section-kicker">Example interview question</p><h2>{activeTab==='technical'?'How would you design an API that handles a sudden spike in traffic?':'Tell me about a project that changed direction. How did you adapt?'}</h2></div>
        <div className="window-hint"><strong>A place to start</strong><p>Explain your approach, why you chose it, and a real example. You have time to think.</p></div>
        <div className="window-footer"><span>Illustrative question · No answer evaluated</span><Link to={`/interview/start?persona=${activeTab}`}>Try a round <UiIcon name="arrow"/></Link></div>
      </div>
      <div className="hero-note"><UiIcon name="file"/><div><strong>Small steps. Useful reflection.</strong>Save your answers. See what comes next.</div></div>
    </div>
  </section>;
}
