const READONLY_PREFIXES = ['describe-', 'list-', 'get-'];

const MUTATING_PREFIXES = [
  'create-',
  'put-',
  'delete-',
  'terminate-',
  'update-',
  'modify-',
  'start-',
  'stop-',
  'authorize-',
  'revoke-',
  'attach-',
  'detach-',
  'associate-',
  'disassociate-',
];

// Operations that don't follow the verb-prefix pattern but are still mutating.
const MUTATING_EXACT_OPERATIONS = ['run-instances'];

// Curated, non-exhaustive: EC2 mutating operations known to support --dry-run.
// (--dry-run is primarily an EC2 CLI feature; most s3api/iam mutating calls
// don't have one at all -- this list intentionally does not try to be complete,
// per the plan's guardrail #6, which documents dry-run support as partial.)
const DRY_RUN_SUPPORTED_EC2_OPERATIONS = [
  'run-instances',
  'terminate-instances',
  'stop-instances',
  'start-instances',
  'reboot-instances',
  'create-volume',
  'delete-volume',
  'attach-volume',
  'detach-volume',
  'create-snapshot',
  'delete-snapshot',
  'create-security-group',
  'delete-security-group',
  'authorize-security-group-ingress',
  'authorize-security-group-egress',
  'revoke-security-group-ingress',
  'revoke-security-group-egress',
  'associate-address',
  'disassociate-address',
  'create-tags',
  'delete-tags',
];

module.exports = {
  READONLY_PREFIXES,
  MUTATING_PREFIXES,
  MUTATING_EXACT_OPERATIONS,
  DRY_RUN_SUPPORTED_EC2_OPERATIONS,
};
