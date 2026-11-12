import { Link } from "react-router-dom"
import Brand from "./Brand"

export default function AuthLayout({ children }) {
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-copy">
          <h2>Prepare for your next interview.</h2>
          <p>Practice technical and behavioral questions, solve coding exercises, and revisit your feedback.</p>
        </div>
      </section>
      <section className="auth-form-area">
        <div className="auth-form-wrap">
          <div className="flex items-center justify-between gap-4 mb-10">
            <span className="md:hidden"><Brand /></span>
            <Link className="text-sm text-gray-600 hover:underline md:ml-auto" to="/">← Back to home</Link>
          </div>
          {children}
        </div>
      </section>
    </main>
  )
}
