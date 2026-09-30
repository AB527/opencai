import { WorkspaceSummaryCard } from './WorkspaceSummaryCard';
import { ChatPanel } from './ChatPanel';

const AIOPS_PROMPTS = [
  'Create an EC2 instance',
  'Start an EC2 instance',
  'Create EBS volume',
  'Create a new S3 bucket',
];

export function AiOpsScreen({ workspace, onEditWorkspace, messages, onSend, onConfirm, onCancel, sending }) {
  // The intro and workspace card only matter before the conversation starts;
  // the workspace stays visible in the sidebar.
  const started = messages.length > 0;

  return (
    <div className="flex flex-1 flex-col">
      {!started && (
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
            Hi, I'm AIOps Agent ⚡
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            I can help you with cloud operations including creating, updating, and deleting
            resources.
          </p>
        </div>
      )}

      <div className={`mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 ${started ? '' : 'mt-6'}`}>
        {!started && <WorkspaceSummaryCard workspace={workspace} onEdit={onEditWorkspace} />}
        <ChatPanel
          messages={messages}
          onSend={onSend}
          suggestedPrompts={AIOPS_PROMPTS}
          onConfirm={onConfirm}
          onCancel={onCancel}
          sending={sending}
        />
      </div>
    </div>
  );
}
