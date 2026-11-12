import { Link } from "react-router-dom"
import Navbar from "../components/Navbar"
import Hero from "../components/Hero"
import Features from "../components/Features"

export default function Home() {
  return (
    <div className="site-home min-h-screen font-sans">
      <Navbar />
      <main>
        <Hero />
        <Features />
      </main>
      <footer className="site-footer">
        <Link to="/">InterviewSpar</Link>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Link to="/student-guide">Student guide</Link>
          <Link to="/resources">Resources</Link>
          <Link to="/contact">Contact us</Link>
        </div>
      </footer>
    </div>
  )
}
