import { useAuth } from '../lib/AuthContext';
import { TopNav } from '../components/TopNav';

const ROLE_LABELS = {
  ADMIN: 'Administrator',
  OPERATOR: 'Operator',
};

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <TopNav />
      <main className="flex flex-col items-center justify-center gap-2 px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          Welcome, {user?.username}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          You're signed in as {ROLE_LABELS[user?.role] || user?.role}. The{' '}
          {user?.role === 'ADMIN' ? 'Administrator' : 'Operator'} dashboard is coming in a later
          phase.
        </p>
      </main>
    </div>
  );
}
