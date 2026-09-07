import { Link } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';

const SECTIONS = [
  {
    to: '/admin/administrators',
    title: 'Manage Administrators',
    description: 'Add or remove Administrator accounts.',
  },
  {
    to: '/admin/operators',
    title: 'Manage Operators',
    description: 'Create, update, and deactivate Operator accounts.',
  },
  {
    to: '/admin/organisations',
    title: 'Manage Organisations',
    description: 'Client Organisations and their Workspaces.',
  },
  {
    to: '/admin/chat-settings',
    title: 'Manage Chat Settings',
    description: 'Model selection and related chat configuration.',
  },
  {
    to: '/admin/branding',
    title: 'Manage Branding',
    description: "This instance's display name, logo, and login image.",
  },
  {
    to: '/admin/chats',
    title: 'Manage Chats',
    description: 'Read-only oversight of every chat conversation.',
  },
];

export function AdminDashboard() {
  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
        Administrator Dashboard
      </h1>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
          >
            <h2 className="font-semibold text-gray-900 dark:text-gray-50">{s.title}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{s.description}</p>
          </Link>
        ))}
      </div>
    </AdminLayout>
  );
}
