import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { apiRequest, ApiError } from './api';

export type Account = { id: string; fullName: string; email: string };
type AuthState = {
  user: Account | null; loading: boolean; error: string;
  refresh: () => Promise<void>; login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: Account) => void;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { setUser(await apiRequest<Account>('/auth/me')); }
    catch (e) {
      setUser(null);
      if (!(e instanceof ApiError && e.status === 401)) setError('We could not reach your workspace. Check that the backend is running.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const expire = () => setUser(null);
    window.addEventListener('quantara:session-expired', expire);
    return () => window.removeEventListener('quantara:session-expired', expire);
  }, []);
  async function login(email: string, password: string) {
    setUser(await apiRequest<Account>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }));
    setError('');
  }
  async function logout() {
    await apiRequest('/auth/logout', { method: 'POST' });
    setUser(null);
  }
  return <AuthContext.Provider value={{ user, loading, error, refresh, login, logout, updateUser: setUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, error, refresh } = useAuth();
  const location = useLocation();
  if (loading) return <div className="quantara-app q-gate" aria-busy="true"><span className="q-spinner"/><p>Opening your workspace…</p></div>;
  if (error) return <div className="quantara-app q-gate" role="alert"><h1>A moment of reconnection.</h1><p>{error}</p><button className="q-button" onClick={() => void refresh()}>Try again</button></div>;
  return user ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}
