import { Navigate, useLocation } from "react-router-dom"
import { getToken } from "../api/auth"

export default function ProtectedRoute({ children }) {
  const { pathname, search, hash } = useLocation()
  if (!getToken()) {
    return <Navigate to="/login" state={{ returnTo: { pathname, search, hash } }} replace />
  }
  return children
}
