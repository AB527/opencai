import { useEffect, useState } from 'react';
import { getBranding } from './adminApi';

const DEFAULTS = { displayName: 'OpenCAI', logoObjectKey: null, loginImageObjectKey: null };

export function useBranding() {
  const [branding, setBranding] = useState(DEFAULTS);

  useEffect(() => {
    getBranding()
      .then(setBranding)
      .catch(() => setBranding(DEFAULTS));
  }, []);

  return branding;
}
