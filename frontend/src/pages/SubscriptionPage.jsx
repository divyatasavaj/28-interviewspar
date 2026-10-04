import { useState } from "react"
import { useNavigate } from "react-router-dom"
import Navbar from "../components/Navbar"
import { getToken } from "../api/auth"

const plans = [
  {
    id: "free",
    name: "Campus Starter",
    badge: "Free Trial",
    description: "Ideal for freshers getting introduced to AI mock interviews and vocal calibration.",
    monthlyPrice: 0,
    annualPrice: 0,
    popular: false,
    ctaText: "Start Free Practice",
    features: [
      "2 Full AI Mock Interviews / month",
      "Standard HR behavioral questions",
      "Basic STAR feedback metrics",
      "Standard text & audio response mode",
      "Web-only scorecard viewing",
    ],
    notIncluded: [
      "Project & resume deep interrogation",
      "Neural voice persona customization",
      "Printable PDF scorecards for placement cells",
      "Attention & fluency camera analytics",
    ],
  },
  {
    id: "pro",
    name: "Placement Sprint",
    badge: "Most Popular For Students",
    description: "Engineered for university students actively preparing for campus drives and off-campus tech rounds.",
    monthlyPrice: 15,
    annualPrice: 9,
    popular: true,
    ctaText: "Upgrade to Placement Sprint",
    features: [
      "Unlimited AI Behavioral & Technical Rounds",
      "Contextual Resume & GitHub Project Cross-Examination",
      "Ultra-Natural Neural Speech Engine (Ava, Andrew, Emma, Brian)",
      "Custom voice pacing & pitch adjustments",
      "Printable executive PDF scorecards",
      "Attention, fluency & hesitation video analytics",
      "Priority AI evaluation processing queue",
    ],
    notIncluded: [
      "Multi-seat cohort management",
    ],
  },
  {
    id: "cohort",
    name: "University Cohort",
    badge: "For Colleges & Placement Cells",
    description: "Designed for engineering colleges, bootcamp batches, and student training & placement cells.",
    monthlyPrice: 49,
    annualPrice: 35,
    popular: false,
    ctaText: "Contact Placement Sales",
    features: [
      "All Placement Sprint features for up to 50 students",
      "Centralized student readiness dashboard for T&P officers",
      "Custom university interview rubric & question bank",
      "Batch performance analytics and exportable CSVs",
      "LMS & college portal webhook integration",
      "Dedicated account manager & setup support",
    ],
    notIncluded: [],
  },
]

const comparisonFeatures = [
  { name: "Monthly Mock Interviews", free: "2 sessions", pro: "Unlimited", cohort: "Unlimited (50 seats)" },
  { name: "Human-Quality Neural TTS", free: "Standard only", pro: "All 4 personas + modulation", cohort: "All 4 personas + modulation" },
  { name: "Resume & Project Parser", free: "No", pro: "Yes (Unlimited uploads)", cohort: "Yes (Unlimited uploads)" },
  { name: "STAR Method Scoring", free: "Basic", pro: "Detailed breakdown & quotes", cohort: "Detailed breakdown & quotes" },
  { name: "Executive PDF Exports", free: "No", pro: "Yes (Print-ready)", cohort: "Yes (Bulk batch export)" },
  { name: "Live Camera & Eye Gaze Analytics", free: "No", pro: "Yes (Privacy on-device)", cohort: "Yes (Privacy on-device)" },
  { name: "Placement Cell Admin Portal", free: "No", pro: "No", cohort: "Yes (Centralized dashboard)" },
]

const faqs = [
  {
    q: "Is there a special discount for college students?",
    a: "Yes! Our annual billing includes an automatic 40% student scholarship discount. If your university has an official partnership with InterviewSpar, check with your campus Training & Placement Cell for free cohort access.",
  },
  {
    q: "Can I cancel my subscription after my campus placement week?",
    a: "Absolutely. You can cancel your subscription at any time with one click from your Account portal. You will retain full access until the end of your billing cycle.",
  },
  {
    q: "What payment methods are supported?",
    a: "We support all major credit cards, debit cards, UPI, Google Pay, Apple Pay, and net banking through secure encrypted payment processing.",
  },
  {
    q: "Can I download my scorecards if I cancel?",
    a: "Yes. All previously generated PDF evaluation scorecards and past performance history remain accessible in your account even after cancellation.",
  },
]

