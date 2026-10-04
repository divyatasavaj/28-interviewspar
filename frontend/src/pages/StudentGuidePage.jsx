import { useState } from "react"
import { Link } from "react-router-dom"
import Navbar from "../components/Navbar"

const guidePhases = [
  {
    phase: "Phase 01",
    title: "Resume & Project Presentation",
    tag: "Pre-Interview",
    summary: "How to position your university projects to pass ATS filters and survive engineer scrutiny.",
    tips: [
      {
        heading: "Quantify Impact Over Generic Task Descriptions",
        detail: "Instead of writing 'Built a real-time chat application using React', write: 'Engineered an event-driven chat system handling 500+ simulated concurrent connections via WebSockets, reducing message delivery latency from 1.2s to 180ms.'",
      },
      {
        heading: "Know Every Library You Imported",
        detail: "Recruiters frequently ask freshers: 'Why did you use Redux instead of Context API?' or 'Why Axios instead of fetch?'. Be prepared to defend the necessity of every third-party package on your GitHub.",
      },
      {
        heading: "Highlight Academic Capstone & Open Source",
        detail: "If you have limited corporate internship experience, elevate your final year capstone project or pull requests to open-source libraries. Detail your individual contribution clearly.",
      },
    ],
  },
  {
    phase: "Phase 02",
    title: "Mastering the STAR Behavioral Method",
    tag: "HR & Culture Round",
    summary: "Structure your answers cleanly: Situation, Task, Action, Result. Keep answers between 90 and 120 seconds.",
    tips: [
      {
        heading: "Situation & Task (20% of your time)",
        detail: "Briefly set the context. Explain the college team setup, the problem faced, and your specific role or assignment within the group.",
      },
      {
        heading: "Action (60% of your time)",
        detail: "The meat of your answer. Focus exclusively on 'I', not 'we'. Detail how you diagnosed the issue, what tools you evaluated, and the exact steps you executed to overcome the obstacle.",
      },
      {
        heading: "Result (20% of your time)",
        detail: "Always conclude with a measurable outcome or key learning. Even if the project didn't win the hackathon, discuss what metric you improved or how the architecture became resilient.",
      },
    ],
  },
  {
    phase: "Phase 03",
    title: "Cracking Technical & System Rounds",
    tag: "Core Technical",
    summary: "Interviewers care more about your problem-solving process and trade-off reasoning than instant memorized code.",
    tips: [
      {
        heading: "Think Out Loud & Clarify Constraints",
        detail: "Never start coding immediately. Clarify edge cases: 'Are negative integers possible?', 'Can the array fit entirely in memory?', 'Is this read-heavy or write-heavy?'. This proves engineering maturity.",
      },
      {
        heading: "Start With Brute Force, Then Optimize",
        detail: "State the naive O(N²) approach first to establish a baseline. Then discuss where the bottleneck is (redundant scans, lack of indexing) and propose an optimized O(N log N) or O(N) strategy.",
      },
      {
        heading: "Articulate Trade-Offs Transparently",
        detail: "Engineering is all about trade-offs. Explicitly mention: 'Using an in-memory hash set gives us O(1) lookups, but incurs an extra O(N) auxiliary space overhead.'",
      },
    ],
  },
  {
    phase: "Phase 04",
    title: "Day-of-Interview Protocol",
    tag: "Execution & Presence",
    summary: "Tactical guidelines for managing nerves, vocal pacing, and video presence.",
    tips: [
      {
        heading: "Regulate Speaking Pacing",
        detail: "Nervous candidates tend to speak too fast. Aim for a measured 130-150 words per minute. Pausing for 2-3 seconds to collect your thoughts before answering is considered a sign of composure, not hesitation.",
      },
      {
        heading: "Ask Thoughtful Reverse Questions",
        detail: "When the interviewer asks 'Do you have questions for us?', avoid trivial questions. Ask: 'What does a typical day look like for a new-grad software engineer in your squad during their first 90 days?'.",
      },
      {
        heading: "Maintain Camera Gaze & Lighting",
        detail: "Look directly into the camera lens when answering to simulate natural eye contact. Ensure your face is illuminated from the front rather than backlit by a window.",
      },
    ],
  },
]

