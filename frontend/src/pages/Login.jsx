import { useState } from "react"
import AuthLayout from "../components/AuthLayout"
import { Link, useNavigate } from "react-router-dom"
import { login, setToken } from "../api/auth"

export default function Login() {
  const navigate = useNavigate()
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
    setBusy(true)
    try {
      const data = await login(email, password)
      setToken(data.token)
      navigate("/dashboard")
    } catch (err) {
      if (err.message === "No user found with this email") {
        setError("no_user")
      } else {
        setError(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
          <h1 className="text-3xl font-extrabold text-gray-900">Pick up your practice.</h1>
          <p className="text-gray-500 mt-2 mb-8">Your interviews, resume and next steps are waiting.</p>

          {error === "no_user" ? (
            <div role="alert" className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-3 mb-6">
              No user found with this email.{" "}
              <Link to="/signup" className="font-semibold underline hover:text-amber-800">
                Sign up
              </Link>{" "}
              to create an account.
            </div>
          ) : error ? (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-6">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                id="login-email"
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
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                id="login-password"
                name="password"
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="spar-button w-full"
            >
              {busy ? "Signing in…" : "Log In"}
            </button>
          </form>

          <div className="flex items-center justify-between mt-8">
            <p className="text-sm text-gray-500">
              No account?{" "}
              <Link to="/signup" className="font-semibold text-primary hover:text-[#075985]">
                Sign up
              </Link>
            </p>
          </div>
    </AuthLayout>
  )
}
