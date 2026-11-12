import { Link } from "react-router-dom"
import UiIcon from "./UiIcon"

const features = [
  {
    icon: "chat", title: "Rehearse your answers", to: "/practice-tracks", action: "Explore practice tracks",
    description: "Explain a technical decision, work through coding exercises with test cases, or practice a behavioral answer.",
  },
  {
    icon: "file", title: "Prepare for a role", to: "/resume-intelligence", action: "Explore Resume Intelligence",
    description: "Compare the skills and projects in your resume with a role or job description. Turn gaps into practice topics.",
  },
  {
    icon: "chart", title: "Review your progress", to: "/account?tab=reports", action: "Open practice reports",
    description: "Return to your saved answers and feedback. See which coding tests passed and where to focus your next session.",
  },
]

export default function Features() {
  return (
    <section className="home-features" id="how-it-works" aria-labelledby="practice-heading">
      <h2 id="practice-heading">Build your practice routine</h2>
      <div className="feature-grid">
        {features.map(feature => (
          <Link className="feature-tile" key={feature.title} to={feature.to}>
            <span className="tile-icon"><UiIcon name={feature.icon} /></span>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
            <span className="text-action">{feature.action} <UiIcon name="arrow" /></span>
          </Link>
        ))}
      </div>
    </section>
  )
}
