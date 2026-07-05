import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const launchTab = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/LaunchTab.tsx', import.meta.url), 'utf8');
const launchRoute = readFileSync(new URL('../app/api/ad-manager/creative-os/launch-to-meta/route.ts', import.meta.url), 'utf8');

assert.match(launchTab, /type CampaignOption = \{[\s\S]*dailyBudget\?: string \| null;[\s\S]*lifetimeBudget\?: string \| null;/, 'Launch campaign options should include campaign-level budget fields for CBO detection');
assert.match(launchTab, /function campaignUsesCampaignBudget/, 'Launch UI should detect CBO/campaign-budget campaigns');
assert.match(launchTab, /campaignBudgetMode: usesCampaignBudget \? "campaign" : "adset"/, 'Launch request should tell the server when spend is controlled by campaign budget');
assert.match(launchTab, /Campaign budget controls spend/, 'CBO campaigns should explain why ad set budget is disabled');
assert.match(launchTab, /Start time/, 'Launch setup should allow choosing a start time');
assert.match(launchTab, /startTime/, 'Launch draft should include start time');

assert.match(launchRoute, /campaignBudgetMode/, 'Launch-to-Meta should read campaign budget mode');
assert.match(launchRoute, /if \(!campaignBudgetMode\)[\s\S]*daily_budget/, 'Launch-to-Meta should only set ad set budget when campaign budget is not controlling spend');
assert.match(launchRoute, /start_time/, 'Launch-to-Meta should send start_time when creating a new ad set');
