import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { signup, setToken } from "../api/auth"

export default function Signup() {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  function isValidEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address")
      return
    }
    if (password.length > 72) {
      setError("Password must be 72 characters or less")
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }
    try {
      const data = await signup(name, email, password)
      setToken(data.access_token)
      navigate("/dashboard")
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-white flex">
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-purple-50 to-white items-center justify-center p-12">
        <div className="max-w-sm">
          <Link to="/" className="text-2xl font-extrabold tracking-tight">
            <span className="text-gray-900">Interview</span>
            <span className="text-primary">Spar</span>
          </Link>
          <h2 className="text-3xl font-extrabold text-gray-900 mt-12 leading-tight">
            Start practicing with AI.
          </h2>
          <p className="text-gray-500 mt-4 leading-relaxed">
            Get unlimited interview practice with real-time AI feedback tailored to your skills.
          </p>
          <div className="mt-8 flex -space-x-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-br from-purple-300 to-purple-500 shadow-sm"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between mb-8 sm:mb-10">
            <Link to="/" className="lg:hidden text-2xl font-extrabold tracking-tight">
              <span className="text-gray-900">Interview</span>
              <span className="text-primary">Spar</span>
            </Link>
            <Link
              to="/"
              className="inline-flex lg:inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
          </div>

          <h1 className="text-3xl font-extrabold text-gray-900">Create account</h1>
          <p className="text-gray-500 mt-2 mb-8">Start your interview practice today.</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-primary hover:bg-[#5b22e0] text-white font-semibold py-3 rounded-2xl shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/25"
            >
              Sign Up
            </button>
          </form>

          <div className="flex items-center justify-between mt-8">
            <p className="text-sm text-gray-500">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-primary hover:text-[#5b22e0]">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
