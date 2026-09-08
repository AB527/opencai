import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

// Pure redirect: both roles now have a real landing page.
export function DashboardPage() {
  const { user } = useAuth();

  if (user?.role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }
  return <Navigate to="/operator" replace />;
}
