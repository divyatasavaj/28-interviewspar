export default function FeatureCard({ iconBg, icon, badge, title, description }) {
  return (
    <div className="group relative bg-white rounded-3xl p-8 border border-gray-100 shadow-sm hover:shadow-xl hover:border-purple-200 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-6">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${iconBg}`}
          >
            {icon}
          </div>
          {badge && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border border-gray-200/60 px-2.5 py-1 rounded-full group-hover:text-primary group-hover:bg-purple-50 group-hover:border-purple-100 transition-colors">
              {badge}
            </span>
          )}
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
      </div>
      <div className="mt-6 pt-5 border-t border-gray-50 flex items-center text-xs font-semibold text-primary">
        <span>Explore module</span>
        <svg
          className="w-4 h-4 ml-1.5 transform transition-transform duration-200 group-hover:translate-x-1"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  )
}
