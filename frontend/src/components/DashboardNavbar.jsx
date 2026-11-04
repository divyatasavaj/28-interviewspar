import Brand from "./Brand"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useState } from "react"
import { logout } from "../api/auth"

export default function DashboardNavbar({ name }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  async function handleLogout() {
    try { await logout(); } catch { /* Local token is cleared even when offline. */ } finally { navigate("/login"); }
  }

  const navLinks = [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Resume Intelligence", to: "/resume-intelligence" },
    { label: "New Interview", to: "/interview-type" },
    { label: "Resume", to: "/account?tab=resume" },
    { label: "Reports", to: "/account?tab=reports" },
    { label: "Account", to: "/account?tab=profile" },
  ]

  return (
    <nav className="workspace-nav fixed top-0 left-0 right-0 z-50 h-[72px] bg-white/90 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        <Brand to="/dashboard"/>

        <div className="hidden xl:flex items-center gap-5">
          {navLinks.map((link) => {
            const isActive = location.pathname + location.search === link.to || (link.to === "/dashboard" && location.pathname === "/dashboard")
            return (
              <Link
                key={link.label}
                to={link.to}
                className={`relative text-xs font-semibold transition-all py-1 ${
                  isActive
                    ? "text-primary after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-primary after:rounded-full"
                    : "text-gray-600 hover:text-gray-900 hover:-translate-y-0.5"
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        <div className="hidden xl:flex items-center gap-4">
          <Link
            to="/interview-type"
            className="text-xs font-semibold bg-primary hover:bg-[#075985] text-white px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-all flex items-center gap-2 hover:-translate-y-0.5"
          >

            <span>New interview</span>
          </Link>

          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              aria-label="Account menu"
              aria-expanded={profileOpen}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-sky-600 border-2 border-white shadow-sm flex items-center justify-center text-white text-sm font-bold cursor-pointer hover:shadow-md hover:scale-105 transition-all"
            >
              {name ? name.charAt(0).toUpperCase() : "U"}
            </button>
            {profileOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 py-2.5 z-20 transition-all animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-bold text-gray-900 truncate">{name}</p>
                    <p className="text-[11px] text-gray-400 font-medium">Your workspace</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { setProfileOpen(false); navigate("/account?tab=profile") }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>Candidate Profile</span>
                    </button>
                    <button
                      onClick={() => { setProfileOpen(false); navigate("/resume-intelligence") }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                      <span>Resume Intelligence</span>
                    </button>
                    <button
                      onClick={() => { setProfileOpen(false); navigate("/account?tab=resume") }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Resume & Projects</span>
                    </button>
                    <button
                      onClick={() => { setProfileOpen(false); navigate("/account?tab=reports") }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span>Evaluation Reports</span>
                    </button>
                    <button
                      onClick={() => { setProfileOpen(false); navigate("/account?tab=preferences") }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Voice & Preferences</span>
                    </button>
                  </div>
                  <hr className="border-gray-100 my-1" />
                  <button
                    onClick={() => { setProfileOpen(false); handleLogout() }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2.5"
                  >
                    <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Sign out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="xl:hidden p-2 text-gray-600"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
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
        <div className="xl:hidden bg-white border-b border-gray-100 px-6 pb-6 space-y-3">
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
