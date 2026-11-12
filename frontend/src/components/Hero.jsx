import { Link } from "react-router-dom"
import { useState } from "react"
import UiIcon from "./UiIcon"

const tracks = [
  {
    id: "technical", label: "Technical", icon: "mic", query: "",
    question: "How would you keep an API responsive during a sudden spike in traffic?",
    prompt: "Start with what you’d measure, then explain a trade-off you’d make.",
  },
  {
    id: "coding", label: "Coding", icon: "code", query: "?track=coding",
    question: "Find the first character in a string that appears only once.",
    prompt: "Think about how to count characters while preserving their order.",
    example: 'Input: "swiss"   →   Output: "w"',
  },
  {
    id: "hr", label: "Behavioral", icon: "chat", query: "?persona=hr",
    question: "Tell me about a time a project changed direction. How did you adapt?",
    prompt: "Describe the situation, what you did, and what happened next.",
  },
]

export default function Hero() {
  const [activeTrack, setActiveTrack] = useState(tracks[0])
  return (
    <section className="home-hero" aria-labelledby="hero-heading">
      <div className="hero-copy page-enter">
        <p className="section-kicker">Interview practice</p>
        <h1 id="hero-heading" className="hero-title">Practice for the <em>real thing.</em></h1>
        <p className="hero-intro">Rehearse out loud, solve coding problems, and use your resume to prepare for the role you want.</p>
        <div className="hero-actions">
          <Link className="spar-button" to="/interview/start">Start practicing <UiIcon name="arrow" /></Link>
          <Link className="text-action" to="/practice-tracks">Explore the tracks <UiIcon name="arrow" /></Link>
        </div>
        <p className="hero-access"><UiIcon name="check" /> Free to practice · Resume optional</p>
      </div>
      <div className="hero-scene page-enter">
        <div className="practice-window">
          <header className="window-title"><UiIcon name="mic" /> Practice preview</header>
          <div className="window-tabs" role="group" aria-label="Example question track">
            {tracks.map(track => (
              <button key={track.id} type="button" onClick={() => setActiveTrack(track)} aria-pressed={activeTrack.id === track.id}>
                <UiIcon name={track.icon} /> {track.label}
              </button>
            ))}
          </div>
          <div aria-live="polite" aria-atomic="true">
            <div className="window-question" key={activeTrack.id}>
              <p>Sample question</p>
              <h2>{activeTrack.question}</h2>
              {activeTrack.example && <code>{activeTrack.example}</code>}
              <p>{activeTrack.prompt}</p>
            </div>
          </div>
          <div className="window-footer">
            <Link className="text-action" to={`/interview/start${activeTrack.query}`}>Try this track <UiIcon name="arrow" /></Link>
          </div>
        </div>
      </div>
    </section>
  )
}
