import logo from '../assets/opencai-logo.png';
import { SettingsMenu } from './SettingsMenu';
import { ProfileMenu } from './ProfileMenu';

// Static default logo for now -- Manage Branding (Phase 4) will let an
// Administrator override this with an uploaded instance logo.
export function TopNav() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900">
      <img src={logo} alt="OpenCAI" className="h-8 w-auto" />
      <div className="flex items-center gap-1">
        <SettingsMenu />
        <ProfileMenu />
      </div>
    </header>
  );
}
