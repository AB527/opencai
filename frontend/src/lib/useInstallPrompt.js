import { useEffect, useState } from 'react';

// The browser fires beforeinstallprompt once per page load, possibly before a
// component that wants it has mounted -- so it is captured here, at import
// time, and handed to every useInstallPrompt() caller.
let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn(deferredPrompt));

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Show our own "Install app" button instead of the mini-infobar.
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

const isStandalone = () =>
  typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;

/**
 * `canInstall` is true when the browser offers installing OpenCAI as an app
 * (Chrome, Edge, Android) and it is not already running installed. iOS Safari
 * has no such event; there it's Share → Add to Home Screen.
 */
export function useInstallPrompt() {
  const [prompt, setPrompt] = useState(deferredPrompt);

  useEffect(() => {
    listeners.add(setPrompt);
    return () => listeners.delete(setPrompt);
  }, []);

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    // A prompt can only be used once; the browser fires a new event if the
    // user dismissed it and installing is still possible later.
    deferredPrompt = null;
    notify();
  }

  return { canInstall: Boolean(prompt) && !isStandalone(), install };
}
