import { useEffect, useState, useRef } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { getMe, clearToken, startInterview, answerInterview } from "../api/auth"
import DashboardNavbar from "../components/DashboardNavbar"

export default function Interview() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [user, setUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const chatEnd = useRef(null)
  const type = searchParams.get("type")

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => {
        clearToken()
        navigate("/login")
      })
  }, [navigate])

  useEffect(() => {
    if (!type || !user) return
    startInterview(type)
      .then((data) => {
        setSessionId(data.session_id)
        setMessages([{ role: "assistant", content: data.question }])
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [type, user])

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!input.trim() || submitting) return

    const answer = input.trim()
    setInput("")
    setSubmitting(true)
    setError("")
    setMessages((prev) => [...prev, { role: "user", content: answer }])

    try {
      const data = await answerInterview(sessionId, answer)
      if (data.status === "completed") {
        navigate(`/interview-complete?session_id=${sessionId}`)
        return
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.question }])
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen font-sans flex flex-col" style={{ background: "#faf8ff" }}>
      <DashboardNavbar name={user.name} />

      <section className="flex-1 pt-28 pb-6 px-4 md:px-6 max-w-4xl mx-auto w-full flex flex-col">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-full px-4 py-1.5 text-xs font-semibold text-primary mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {type === "hr" ? "HR / Behavioral Interview" : "Technical Interview"}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">
            Interview <span className="text-primary">Session</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">Answer each question thoughtfully — AI will adapt based on your responses.</p>
        </div>

        <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-100 p-4 md:p-8 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="flex items-center gap-3 text-gray-400">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm font-medium">Starting your interview...</span>
                </div>
              </div>
            )}

            {error && !loading && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-600">{error}</div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-white rounded-br-md"
                      : "bg-gray-50 text-gray-800 rounded-bl-md border border-gray-100"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {submitting && (
              <div className="flex justify-start">
                <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-md px-5 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEnd} />
          </div>

          <form onSubmit={handleSubmit} className="flex items-end gap-3 border-t border-gray-100 pt-4">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
                placeholder="Type your answer... (Enter to send, Shift+Enter for new line)"
                rows={1}
                className="w-full rounded-2xl bg-gray-50 border border-gray-200 px-5 py-3.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                disabled={loading || submitting}
              />
            </div>
            <button
              type="submit"
              disabled={loading || submitting || !input.trim()}
              className="bg-primary hover:bg-[#5b22e0] disabled:opacity-40 text-white font-semibold text-sm px-6 py-3.5 rounded-2xl shadow-md shadow-primary/20 transition-all flex items-center gap-2"
            >
              {submitting ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                </svg>
              )}
              Send
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
