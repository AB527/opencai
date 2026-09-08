import { WorkspaceSummaryCard } from './WorkspaceSummaryCard';
import { ChatPanel } from './ChatPanel';

const AIOPS_PROMPTS = [
  'Create an EC2 instance',
  'Start an EC2 instance',
  'Create EBS volume',
  'Create a new S3 bucket',
];

export function AiOpsScreen({ workspace, onEditWorkspace, messages, onSend }) {
  return (
    <div>
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
          Hi, I'm AIOps Agent ⚡
        </h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          I can help you with cloud operations including creating, updating, and deleting
          resources.
        </p>
      </div>

      <div className="mx-auto mt-6 max-w-3xl space-y-6">
        <WorkspaceSummaryCard workspace={workspace} onEdit={onEditWorkspace} />
        <ChatPanel messages={messages} onSend={onSend} suggestedPrompts={AIOPS_PROMPTS} />
      </div>
    </div>
  );
}
