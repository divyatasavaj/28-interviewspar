import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import ProtectedRoute from "./components/ProtectedRoute"
import Home from "./pages/Home"
import FeaturesPage from "./pages/FeaturesPage"
import PracticeTracksPage from "./pages/PracticeTracksPage"
import StudentGuidePage from "./pages/StudentGuidePage"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import Dashboard from "./pages/Dashboard"
import AccountManagement from "./pages/AccountManagement"
import InterviewType from "./pages/InterviewType"
import Interview from "./pages/Interview"
import InterviewComplete from "./pages/InterviewComplete"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/practice-tracks" element={<PracticeTracksPage />} />
        <Route path="/student-guide" element={<StudentGuidePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AccountManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview-type"
          element={
            <ProtectedRoute>
              <InterviewType />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview"
          element={
            <ProtectedRoute>
              <Interview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview-complete"
          element={
            <ProtectedRoute>
              <InterviewComplete />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