export default function SubscriptionPage() {
  const [annualBilling, setAnnualBilling] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false)
  const navigate = useNavigate()

  function handleSelectPlan(plan) {
    const isAuth = Boolean(getToken())
    if (!isAuth) {
      navigate("/login")
      return
    }
    if (plan.id === "free") {
      navigate("/dashboard")
      return
    }
    setSelectedPlan(plan)
    setCheckoutModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-[#fbfaff] font-sans">
      <Navbar />

      <main className="pt-32 pb-24 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] text-primary uppercase bg-purple-50 border border-purple-100/70 px-3.5 py-1.5 rounded-full mb-4">
            Transparent Pricing
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.1]">
            Invest In Your <span className="text-primary">Campus Placement</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed">
            Designed specifically with affordable student pricing in mind. Master behavioral and technical rounds before facing real recruiters.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 bg-white p-1.5 rounded-full border border-gray-200 shadow-xs">
            <button
              onClick={() => setAnnualBilling(false)}
              className={`text-xs font-semibold px-5 py-2 rounded-full transition-all cursor-pointer ${
                !annualBilling
                  ? "bg-gray-900 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setAnnualBilling(true)}
              className={`text-xs font-semibold px-5 py-2 rounded-full transition-all cursor-pointer flex items-center gap-2 ${
                annualBilling
                  ? "bg-primary text-white shadow-sm shadow-primary/30"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <span>Annual Semester Pass</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-400 text-emerald-950 px-2 py-0.5 rounded-full">
                Save 40%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-20 items-stretch">
          {plans.map((plan) => {
            const price = annualBilling ? plan.annualPrice : plan.monthlyPrice
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 ${
                  plan.popular
                    ? "border-2 border-primary shadow-xl md:-translate-y-2 ring-4 ring-primary/10"
                    : "border border-gray-100 shadow-sm hover:shadow-lg"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-md">
                    {plan.badge}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                    {!plan.popular && (
                      <span className="text-[10px] font-semibold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
                        {plan.badge}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 min-h-[36px] leading-relaxed mb-6">
                    {plan.description}
                  </p>

                  <div className="mb-6 pb-6 border-b border-gray-100 flex items-baseline gap-1.5">
                    <span className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
                      ${price}
                    </span>
                    <span className="text-xs text-gray-500 font-medium">
                      / student {plan.monthlyPrice === 0 ? "forever" : "per month"}
                    </span>
                    {annualBilling && plan.monthlyPrice > 0 && (
                      <span className="text-[10px] text-emerald-600 font-semibold block ml-1">
                        billed annually
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 mb-8">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Included Features</p>
                    {plan.features.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs text-gray-700">
                        <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{feat}</span>
                      </div>
                    ))}

                    {plan.notIncluded.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs text-gray-400 opacity-60">
                        <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="line-through">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full py-3.5 px-4 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      plan.popular
                        ? "bg-primary hover:bg-[#5b22e0] text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
                        : "bg-gray-50 hover:bg-gray-100 text-gray-900 border border-gray-200/80"
                    }`}
                  >
                    <span>{plan.ctaText}</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Feature Comparison Table */}
        <section className="bg-white rounded-3xl p-6 sm:p-10 border border-gray-100 shadow-sm mb-20">
          <div className="text-center max-w-xl mx-auto mb-10">
            <h3 className="text-2xl font-bold text-gray-900">Compare Plan Capabilities</h3>
            <p className="text-xs text-gray-500 mt-1">Detailed feature matrix across individual and campus tiers</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-3 px-4 font-bold text-gray-400 uppercase text-[10px] tracking-wider">Features</th>
                  <th className="py-3 px-4 font-bold text-gray-900">Campus Starter</th>
                  <th className="py-3 px-4 font-bold text-primary">Placement Sprint</th>
                  <th className="py-3 px-4 font-bold text-gray-900">University Cohort</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-700">
                {comparisonFeatures.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-gray-900">{row.name}</td>
                    <td className="py-3.5 px-4 text-gray-500">{row.free}</td>
                    <td className="py-3.5 px-4 font-semibold text-primary">{row.pro}</td>
                    <td className="py-3.5 px-4 text-gray-600">{row.cohort}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="max-w-3xl mx-auto mb-16">
          <div className="text-center mb-8">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-purple-50 px-3 py-1 rounded-full">
              Subscription Support
            </span>
            <h3 className="text-2xl font-bold text-gray-900 mt-2">Billing & Access Questions</h3>
          </div>

          <div className="space-y-4">
            {faqs.map((f, i) => (
              <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
                <h4 className="text-sm font-bold text-gray-900 mb-1">{f.q}</h4>
                <p className="text-xs text-gray-600 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Student Guarantee Banner */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-3xl p-8 text-center max-w-3xl mx-auto">
          <h4 className="text-lg font-bold text-gray-900">100% Student Placement Guarantee</h4>
          <p className="text-xs text-gray-600 mt-2 max-w-lg mx-auto leading-relaxed">
            If you practice regularly and complete all recommended modules without noticing substantial improvement in your interview composure, reach out to our team within 14 days for a full refund.
          </p>
        </div>
      </main>

      {/* Simulated Checkout Modal */}
      {checkoutModalOpen && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Confirm Subscription</h3>
                <p className="text-xs text-gray-500">{selectedPlan.name} • {annualBilling ? "Annual Billing" : "Monthly Billing"}</p>
              </div>
              <button
                onClick={() => setCheckoutModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="py-6 space-y-4">
              <div className="bg-purple-50/70 p-4 rounded-2xl flex items-center justify-between border border-purple-100">
                <span className="text-xs font-semibold text-purple-900">Total Billed Today:</span>
                <span className="text-2xl font-black text-primary">
                  ${annualBilling ? selectedPlan.annualPrice * 12 : selectedPlan.monthlyPrice}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed text-center">
                Instant activation of unlimited mock interviews, neural voice customization, and executive scorecards.
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => {
                  setCheckoutModalOpen(false)
                  navigate("/dashboard")
                }}
                className="w-full bg-primary hover:bg-[#5b22e0] text-white font-bold text-xs py-3.5 rounded-full shadow-md shadow-primary/25 transition-all"
              >
                Activate Student Plan Now
              </button>
              <button
                onClick={() => setCheckoutModalOpen(false)}
                className="w-full text-xs font-medium text-gray-500 hover:text-gray-800 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
