import Navbar from "../components/Navbar"
import Hero from "../components/Hero"
import TrustedCompanies from "../components/TrustedCompanies"
import Features from "../components/Features"

export default function Home() {
  return (
    <div className="min-h-screen font-sans" style={{ background: "#faf8ff" }}>
      <Navbar />
      <Hero />
      <TrustedCompanies />
      <Features />
    </div>
  )
}
