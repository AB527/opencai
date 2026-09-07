import defaultLogo from '../assets/opencai-logo.png';
import { useBranding } from '../lib/useBranding';
import { SettingsMenu } from './SettingsMenu';
import { ProfileMenu } from './ProfileMenu';

export function TopNav() {
  const branding = useBranding();

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900">
      <img src={branding.logoObjectKey || defaultLogo} alt={branding.displayName} className="h-8 w-auto" />
      <div className="flex items-center gap-1">
        <SettingsMenu />
        <ProfileMenu />
      </div>
    </header>
  );
}
