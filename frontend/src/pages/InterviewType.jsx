import { useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { getMe, clearToken } from "../api/auth"
import DashboardNavbar from "../components/DashboardNavbar"

const types = [
  {
    id: "hr",
    title: "HR / Behavioral",
    subtitle: "Behavioral Interview",
    description:
      "Practice common HR questions, behavioral scenarios, and situational responses. Perfect for mastering the 'Tell me about yourself' and STAR method.",
    features: ["Common HR questions", "STAR method coaching", "Situational scenarios", "Culture fit assessment"],
    gradient: "from-purple-500 to-purple-700",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: "technical",
    title: "Technical",
    subtitle: "Technical Interview",
    description:
      "Tackle system design challenges, coding problems, and technical deep-dives tailored to your target role and experience level.",
    features: ["System design questions", "Coding challenges", "Tech stack deep-dives", "Architecture discussions"],
    gradient: "from-blue-500 to-blue-700",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
]

export default function InterviewType() {
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

      <section className="pt-36 pb-20 md:pt-44 md:pb-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-full px-4 py-1.5 text-xs font-semibold text-primary mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Choose Your Interview Type
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900">
              What kind of interview <span className="text-primary">are you preparing for?</span>
            </h1>
            <p className="mt-4 text-gray-500 max-w-xl mx-auto">
              Select the interview style you want to practice. Each type is tailored to simulate real interview conditions.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            {types.map((type) => (
              <button
                key={type.id}
                onClick={() => navigate(`/interview?type=${type.id}`)}
                className="group text-left bg-white rounded-3xl shadow-sm border border-gray-100 p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${type.gradient} flex items-center justify-center text-white shadow-lg mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  {type.icon}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">{type.title}</h2>
                <p className="text-sm text-primary font-semibold mb-4">{type.subtitle}</p>
                <p className="text-sm text-gray-500 leading-relaxed mb-6">{type.description}</p>
                <ul className="space-y-2">
                  {type.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
