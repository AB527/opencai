import { Link } from 'react-router-dom';
import { TopNav } from '../../components/TopNav';

export function AdminLayout({ title, children }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <TopNav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link to="/admin" className="font-medium text-teal-700 hover:underline dark:text-teal-400">
            Admin
          </Link>
          {title && (
            <>
              <span className="text-gray-400 dark:text-gray-600">/</span>
              <span className="text-gray-600 dark:text-gray-300">{title}</span>
            </>
          )}
        </div>
        {children}
      </main>
    </div>
  );
}
