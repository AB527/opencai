const SIZE = 22;
const STROKE = 3;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const formatTokens = (n) => n.toLocaleString();

function ringColor(percent) {
  if (percent >= 90) return 'text-red-500';
  if (percent >= 70) return 'text-amber-500';
  return 'text-teal-600 dark:text-teal-400';
}

/**
 * How full the model's context window was after the last reply: a small ring
 * with the exact figures in a tooltip on hover or keyboard focus.
 */
export function ContextRing({ tokens, contextWindow }) {
  const known = Number.isFinite(tokens) && Number.isFinite(contextWindow) && contextWindow > 0;
  const percent = known ? Math.min(100, (tokens / contextWindow) * 100) : 0;
  const percentText = known ? `${percent.toFixed(1)}%` : null;

  let lines;
  if (known) {
    lines = [
      `${percentText} of context used`,
      `${formatTokens(tokens)} / ${formatTokens(contextWindow)} tokens`,
    ];
  } else if (Number.isFinite(tokens)) {
    lines = [
      `${formatTokens(tokens)} tokens used`,
      'Context size unknown for this model. Set "context_window" in Chat Settings.',
    ];
  } else {
    lines = ['Context usage', 'Shown after the next reply.'];
  }

  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        aria-label={lines.join('. ')}
        className="rounded-full p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-gray-200 dark:stroke-gray-700"
          />
          {known && (
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              stroke="currentColor"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
              className={`${ringColor(percent)} transition-[stroke-dashoffset] duration-500`}
            />
          )}
        </svg>
      </button>
      <div
        role="tooltip"
        className="pointer-events-none invisible absolute left-1/2 top-full z-20 mt-2 w-max max-w-64 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 dark:bg-gray-700"
      >
        <p className="font-semibold">{lines[0]}</p>
        <p className="mt-0.5 text-gray-300">{lines[1]}</p>
      </div>
    </div>
  );
}
