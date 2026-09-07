import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { TopNav } from '../components/TopNav';

export function DashboardPage() {
  const { user } = useAuth();

  if (user?.role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <TopNav />
      <main className="flex flex-col items-center justify-center gap-2 px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          Welcome, {user?.username}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          You're signed in as Operator. The Operator dashboard is coming in a later phase.
        </p>
      </main>
    </div>
  );
}