const faqs = [
  {
    q: "How many mock interviews should I take before campus placement week?",
    a: "We recommend at least 4 to 6 sessions: 2 HR/STAR rounds to iron out pacing and vocal clarity, and 3 to 4 technical rounds to get comfortable with unscripted follow-up questions.",
  },
  {
    q: "Can I practice if I don't have a completed resume yet?",
    a: "Yes! InterviewSpar offers a Standard Placement Baseline mode that runs calibration questions on fundamental engineering and behavioral topics without requiring a resume file.",
  },
  {
    q: "What if the AI asks a question I don't know the answer to?",
    a: "Do not guess or fabricate information. Be honest: 'I haven't worked with that specific message broker in production, but conceptually I understand pub/sub architecture and would approach it by...'. The AI rewards structural reasoning over fake confidence.",
  },
  {
    q: "Can I share my scorecards with my university placement cell?",
    a: "Yes. Every completed mock session generates an executive evaluation scorecard with an instant 'Export Scorecard PDF' button formatted cleanly for submission.",
  },
]

export default function StudentGuidePage() {
  const [openFaq, setOpenFaq] = useState(null)

  return (
    <div className="min-h-screen bg-[#fbfaff] font-sans">
      <Navbar />

      <main className="pt-32 pb-24 px-4 sm:px-6 md:px-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] text-primary uppercase bg-purple-50 border border-purple-100/70 px-3.5 py-1.5 rounded-full mb-4">
            University Placement Playbook
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.1]">
            The Student's Guide To <span className="text-primary">Acing Tech Interviews</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            A comprehensive roadmap engineered for university students and fresh graduates preparing for campus recruitments and off-campus tech drives.
          </p>
        </div>

        {/* Phase Breakdown */}
        <div className="space-y-12 mb-20">
          {guidePhases.map((phase) => (
            <div
              key={phase.phase}
              className="bg-white rounded-3xl p-6 sm:p-10 border border-gray-100 shadow-sm hover:shadow-lg transition-shadow"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black tracking-widest text-primary uppercase bg-purple-50 px-3 py-1 rounded-full">
                    {phase.phase}
                  </span>
                  <h2 className="text-2xl font-bold text-gray-900">{phase.title}</h2>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border border-gray-200/60 px-2.5 py-1 rounded-full">
                  {phase.tag}
                </span>
              </div>

              <p className="text-sm text-gray-600 mb-6 italic">{phase.summary}</p>

              <div className="space-y-4">
                {phase.tips.map((tip, i) => (
                  <div key={i} className="bg-slate-50/70 rounded-2xl p-5 border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 mb-1.5 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>{tip.heading}</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 leading-relaxed pl-3.5">
                      {tip.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <section className="bg-white rounded-3xl p-6 sm:p-10 border border-gray-100 shadow-sm mb-16">
          <div className="text-center max-w-xl mx-auto mb-8">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-purple-50 px-3 py-1 rounded-full">
              Frequently Asked Questions
            </span>
            <h3 className="text-2xl font-bold text-gray-900 mt-3">Campus Placement Queries</h3>
          </div>

          <div className="divide-y divide-gray-100">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i
              return (
                <div key={i} className="py-4">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full text-left flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-gray-900 hover:text-primary transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transform transition-transform duration-200 flex-shrink-0 ${
                        isOpen ? "rotate-180 text-primary" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-xs sm:text-sm text-gray-600 leading-relaxed pr-8 animate-fade-in">
                      {faq.a}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Ready to practice CTA */}
        <div className="text-center bg-gradient-to-r from-purple-700 to-indigo-800 text-white rounded-3xl p-8 sm:p-12 shadow-xl">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
            Put Theory Into Practice
          </h2>
          <p className="text-purple-100 text-sm max-w-lg mx-auto mb-6 leading-relaxed">
            Reading guides builds knowledge, but simulation builds confidence. Take an AI mock round right now.
          </p>
          <Link
            to="/interview-type"
            className="inline-flex items-center gap-2 bg-white text-gray-950 hover:bg-gray-100 font-bold text-sm px-8 py-3.5 rounded-full shadow-lg transition-all hover:scale-105"
          >
            <span>Start Simulation Now</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </main>
    </div>
  )
}
