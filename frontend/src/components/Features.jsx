import FeatureCard from "./FeatureCard"

const features = [
  {
    iconBg: "bg-blue-100 text-blue-600",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    title: "AI Interview Practice",
    description:
      "Experience conversational AI that understands role, technical depth, and industry-specific context. Practice as many times as you need.",
  },
  {
    iconBg: "bg-emerald-100 text-emerald-600",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    title: "Coding Assessment",
    description:
      "Integrated IDE with real-time feedback on time complexity, edge cases, and code style. Master LeetCode-style challenges effortlessly.",
  },
  {
    iconBg: "bg-amber-100 text-amber-600",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "Detailed Reports",
    description:
      "Receive granular feedback on your speaking patterns, body language (optional), and content accuracy with scorecards and improvement paths.",
  },
]

export default function Features() {
  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block text-xs font-semibold tracking-[0.15em] text-primary bg-purple-50 px-4 py-1.5 rounded-full mb-5">
            FEATURES
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900">
            Precision Engineered Prep.
          </h2>
          <p className="mt-4 text-gray-500 text-lg">
            Elevate your performance with tools designed to mimic the intensity and nuance of a real elite-tech interview.
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
