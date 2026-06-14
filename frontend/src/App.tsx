import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import GuestCheckIn      from './pages/GuestCheckIn';
import ManagerLogin      from './pages/ManagerLogin';
import EmployeeLogin     from './pages/EmployeeLogin';
import ManagerDashboard  from './pages/ManagerDashboard';
import RegisterFace      from './pages/RegisterFace';
import EmployeeDirectory from './pages/EmployeeDirectory';
import ApproveFaces      from './pages/ApproveFaces';
import EmployeeDashboard from './pages/EmployeeDashboard';

/** Chỉ cho manager vào */
function PrivateManager({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isManager } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isManager)       return <Navigate to="/employee/checkin" replace />;
  return <>{children}</>;
}

/** Chỉ cho employee vào */
function PrivateEmployee({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isEmployee } = useAuth();
  if (!isAuthenticated) return <Navigate to="/employee/login" replace />;
  if (!isEmployee)      return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/"                element={<GuestCheckIn />} />
      <Route path="/login"           element={<ManagerLogin />} />
      <Route path="/employee/login"  element={<EmployeeLogin />} />

      {/* Manager only */}
      <Route path="/dashboard"  element={<PrivateManager><ManagerDashboard /></PrivateManager>} />
      <Route path="/register"   element={<PrivateManager><RegisterFace /></PrivateManager>} />
      <Route path="/employees"  element={<PrivateManager><EmployeeDirectory /></PrivateManager>} />
      <Route path="/approve"    element={<PrivateManager><ApproveFaces /></PrivateManager>} />

      {/* Employee only */}
      <Route path="/employee/checkin" element={<PrivateEmployee><EmployeeDashboard /></PrivateEmployee>} />

      <Route path="*" element={<Navigate to="/" replace />} />
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