import { useEffect, useState } from 'react';
import { getBranding } from './adminApi';

const DEFAULTS = {
  displayName: 'OpenCAI',
  logoObjectKey: null,
  loginImageObjectKey: null,
  faviconObjectKey: null,
};

// index.html links this; it is restored when no custom favicon is set.
const DEFAULT_FAVICON = '/favicon.png';

/** Points the browser tab icon at `url`, or back at the default one. */
export function applyFavicon(url) {
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url || DEFAULT_FAVICON;
}

export function useBranding() {
  const [branding, setBranding] = useState(DEFAULTS);

  useEffect(() => {
    getBranding()
      .then(setBranding)
      .catch(() => setBranding(DEFAULTS));
  }, []);

  return branding;
}

/** Applies the instance's favicon to the browser tab, on every page. */
export function BrandingFavicon() {
  const { faviconObjectKey } = useBranding();
  useEffect(() => applyFavicon(faviconObjectKey), [faviconObjectKey]);
  return null;
}
