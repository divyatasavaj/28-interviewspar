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
    { label: "Practice Tracks", to: isLoggedIn ? "/interview-type" : "/login" },
    { label: "Student Guide", to: isLoggedIn ? "/account?tab=profile" : "/login" },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-white/90 backdrop-blur-md border-b border-gray-100 transition-colors">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        {/* Brandmark with Logo Animation */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white shadow-md shadow-primary/20 logo-hover">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-950">
            Interview<span className="text-primary font-extrabold">Spar</span>
          </span>
          <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200/60 px-2 py-0.5 rounded-full ml-1">
            Student Edition
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to
            return (
              <Link
                key={link.label}
                to={link.to}
                className={`relative text-sm font-medium transition-all ${
                  isActive
                    ? "text-primary after:absolute after:-bottom-1 after:left-0 after:w-full after:h-0.5 after:bg-primary after:rounded-full font-semibold"
                    : "text-gray-600 hover:text-gray-950 hover:-translate-y-0.5"
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* Action Buttons */}
        <div className="hidden md:flex items-center gap-4">
          {isLoggedIn ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-primary hover:bg-[#5b22e0] px-5 py-2.5 rounded-full transition-all shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5"
            >
              <span>Candidate Dashboard</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-semibold text-gray-700 hover:text-gray-950 px-3 py-1.5 transition-colors"
              >
                Log In
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-primary hover:bg-[#5b22e0] px-5 py-2.5 rounded-full transition-all shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5"
              >
                <span>Get Started Free</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 text-gray-600 hover:text-gray-900 rounded-lg focus:outline-none"
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

      {/* Mobile Drawer */}
      {open && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-b border-gray-100 px-6 py-5 space-y-3 animate-modal-pop shadow-xl">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to
            return (
              <Link
                key={link.label}
                to={link.to}
                className={`block text-sm font-medium py-1.5 ${
                  isActive ? "text-primary font-bold" : "text-gray-700"
                }`}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            )
          })}
          <hr className="border-gray-100 my-2" />
          {isLoggedIn ? (
            <Link
              to="/dashboard"
              className="block text-center text-sm font-bold text-white bg-primary hover:bg-[#5b22e0] px-5 py-2.5 rounded-full transition-all"
              onClick={() => setOpen(false)}
            >
              Candidate Dashboard
            </Link>
          ) : (
            <div className="flex flex-col gap-2 pt-1">
              <Link
                to="/login"
                className="block text-center text-sm font-semibold text-gray-800 bg-gray-50 py-2 rounded-xl"
                onClick={() => setOpen(false)}
              >
                Log In
              </Link>
              <Link
                to="/signup"
                className="block text-center text-sm font-bold text-white bg-primary hover:bg-[#5b22e0] py-2.5 rounded-xl transition-all shadow-md"
                onClick={() => setOpen(false)}
              >
                Get Started Free
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
