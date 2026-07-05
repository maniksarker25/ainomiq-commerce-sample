import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const launchSource = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/LaunchTab.tsx', import.meta.url), 'utf8');
const adsetsRoute = readFileSync(new URL('../app/api/ads/adsets/route.ts', import.meta.url), 'utf8');
const launchRoute = readFileSync(new URL('../app/api/ad-manager/creative-os/launch-to-meta/route.ts', import.meta.url), 'utf8');

assert.match(adsetsRoute, /effectiveStatus: adset\.effective_status \|\| adset\.status/, 'Ad set API should return effective status for live targeting templates');
assert.match(launchSource, /targetingSourceAdsetId: string/, 'Launch draft should store the selected targeting source ad set');
assert.match(launchSource, /function isLiveAdset[\s\S]*ACTIVE/, 'Launch setup should identify live ad sets');
assert.match(launchSource, /Copy targeting from live ad set/, 'New ad set setup should expose targeting copy control');
assert.match(launchSource, /adsetsForCampaign\.filter\(isLiveAdset\)\.map/, 'Targeting template select should list live ad sets in the selected campaign');
assert.match(launchSource, /targetingSourceAdsetId: ""/, 'Changing campaign or ad set mode should clear stale targeting template selection');

assert.match(launchRoute, /type MetaAdsetTemplate/, 'Launch API should model a Meta ad set template');
assert.match(launchRoute, /loadAdsetTemplate\(token, clean\(body\.targetingSourceAdsetId[\s\S]*campaignId/, 'Launch API should reload the selected ad set template from Meta for the selected campaign');
assert.match(launchRoute, /fields=campaign_id,status,effective_status,targeting,promoted_object,optimization_goal,billing_event,bid_strategy,bid_amount/, 'Launch API should fetch targeting and delivery settings from the template ad set');
assert.match(launchRoute, /data\?\.campaign_id[\s\S]*!== campaignId[\s\S]*selected campaign/, 'Launch API should reject targeting templates outside the selected campaign');
assert.match(launchRoute, /status !== "ACTIVE"[\s\S]*live ad set/, 'Launch API should require a live ad set as targeting template');
assert.match(launchRoute, /applyAdsetTemplate\(adsetBody, template\)/, 'Launch API should apply copied targeting before creating the new ad set');
