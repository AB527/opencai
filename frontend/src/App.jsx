import { useEffect, useState } from 'react';
import { apiRequest } from './lib/api';

function App() {
  const [backendStatus, setBackendStatus] = useState('checking...');

  useEffect(() => {
    apiRequest('/healthz')
      .then(() => setBackendStatus('reachable'))
      .catch(() => setBackendStatus('unreachable'));
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2">
      <h1 className="text-2xl font-semibold">OpenCAI</h1>
      <p className="text-sm text-gray-500">Backend: {backendStatus}</p>
    </div>
  );
}

export default App;
