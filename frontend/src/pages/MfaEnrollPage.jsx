import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/opencai-logo.png';
import { useAuth } from '../lib/AuthContext';
import { startEnrollment, confirmEnrollment } from '../lib/authApi';

export function MfaEnrollPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login: storeSession } = useAuth();
  const mfaToken = location.state?.mfaToken;

  const [enrollment, setEnrollment] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [backupCodes, setBackupCodes] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);

  useEffect(() => {
    if (!mfaToken) return;
    startEnrollment(mfaToken)
      .then(setEnrollment)
      .catch((err) => setLoadError(err.message));
  }, [mfaToken]);

  if (!mfaToken) {
    return <Navigate to="/login" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setCodeError('');
    setSubmitting(true);
    try {
      const { token, backupCodes: codes } = await confirmEnrollment(
        enrollment.enrollmentToken,
        code,
      );
      setSessionToken(token);
      setBackupCodes(codes);
    } catch (err) {
      setCodeError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleContinue() {
    storeSession(sessionToken);
    navigate('/dashboard', { replace: true });
  }

  if (backupCodes) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 dark:bg-gray-950">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm dark:bg-gray-900">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            Save your backup codes
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Each code can be used once to sign in if you lose access to your authenticator app.
            Store them somewhere safe -- they will not be shown again.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-4 font-mono text-sm dark:bg-gray-800">
            {backupCodes.map((c) => (
              <span key={c} className="text-gray-800 dark:text-gray-200">
                {c}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={handleContinue}
            className="mt-6 w-full rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
          >
            I've saved these codes, continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-sm dark:bg-gray-900">
        <img src={logo} alt="OpenCAI" className="h-8 w-auto" />
        <h1 className="mt-6 text-2xl font-bold text-gray-900 dark:text-gray-50">
          Set up two-factor authentication
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Scan this QR code with Google Authenticator (or a compatible app), then enter the
          6-digit code it shows.
        </p>

        {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}

        {enrollment && (
          <>
            <div className="mt-5 flex justify-center">
              <img
                src={enrollment.qrCodeDataUrl}
                alt="TOTP enrollment QR code"
                className="size-40 rounded-lg border border-gray-200 dark:border-gray-700"
              />
            </div>
            <p className="mt-3 break-all rounded-lg bg-gray-50 px-3 py-2 text-center text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {enrollment.otpauthUri}
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <input
                type="text"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-center text-lg tracking-widest focus:border-teal-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />

              {codeError && <p className="text-sm text-red-600">{codeError}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {submitting ? 'Confirming...' : 'Confirm'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
