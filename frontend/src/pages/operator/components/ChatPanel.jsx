import { useState } from 'react';

export function ChatPanel({ messages, onSend, suggestedPrompts }) {
  const [draft, setDraft] = useState('');

  function handleSend(text) {
    const value = (text ?? draft).trim();
    if (!value) return;
    onSend(value);
    setDraft('');
  }

  return (
    <div>
      {messages.length > 0 && (
        <div className="mb-4 max-h-96 space-y-3 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'USER' ? 'text-right' : 'text-left'}>
              <span
                className={`inline-block max-w-[80%] rounded-2xl px-4 py-2 text-left text-sm ${
                  m.role === 'USER'
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                }`}
              >
                {m.content}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Describe what you want to do or select a quick action below"
          className="flex-1 border-none bg-transparent px-2 py-2 text-sm focus:outline-none dark:text-gray-100"
        />
        <button
          type="button"
          onClick={() => handleSend()}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
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
              className="rounded-full border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
