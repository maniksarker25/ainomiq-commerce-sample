import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const launchTab = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/LaunchTab.tsx', import.meta.url), 'utf8');
const meta = readFileSync(new URL('../lib/meta.ts', import.meta.url), 'utf8');

assert.match(launchTab, /const selectedCampaignMode = openLaunchId \? drafts\[openLaunchId\]\?\.campaignMode \|\| "" : "";/, 'Launch UI should track the selected campaign mode separately');
assert.match(launchTab, /selectedCampaignMode !== "existing"/, 'Ad set loading should only run for existing campaign mode');
assert.match(launchTab, /\}, \[openLaunchId, selectedCampaignId, selectedCampaignMode, tenantId\]\);/, 'Ad set loading should not refetch on every draft edit');

assert.match(meta, /function metaErrorMessage/, 'Meta errors should be normalized before they reach the UI');
assert.match(meta, /Account Has Too Many API Calls/, 'Meta rate limit errors should get a clear friendly message');
assert.match(meta, /status === 17 \|\| subcode === 2446079/, 'Meta code 17 rate limits should be detected');
