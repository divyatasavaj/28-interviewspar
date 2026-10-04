const companies = [
  { name: "Google", domain: "Cloud & SWE" },
  { name: "Microsoft", domain: "Core Systems" },
  { name: "Amazon", domain: "AWS & Backend" },
  { name: "Goldman Sachs", domain: "Fintech & Quant" },
  { name: "Atlassian", domain: "Platform Eng" },
]

export default function TrustedCompanies() {
  return (
    <section className="py-14 px-6 border-y border-gray-100 bg-slate-50/50">
      <div className="max-w-5xl mx-auto text-center">
        <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-gray-400 mb-8">
          Alumni & Students Prepared For Top Placements & Tech Leaders
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
          {companies.map((c) => (
            <div
              key={c.name}
              className="group flex flex-col items-center cursor-default transition-all duration-200 hover:-translate-y-0.5"
            >
              <span className="text-base md:text-lg font-black tracking-tight text-gray-400 group-hover:text-gray-800 transition-colors">
                {c.name}
              </span>
              <span className="text-[10px] font-medium text-gray-400 opacity-60 group-hover:opacity-100 group-hover:text-primary transition-all">
                {c.domain}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
