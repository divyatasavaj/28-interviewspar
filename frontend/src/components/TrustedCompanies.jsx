const companies = ["ALPHA", "QUANTUM", "NEBULA", "VORTEX", "HORIZON"]

export default function TrustedCompanies() {
  return (
    <section className="py-16 px-6 bg-white">
      <div className="max-w-5xl mx-auto text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-gray-400 mb-10">
          TRUSTED BY CANDIDATES FROM TOP TECH COMPANIES
        </p>
        <div className="flex flex-wrap justify-center gap-12 md:gap-20">
          {companies.map((name) => (
            <span
              key={name}
              className="text-lg font-bold tracking-widest text-gray-300"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
