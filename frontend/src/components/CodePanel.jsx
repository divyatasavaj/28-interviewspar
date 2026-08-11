import { useEffect, useMemo, useState } from "react"
import { getProblems, runCode, checkCodeSimilarity } from "../api/auth"

const LANG_MODES = {
  javascript: "js",
  python: "py",
}

const DIFF_COLORS = {
  easy: "text-green-400",
  medium: "text-yellow-400",
  hard: "text-red-400",
}

export default function CodePanel({ sessionId }) {
  const [problems, setProblems] = useState([])
  const [problemId, setProblemId] = useState("")
  const [language, setLanguage] = useState("javascript")
  const [code, setCode] = useState("")
  const [output, setOutput] = useState(null)
  const [similarity, setSimilarity] = useState(null)
  const [running, setRunning] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState("")

  const problem = useMemo(() => problems.find((p) => p.id === problemId), [problems, problemId])

  useEffect(() => {
    let cancelled = false
    getProblems()
      .then((data) => {
        if (cancelled || !Array.isArray(data) || data.length === 0) return
        setProblems(data)
        setProblemId(data[0].id)
        setCode(data[0].starter?.["javascript"] || "")
      })
      .catch((err) => setError(err.message))
    return () => { cancelled = true }
  }, [])

  function handleProblemChange(id) {
    setProblemId(id)
    setCode("")
    setOutput(null)
    setSimilarity(null)
    setError("")
    const next = problems.find((p) => p.id === id)
    if (next) setCode(next.starter?.[language] || next.starter?.["javascript"] || "")
  }

  function handleLanguageChange(lang) {
    setLanguage(lang)
    if (problem) setCode(problem.starter?.[lang] || problem.starter?.["javascript"] || "")
  }

  async function handleRun() {
    setRunning(true)
    setError("")
    setOutput(null)
    setSimilarity(null)
    try {
      const res = await runCode({ problemId, language, code })
      setOutput(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  async function handleSimilarity() {
    setChecking(true)
    setError("")
    setSimilarity(null)
    try {
      const res = await checkCodeSimilarity({ sessionId, problemId, language, code })
      setSimilarity(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-white">
      <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={problemId}
            onChange={(e) => handleProblemChange(e.target.value)}
            className="bg-gray-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/90 focus:outline-none focus:border-primary"
          >
            {problems.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          {problem && (
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${DIFF_COLORS[problem.difficulty] || "text-white/50"}`}>
              {problem.difficulty}
            </span>
          )}
        </div>
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="bg-gray-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/90 focus:outline-none focus:border-primary"
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
        </select>
      </div>

      {problem && (
        <div className="px-4 py-2 border-b border-white/5">
          <p className="text-xs text-white/70 leading-relaxed">{problem.description}</p>
        </div>
      )}

      <div className="flex-1 min-h-0 relative">
        <div className="absolute top-0 left-0 right-0 px-4 py-1.5 flex items-center justify-between text-[10px] text-white/40 font-mono">
          <span>main.{LANG_MODES[language] || "js"}</span>
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          className="w-full h-full bg-transparent text-[13px] text-green-300 font-mono p-4 pt-8 resize-none outline-none leading-relaxed"
        />
      </div>

      <div className="px-4 py-2.5 border-t border-white/5 flex items-center gap-2">
        <button
          onClick={handleRun}
          disabled={running || !problemId}
          className="text-xs font-semibold bg-primary bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white px-4 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
        >
          {running && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
          Run
        </button>
        <button
          onClick={handleSimilarity}
          disabled={checking || !problemId}
          className="text-xs font-semibold bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white/80 px-4 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
        >
          {checking && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
          Similarity check
        </button>
      </div>

      {similarity && (
        <div className={`px-4 py-2 border-t border-white/5 text-xs ${
          similarity.flag === "low" ? "text-green-400" :
          similarity.flag === "medium" ? "text-yellow-400" : "text-red-400"
        }`}>
          Similarity: {Math.round(similarity.similarity * 100)}% - {similarity.flag}
          {similarity.flag !== "low" && " (flagged)"}
        </div>
      )}

      {output && (
        <div className="max-h-40 overflow-y-auto px-4 py-2 border-t border-white/5">
          <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">
            Test results {output.passed}/{output.total} passed
          </div>
          {Array.isArray(output.results) &&
            output.results.map((r, i) => {
              const passed = typeof r === "string" ? r.startsWith("PASS") : !!r.passed
              const label = typeof r === "string" ? r : (r.error ? `Error: ${r.error}` : (passed ? "PASS" : "FAIL"))
              return (
                <div key={i} className={`text-[11px] font-mono py-0.5 ${passed ? "text-green-400" : "text-red-400"}`}>
                  {passed ? "✓" : "✗"} test {i + 1} - {label}
                </div>
              )
            })}
          {output.error && <div className="text-[11px] font-mono text-red-400 py-0.5">Error: {output.error}</div>}
        </div>
      )}

      {error && (
        <div className="px-4 py-2 border-t border-white/5 text-xs text-red-400">{error}</div>
      )}
    </div>
  )
}