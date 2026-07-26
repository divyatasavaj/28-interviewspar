export default function FeatureCard({ iconBg, icon, title, description }) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl mb-5 ${iconBg}`}
      >
        {icon}
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed mb-6">{description}</p>
      <a
        href="#"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-[#5b22e0] transition-colors"
      >
        Learn more
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  )
}
