import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const launchSource = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/LaunchTab.tsx', import.meta.url), 'utf8');
const campaignsRoute = readFileSync(new URL('../app/api/ads/campaigns/route.ts', import.meta.url), 'utf8');

assert.match(campaignsRoute, /fields=name,status,effective_status,objective/, 'Campaign API should fetch Meta effective_status for filtering');
assert.match(campaignsRoute, /effectiveStatus: c\.effective_status \|\| c\.status/, 'Campaign API should return an effectiveStatus field');

assert.match(launchSource, /type CampaignFilter = "all" \| "active" \| "paused"/, 'Launch setup should define campaign status filter modes');
assert.match(launchSource, /function campaignMatchesFilter[\s\S]*filter === "active"[\s\S]*status === "ACTIVE"[\s\S]*filter === "paused"[\s\S]*status === "PAUSED"/, 'Launch setup should filter live and paused campaigns separately');
assert.match(launchSource, /const \[campaignFilter, setCampaignFilter\] = useState<CampaignFilter>\("active"\)/, 'Launch setup should default to live campaigns');
assert.match(launchSource, /const filteredCampaigns = useMemo\([\s\S]*campaignMatchesFilter\(campaign, campaignFilter\)/, 'Campaign dropdown should use filtered campaigns');
assert.match(launchSource, /setCampaignFilter\(value as CampaignFilter\)/, 'Launch setup should expose a UI control to change campaign filter');
assert.match(launchSource, /filteredCampaigns\.map\(\(campaign\) =>/, 'Campaign select should render filtered campaign options');
