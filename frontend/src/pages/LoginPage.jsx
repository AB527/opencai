import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import defaultLogo from '../assets/opencai-logo.png';
import loginLogo from '../assets/opencai-login-logo.png';
import { useAuth } from '../lib/AuthContext';
import { login } from '../lib/authApi';
import { useBranding } from '../lib/useBranding';
import { SparkleIcon } from '../components/icons';

export function LoginPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const branding = useBranding();
  const logo = branding.logoObjectKey || defaultLogo;
  // The hero card uses a tightly cropped, larger copy of the default logo.
  const heroLogo = branding.logoObjectKey || loginLogo;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { mfaToken, mfaEnrolled } = await login(username, password);
      navigate(mfaEnrolled ? '/mfa/verify' : '/mfa/enroll', { state: { mfaToken } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-stretch bg-gray-100 p-4 dark:bg-gray-950 lg:p-6">
      <div className="hidden lg:flex lg:w-1/2 lg:pr-4">
        <div
          className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 via-slate-900 to-blue-950 bg-cover bg-center"
          style={
            branding.loginImageObjectKey
              ? { backgroundImage: `url(${branding.loginImageObjectKey})` }
              : undefined
          }
        >
          {!branding.loginImageObjectKey && (
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:56px_56px]" />
          )}
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="aspect-square w-full max-w-md overflow-hidden rounded-2xl bg-white p-18 shadow-xl">
              <img src={heroLogo} alt={branding.displayName} className="size-full object-contain" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center lg:w-1/2">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm dark:bg-gray-900">
          <div className="flex items-start justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold tracking-wide text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <SparkleIcon className="size-3.5" />
              AGENTIC CLOUDOPS
            </span>
            <div className="rounded-xl bg-white p-1.5 shadow ring-1 ring-gray-100 dark:ring-gray-700">
              <img src={logo} alt={branding.displayName} className="h-8 w-auto" />
            </div>
          </div>

          <h1 className="mt-6 text-3xl font-bold text-gray-900 dark:text-gray-50">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Sign in with your Administrator or Operator credentials to continue.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="username"
                className="text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                Username or Email
              </label>
              <input
                id="username"
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  Password
                </label>
                <button
                  type="button"
                  title="Contact your administrator to reset your password."
                  className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-400"
                >
                  Forgot password?
                </button>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
