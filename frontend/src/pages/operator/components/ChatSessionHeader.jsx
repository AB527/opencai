import { useState } from 'react';
import { CopyIcon } from '../../../components/icons';
import { ContextRing } from './ContextRing';

export function ChatSessionHeader({ session, onNewSession }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(session.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied by the browser; not worth surfacing an error for.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          title="Copy session ID"
          className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 font-mono text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {session.id}
          <CopyIcon className="size-3.5" />
          {copied && <span className="text-teal-700 dark:text-teal-400">Copied</span>}
        </button>
        <ContextRing tokens={session.contextTokens} contextWindow={session.contextWindow} />
      </div>
      <button
        type="button"
        onClick={onNewSession}
        className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
      >
        New Session
      </button>
    </div>
  );
}
