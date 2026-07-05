import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const launchRoute = readFileSync(new URL('../app/api/ad-manager/creative-os/launch-to-meta/route.ts', import.meta.url), 'utf8');
const launchTab = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/LaunchTab.tsx', import.meta.url), 'utf8');

assert.match(launchRoute, /function isFutureMetaStartTime\(value: string\)/, 'Launch API should detect future start times');
assert.match(launchRoute, /const scheduledStartTime = adsetMode === "new" && isFutureMetaStartTime\(startTime\);/, 'Future start time should only schedule new ad sets');
assert.match(launchRoute, /status: scheduledStartTime \? "ACTIVE" : "PAUSED"/, 'Scheduled ad sets should be active with a future start time instead of paused');
assert.match(launchRoute, /adStatus: scheduledStartTime \? "ACTIVE" : "PAUSED"/, 'Ads inside a scheduled ad set should also be active');
assert.match(launchRoute, /status: scheduledStartTime \? "ACTIVE" : "PAUSED",[\s\S]*special_ad_categories/, 'New campaigns should be active when creating a scheduled launch');
assert.match(launchRoute, /scheduledStartTime[\s\S]*Created scheduled ad/, 'Launch response should tell the UI when ads were scheduled');

assert.match(launchTab, /future start time becomes scheduled in Meta/, 'Start time helper should explain scheduled behavior');
assert.match(launchTab, /Created as scheduled in Meta Ads Manager/, 'Launch UI should show scheduled success state');
