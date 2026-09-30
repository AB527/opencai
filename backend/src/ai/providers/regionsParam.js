// The optional `regions` argument shared by run_lookup and run_command in every
// provider adapter. The orchestrator validates the names and decides whether
// the command may fan out; adapters only pass the list through.

const REGIONS_PROPERTY = {
  type: 'array',
  items: { type: 'string' },
  description:
    'Optional. To run this same read-only command in several AWS regions in one step, list the region names (e.g. ["us-east-1", "eu-west-1"]) or pass ["all"] for every region enabled on the account. Leave --region out of the command when using this. Not allowed for commands that change resources.',
};

/** The model's `regions` argument as a clean string array, or undefined. */
function parseRegions(args) {
  if (!Array.isArray(args?.regions)) return undefined;
  const regions = args.regions
    .filter((r) => typeof r === 'string' && r.trim())
    .map((r) => r.trim());
  return regions.length > 0 ? regions : undefined;
}

module.exports = { REGIONS_PROPERTY, parseRegions };
