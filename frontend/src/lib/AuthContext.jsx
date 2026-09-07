import { createContext, useContext, useMemo, useState } from 'react';
import { decodeJwtPayload, isTokenExpired } from './jwt';

const TOKEN_STORAGE_KEY = 'opencai_token';

const AuthContext = createContext(null);

function loadStoredToken() {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token && !isTokenExpired(token)) return token;
  if (token) localStorage.removeItem(TOKEN_STORAGE_KEY);
  return null;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(loadStoredToken);

  const user = useMemo(() => {
    if (!token) return null;
    const payload = decodeJwtPayload(token);
    return payload ? { id: payload.sub, username: payload.username, role: payload.role } : null;
  }, [token]);

  const login = (newToken) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
