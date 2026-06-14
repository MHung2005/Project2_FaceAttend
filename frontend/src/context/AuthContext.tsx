import { createContext, useContext, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginManager, loginEmployee } from '../api/api';

type Role = 'manager' | 'employee' | null;

interface Ctx {
  token:           string | null;
  username:        string | null;
  userId:          string | null;
  role:            Role;
  isAuthenticated: boolean;
  isManager:       boolean;
  isEmployee:      boolean;
  login:           (u: string, p: string) => Promise<void>;
  loginAsEmployee: (u: string, p: string) => Promise<void>;
  logout:          () => void;
}

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token,    setToken]    = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username'));
  const [userId,   setUserId]   = useState(localStorage.getItem('userId'));
  const [role,     setRole]     = useState<Role>(
    (localStorage.getItem('role') as Role) ?? null
  );
  const navigate = useNavigate();

  const persist = (token: string, username: string, role: Role, userId?: string) => {
    localStorage.setItem('token',    token);
    localStorage.setItem('username', username);
    localStorage.setItem('role',     role ?? '');
    if (userId) localStorage.setItem('userId', userId);
    setToken(token);
    setUsername(username);
    setRole(role);
    setUserId(userId ?? null);
  };

  const login = async (u: string, p: string) => {
    const res = await loginManager(u, p);
    const { access_token, username: uname } = res.data;
    persist(access_token, uname, 'manager');
    navigate('/dashboard');
  };

  const loginAsEmployee = async (u: string, p: string) => {
    const res = await loginEmployee(u, p);
    const { access_token, username: uname, user_id } = res.data;
    persist(access_token, uname, 'employee', user_id);
    navigate('/employee/checkin');
  };

  const logout = () => {
    ['token', 'username', 'role', 'userId'].forEach(k => localStorage.removeItem(k));
    setToken(null); setUsername(null); setRole(null); setUserId(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{
      token, username, userId, role,
      isAuthenticated: !!token,
      isManager:       role === 'manager',
      isEmployee:      role === 'employee',
      login, loginAsEmployee, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext)!;