import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useClickOutside } from '../lib/useClickOutside';
import { UserCircleIcon } from './icons';
import { ChangePasswordModal } from './ChangePasswordModal';

const ROLE_LABELS = {
  ADMIN: 'Administrator',
  OPERATOR: 'Operator',
};

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef(null);

  useClickOutside(containerRef, () => setOpen(false));

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Profile"
        className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <UserCircleIcon className="size-5" />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-col items-center gap-2 border-b border-gray-100 pb-4 dark:border-gray-700">
            <UserCircleIcon className="size-12 text-gray-400 dark:text-gray-500" />
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {user?.username}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {ROLE_LABELS[user?.role] || user?.role}
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => {
                setShowChangePassword(true);
                setOpen(false);
              }}
              className="rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Change Password
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              Logout
            </button>
          </div>
        </div>
      )}

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
}
