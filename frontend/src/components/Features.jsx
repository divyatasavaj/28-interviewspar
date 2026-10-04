import FeatureCard from "./FeatureCard"

const features = [
  {
    iconBg: "bg-blue-50 text-blue-600 border border-blue-100",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
      </svg>
    ),
    badge: "Voice & Behavioral",
    title: "Campus & Tech Mock Interviews",
    description:
      "Practice realistic conversational interviews with adaptive questions covering DSA, systems design, and behavioral STAR stories.",
  },
  {
    iconBg: "bg-indigo-50 text-indigo-600 border border-indigo-100",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    badge: "Resume Verification",
    title: "Project-Specific Deep Dives",
    description:
      "Upload your college projects and resume to be cross-examined on your actual tech stack, architectural choices, and contributions.",
  },
  {
    iconBg: "bg-emerald-50 text-emerald-600 border border-emerald-100",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    badge: "Diagnostic Scorecard",
    title: "Granular Feedback & Rubrics",
    description:
      "Receive executive-grade evaluation on problem-solving rigor, verbal articulation, and concise action steps before your placement day.",
  },
]

export default function Features() {
  return (
    <section className="py-20 md:py-28 px-6 bg-gradient-to-b from-white via-slate-50/40 to-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.15em] text-primary uppercase bg-purple-50 border border-purple-100/60 px-3.5 py-1.5 rounded-full mb-4">
            Designed for Student Success
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-gray-900">
            Engineered For Placement Confidence.
          </h2>
          <p className="mt-4 text-gray-600 text-base md:text-lg">
            Bridge the gap between academic theory and real-world campus recruitment with tailored practice sessions.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </div>
    </section>
  )
}
