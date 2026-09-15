import { useState } from 'react';

const STATUS_STYLES = {
  EXECUTED: 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
  CAPPED: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  DRY_RUN: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  CONFIRMED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

function StatusBadge({ status }) {
  if (!status) return null;
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
  return (
    <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function TextBubble({ message }) {
  return (
    <div className={message.role === 'USER' ? 'text-right' : 'text-left'}>
      <span
        className={`inline-block max-w-[80%] rounded-2xl px-4 py-2 text-left text-sm ${
          message.role === 'USER'
            ? 'bg-teal-600 text-white'
            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
        }`}
      >
        {message.content}
      </span>
    </div>
  );
}

function CommandRequestCard({ message, onConfirm, onCancel, sending }) {
  const isPending = message.status === 'PENDING_CONFIRMATION';
  const [acting, setActing] = useState(false);
  const disabled = sending || acting;

  async function handleConfirm() {
    setActing(true);
    try {
      await onConfirm(message.id);
    } finally {
      setActing(false);
    }
  }

  async function handleCancel() {
    setActing(true);
    try {
      await onCancel(message.id);
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-left dark:border-amber-900 dark:bg-amber-950/20">
      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-gray-800 dark:text-gray-100">
        {message.content}
      </pre>
      {isPending ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={disabled}
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={disabled}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
        </div>
      ) : (
        <StatusBadge status={message.status} />
      )}
    </div>
  );
}

function CommandResultBlock({ message }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-left dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-1 flex items-center text-xs font-medium text-gray-500 dark:text-gray-400">
        Output
        <StatusBadge status={message.status} />
      </div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-gray-700 dark:text-gray-200">
        {message.content}
      </pre>
    </div>
  );
}

function MessageItem({ message, onConfirm, onCancel, sending }) {
  if (message.kind === 'LOOKUP_REQUEST' || message.kind === 'COMMAND_REQUEST') {
    return <CommandRequestCard message={message} onConfirm={onConfirm} onCancel={onCancel} sending={sending} />;
  }
  if (message.kind === 'COMMAND_RESULT') {
    return <CommandResultBlock message={message} />;
  }
  return <TextBubble message={message} />;
}

export function ChatPanel({ messages, onSend, suggestedPrompts, onConfirm, onCancel, sending }) {
  const [draft, setDraft] = useState('');

  function handleSend(text) {
    const value = (text ?? draft).trim();
    if (!value || sending) return;
    onSend(value);
    setDraft('');
  }

  return (
    <div>
      {messages.length > 0 && (
        <div className="mb-4 max-h-96 space-y-3 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          {messages.map((m) => (
            <MessageItem key={m.id} message={m} onConfirm={onConfirm} onCancel={onCancel} sending={sending} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={sending}
          placeholder="Describe what you want to do or select a quick action below"
          className="flex-1 border-none bg-transparent px-2 py-2 text-sm focus:outline-none disabled:opacity-60 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={() => handleSend()}
          disabled={sending}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          Send
        </button>
      </div>

      {suggestedPrompts && suggestedPrompts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleSend(prompt)}
              disabled={sending}
              className="rounded-full border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
