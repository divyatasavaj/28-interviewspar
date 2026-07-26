import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { getMe, clearToken } from "../api/auth"
import DashboardNavbar from "../components/DashboardNavbar"
import DashboardHero from "../components/DashboardHero"

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => {
        clearToken()
        navigate("/login")
      })
  }, [navigate])

  if (!user) return null

  return (
    <div className="min-h-screen font-sans" style={{ background: "#faf8ff" }}>
      <div
        className="fixed top-0 right-0 w-[300px] md:w-[600px] h-[300px] md:h-[600px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at top right, rgba(109,40,217,0.08) 0%, transparent 70%)",
        }}
      />
      <DashboardNavbar name={user.name} />
      <DashboardHero name={user.name} />
    </div>
  )
}
