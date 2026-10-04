import { Link, useLocation, useNavigate } from "react-router-dom"
import { useState } from "react"
import { clearToken } from "../api/auth"

export default function DashboardNavbar({ name }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  function handleLogout() {
    clearToken()
    navigate("/login")
  }

  const navLinks = [
    { label: "Dashboard", to: "/dashboard" },
    { label: "New Interview", to: "/interview-type" },
    { label: "Resume", to: "/account?tab=resume" },
    { label: "Reports", to: "/account?tab=reports" },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-white/90 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        <Link to="/dashboard" className="text-2xl font-extrabold tracking-tight">
          <span className="text-gray-900">Interview</span>
          <span className="text-primary">Spar</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
            const isActive = location.pathname + location.search === link.to || (link.to === "/dashboard" && location.pathname === "/dashboard")
            return (
              <Link
                key={link.label}
                to={link.to}
                className={`relative text-sm font-medium transition-colors ${
                  isActive
                    ? "text-primary after:absolute after:-bottom-1 after:left-0 after:w-full after:h-0.5 after:bg-primary after:rounded-full font-semibold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        <div className="hidden md:flex items-center gap-5">
          <Link
            to="/interview-type"
            className="text-xs font-semibold bg-primary hover:bg-[#5b22e0] text-white px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-all flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span>Practice Now</span>
          </Link>

          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent border-2 border-white shadow-md flex items-center justify-center text-white text-sm font-bold cursor-pointer hover:opacity-90 transition-opacity"
            >
              {name ? name.charAt(0).toUpperCase() : "U"}
            </button>
            {profileOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-20">
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-sm font-bold text-gray-900">{name}</p>
                    <p className="text-[11px] text-gray-400">Candidate Dashboard</p>
                  </div>
                  <button
                    onClick={() => { setProfileOpen(false); navigate("/account?tab=profile") }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span>👤 Profile Details</span>
                  </button>
                  <button
                    onClick={() => { setProfileOpen(false); navigate("/account?tab=resume") }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span>📄 Resume Parser</span>
                  </button>
                  <button
                    onClick={() => { setProfileOpen(false); navigate("/account?tab=reports") }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span>📊 Past Reports</span>
                  </button>
                  <button
                    onClick={() => { setProfileOpen(false); navigate("/account?tab=preferences") }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span>⚙️ Voice & Preferences</span>
                  </button>
                  <hr className="border-gray-100 my-1" />
                  <button
                    onClick={() => { setProfileOpen(false); handleLogout() }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 text-gray-600"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-white border-b border-gray-100 px-6 pb-6 space-y-3">
          {navLinks.map((link) => {
            const isActive = location.pathname + location.search === link.to
            return (
              <Link
                key={link.label}
                to={link.to}
                className={`block text-sm font-medium py-1.5 ${
                  isActive ? "text-primary font-semibold" : "text-gray-600"
                }`}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            )
          })}
          <hr className="border-gray-100" />
          <button
            onClick={() => { setMenuOpen(false); handleLogout() }}
            className="block w-full text-left text-sm font-medium text-red-500 py-1.5"
          >
            Log out
          </button>
        </div>
      )}
    </nav>
  )
}
