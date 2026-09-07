import { useRef, useState } from 'react';
import { useTheme } from '../lib/ThemeContext';
import { useClickOutside } from '../lib/useClickOutside';
import { GearIcon } from './icons';

const THEME_LABELS = {
  light: 'Light',
  dark: 'Dark',
  device: 'Device Default',
};

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const containerRef = useRef(null);

  useClickOutside(containerRef, () => setOpen(false));

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Settings"
        className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <GearIcon className="size-5" />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Theme</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Choose how OpenCAI looks on this device.
          </p>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          >
            {Object.entries(THEME_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
