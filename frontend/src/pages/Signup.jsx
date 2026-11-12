import { useState } from "react"
import AuthLayout from "../components/AuthLayout"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { signup, setToken } from "../api/auth"

export default function Signup() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  function isValidEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (busy) return
    setError("")
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address")
      return
    }
    if (password.length > 72) {
      setError("Password must be 72 characters or less")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    setBusy(true)
    try {
      const data = await signup(name, email, password)
      setToken(data.token)
      navigate(state?.returnTo || "/dashboard", { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
          <h1 className="text-3xl font-extrabold text-gray-900">Your first step starts here.</h1>
          <p className="text-gray-500 mt-2 mb-8">Create your account and make room for a little practice.</p>

          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="signup-name" className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input
                id="signup-name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={120}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                id="signup-email"
                name="email"
                autoComplete="username"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                id="signup-password"
                name="password"
                autoComplete="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                aria-describedby="signup-password-help"
                minLength={8}
                maxLength={72}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <p id="signup-password-help" className="text-xs text-gray-500">Use at least 8 characters (up to 72).</p>
            <button
              type="submit"
              disabled={busy}
              className="spar-button w-full"
            >
              {busy ? "Creating account…" : "Sign Up"}
            </button>
          </form>

          <div className="flex items-center justify-between mt-8">
            <p className="text-sm text-gray-500">
              Already have an account?{" "}
              <Link to="/login" state={state} className="font-semibold text-primary hover:underline">
                Log in
              </Link>
            </p>
          </div>
    </AuthLayout>
  )
}
