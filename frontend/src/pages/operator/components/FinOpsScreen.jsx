import { ChatPanel } from './ChatPanel';

const SUB_MODES = [
  {
    key: 'TAG_COMPLIANCE',
    emoji: '🏷️',
    title: 'Tag Compliance',
    description: 'Manage tags',
    prompts: [
      'Find resources missing required tags',
      'Show untagged EC2 instances',
      'Apply mandatory tags to a resource',
    ],
  },
  {
    key: 'COST_ANALYTICS',
    emoji: '📊',
    title: 'Cost Analytics',
    description: 'Analyze costs',
    prompts: [
      'Show service-wise cost breakdown',
      'Report costs by tags for this month without credits',
      'Show me cost trend for last 14 days',
    ],
  },
  {
    key: 'WASTE_MANAGEMENT',
    emoji: '♻️',
    title: 'Waste Management',
    description: 'Unused resources',
    prompts: ['Find unused EBS volumes', 'List idle EC2 instances', 'Find unattached Elastic IPs'],
  },
  {
    key: 'COST_OPTIMISATION',
    emoji: '💰',
    title: 'Cost Optimisation',
    description: 'Optimise spending',
    prompts: [
      'Suggest EC2 rightsizing opportunities',
      'Find unused Reserved Instances',
      'Recommend Savings Plans',
    ],
  },
];

export function FinOpsScreen({ subMode, onSelectSubMode, messages, onSend, onConfirm, onCancel, sending }) {
  const active = SUB_MODES.find((m) => m.key === subMode);

  return (
    <div>
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
          {active ? `FinOps - ${active.title}` : "Hi, I'm FinOps Agent 📊"}
        </h1>
        {!active && (
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            I can help you to govern, analyze, and optimize Cloud costs.
          </p>
        )}
      </div>

      <div className="mx-auto mt-6 max-w-4xl space-y-6">
        <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-6 dark:border-teal-900 dark:bg-teal-950/20">
          <h2 className="text-lg font-semibold text-teal-800 dark:text-teal-300">
            Select Your FinOps Agent
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SUB_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => onSelectSubMode(m.key)}
                className={`rounded-xl border p-4 text-center transition ${
                  m.key === subMode
                    ? 'border-teal-400 bg-white shadow-sm dark:border-teal-600 dark:bg-gray-900'
                    : 'border-gray-200 bg-white hover:border-teal-300 dark:border-gray-700 dark:bg-gray-900'
                }`}
              >
                <span className="text-2xl">{m.emoji}</span>
                <p className="mt-2 font-semibold text-gray-900 dark:text-gray-100">{m.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{m.description}</p>
              </button>
            ))}
          </div>
        </div>

        {active && (
          <ChatPanel
            messages={messages}
            onSend={onSend}
            suggestedPrompts={active.prompts}
            onConfirm={onConfirm}
            onCancel={onCancel}
            sending={sending}
          />
        )}
      </div>
    </div>
  );
}
