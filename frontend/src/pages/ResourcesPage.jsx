import { useState } from "react"
import Navbar from "../components/Navbar"

export default function ResourcesPage() {
  const [selectedCategory, setSelectedCategory] = useState("all")

  const categories = [
    { id: "all", label: "All Resources" },
    { id: "star", label: "STAR Framework" },
    { id: "system-design", label: "System Design" },
    { id: "algorithms", label: "DSA & Coding" },
    { id: "behavioral", label: "Behavioral & HR" },
  ]

  const resources = [
    {
      category: "star",
      title: "The Comprehensive STAR Method Guide",
      description: "Master structuring answers for Situation, Task, Action, and Result questions to prevent rambling and score high on delivery metrics.",
      readTime: "6 min read",
      tags: ["Behavioral", "Interview Prep", "STAR"],
      download: "Download PDF Cheat Sheet",
    },
    {
      category: "system-design",
      title: "System Design Blueprint: Scalability & Caching",
      description: "How to tackle architecture questions: clarifying requirements, defining functional vs non-functional constraints, and evaluating latency vs consistency trade-offs.",
      readTime: "12 min read",
      tags: ["Architecture", "System Design", "Scalability"],
      download: "Architecture Template",
    },
    {
      category: "algorithms",
      title: "Technical Coding Challenge Strategies",
      description: "A step-by-step checklist for communicating thought processes during live coding, test case execution, and optimizing time-space complexity.",
      readTime: "8 min read",
      tags: ["DSA", "Complexity", "Coding"],
      download: "Algorithm Patterns Summary",
    },
    {
      category: "behavioral",
      title: "Handling High-Stakes HR & Culture Questions",
      description: "Best practices for conflict resolution, leadership examples, and explaining past employment transitions objectively without negative sentiment.",
      readTime: "5 min read",
      tags: ["HR Round", "Culture Fit", "Communication"],
      download: "HR Question Bank",
    },
    {
      category: "system-design",
      title: "Microservices vs Monolith Trade-off Matrix",
      description: "Detailed breakdown of database consistency, message queues, rate-limiting, and circuit breaker patterns in modern distributed environments.",
      readTime: "10 min read",
      tags: ["Backend", "Microservices", "Reliability"],
      download: "Trade-off Matrix",
    },
    {
      category: "star",
      title: "Filler Words & Delivery Diagnostics",
      description: "Understanding your verbal fluency metrics: reducing filler words ('um', 'like', 'you know'), managing pause cadence, and speaking with clarity.",
      readTime: "4 min read",
      tags: ["Speech", "Fluency", "Delivery"],
      download: "Fluency Drill Audio",
    },
  ]

  const filtered = selectedCategory === "all"
    ? resources
    : resources.filter((r) => r.category === selectedCategory)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 pt-28 pb-16 px-6 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
            Study Guides & Documentation
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
            Interview Preparation <span className="text-primary">Resources</span>
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Curated frameworks, cheat sheets, and architectural guides to help you excel in both technical and behavioral interview sparring.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2.5 mb-10">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                selectedCategory === c.id
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-gray-400 mb-3 font-medium">
                  <span className="uppercase tracking-wider text-primary font-bold">
                    {item.category.replace("-", " ")}
                  </span>
                  <span>{item.readTime}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2 leading-snug">
                  {item.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">
                  {item.description}
                </p>
              </div>

              <div>
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => alert(`Starting download for: ${item.title}`)}
                  className="w-full text-center text-xs font-bold text-primary hover:text-white bg-primary/10 hover:bg-primary py-2.5 rounded-xl transition-all"
                >
                  {item.download}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
