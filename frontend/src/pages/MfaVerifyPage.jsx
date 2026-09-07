import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/opencai-logo.png';
import { useAuth } from '../lib/AuthContext';
import { verifyMfa } from '../lib/authApi';

export function MfaVerifyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login: storeSession } = useAuth();
  const mfaToken = location.state?.mfaToken;

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!mfaToken) {
    return <Navigate to="/login" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { token } = await verifyMfa(mfaToken, code);
      storeSession(token);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-sm dark:bg-gray-900">
        <img src={logo} alt="OpenCAI" className="h-8 w-auto" />
        <h1 className="mt-6 text-2xl font-bold text-gray-900 dark:text-gray-50">
          Enter your authentication code
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Enter the 6-digit code from your authenticator app, or one of your backup codes.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="text"
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-center text-lg tracking-widest focus:border-teal-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {submitting ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      </div>
    </div>
  );
}
