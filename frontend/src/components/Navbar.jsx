import { Link, useLocation } from "react-router-dom"
import { useState, useEffect } from "react"
import { getToken } from "../api/auth"

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setIsLoggedIn(Boolean(getToken()))
  }, [location])

  const navLinks = [
    { label: "Home", to: "/" },
    { label: "Features", to: "/#features" },
    { label: "Practice Drills", to: isLoggedIn ? "/interview-type" : "/login" },
    { label: "Pricing", to: "/#pricing" },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-white/90 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        <Link to="/" className="text-2xl font-extrabold tracking-tight">
          <span className="text-gray-900">Interview</span>
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
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        <div className="hidden md:flex items-center gap-4">
          {isLoggedIn ? (
            <Link
              to="/dashboard"
              className="text-sm font-semibold text-white bg-primary hover:bg-[#5b22e0] px-6 py-2.5 rounded-full transition-all shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <span>Dashboard</span>
              <span>→</span>
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="text-sm font-semibold text-white bg-primary hover:bg-[#5b22e0] px-6 py-2.5 rounded-full transition-all shadow-md hover:shadow-lg"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 text-gray-600 hover:text-gray-900"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {open ? (
              <path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
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
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            )
          })}
          <hr className="border-gray-100" />
          {isLoggedIn ? (
            <Link
              to="/dashboard"
              className="block text-center text-sm font-semibold text-white bg-primary hover:bg-[#5b22e0] px-5 py-2.5 rounded-full transition-all"
              onClick={() => setOpen(false)}
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="block text-sm font-semibold text-gray-700 py-1"
                onClick={() => setOpen(false)}
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="block text-center text-sm font-semibold text-white bg-primary hover:bg-[#5b22e0] px-5 py-2.5 rounded-full transition-all"
                onClick={() => setOpen(false)}
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
