import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import GuestCheckIn     from './pages/GuestCheckIn';
import ManagerLogin          from './pages/ManagerLogin';
import ManagerDashboard        from './pages/ManagerDashboard';
import RegisterFace from './pages/RegisterFace';

function Private({ children }: { children: React.ReactNode }) {
  return useAuth().isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"          element={<GuestCheckIn />} />
      <Route path="/login"     element={<ManagerLogin />} />
      <Route path="/dashboard" element={<Private><ManagerDashboard /></Private>} />
      <Route path="/register"  element={<Private><RegisterFace /></Private>} />
      <Route path="*"          element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider><AppRoutes /></AuthProvider>
    </BrowserRouter>
  );
}