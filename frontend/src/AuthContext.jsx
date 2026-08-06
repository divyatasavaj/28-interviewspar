import { createContext, useContext, useEffect, useState } from "react";
import { login as apiLogin, register as apiRegister, fetchMe, getToken, clearToken } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from a stored token on first load.
  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    fetchMe()
      .then((u) => setUser(u))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  async function login(creds) {
    const u = await apiLogin(creds);
    setUser(u);
    return u;
  }
  async function register(payload) {
    const u = await apiRegister(payload);
    setUser(u);
    return u;
  }
  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
