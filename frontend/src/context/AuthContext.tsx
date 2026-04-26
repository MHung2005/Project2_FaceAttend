import { createContext, useContext, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginManager } from '../api/api';

interface Ctx {
  token: string | null; username: string | null;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void; isAuthenticated: boolean;
}
const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken]       = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username'));
  const navigate = useNavigate();

  const login = async (u: string, p: string) => {
    const res = await loginManager(u, p);
    const { access_token, username: uname } = res.data;
    localStorage.setItem('token', access_token);
    localStorage.setItem('username', uname);
    setToken(access_token); setUsername(uname);
    navigate('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('token'); localStorage.removeItem('username');
    setToken(null); setUsername(null); navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ token, username, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext)!;