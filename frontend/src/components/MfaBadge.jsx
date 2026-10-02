/** Whether a user has an authenticator set up (or will be asked to at next login). */
export function MfaBadge({ enrolled }) {
  return enrolled ? (
    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-300">
      MFA set up
    </span>
  ) : (
    <span
      title="Will be asked to set up MFA at next sign-in"
      className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300"
    >
      MFA not set up
    </span>
  );
}
