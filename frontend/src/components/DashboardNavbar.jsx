import { Link, useLocation } from "react-router-dom"
import { useState } from "react"
import { clearToken } from "../api/auth"
import { useNavigate } from "react-router-dom"

const navLinks = [
  { label: "Home", to: "/dashboard" },
  { label: "Resources", to: "#" },
  { label: "Contact Us", to: "#" },
  { label: "Test", to: "#" },
]

export default function DashboardNavbar({ name }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  function handleLogout() {
    clearToken()
    navigate("/login")
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        <Link to="/dashboard" className="text-2xl font-extrabold tracking-tight">
          <span className="text-gray-800">Interview</span>
          <span className="text-primary">Spar</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to
            return (
              <Link
                key={link.label}
                to={link.to}
                className={`relative text-sm font-medium transition-colors ${
                  isActive
                    ? "text-primary after:absolute after:-bottom-1 after:left-0 after:w-full after:h-0.5 after:bg-primary after:rounded-full"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        <div className="hidden md:flex items-center gap-5">
          <button className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Notifications">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent border-2 border-white shadow-md flex items-center justify-center text-white text-sm font-bold cursor-pointer hover:opacity-90 transition-opacity"
            >
              {name ? name.charAt(0).toUpperCase() : "?"}
            </button>
            {profileOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-20">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">{name}</p>
                  </div>
                  <button
                    onClick={() => { setProfileOpen(false); navigate("/account") }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Profile
                  </button>
                  <hr className="border-gray-100" />
                  <button
                    onClick={() => { setProfileOpen(false); handleLogout() }}
                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
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
            const isActive = location.pathname === link.to
            return (
              <Link
                key={link.label}
                to={link.to}
                className={`block text-sm font-medium py-1 ${
                  isActive ? "text-primary" : "text-gray-600"
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
            className="block w-full text-left text-sm font-medium text-red-500 py-1"
          >
            Log out
          </button>
        </div>
      )}
    </nav>
  )
}
