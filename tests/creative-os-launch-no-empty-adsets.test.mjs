import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const launchRoute = readFileSync(new URL('../app/api/ad-manager/creative-os/launch-to-meta/route.ts', import.meta.url), 'utf8');

assert.match(launchRoute, /export const maxDuration = 300;/, 'Video launches should have enough server time to upload media and create ads');
assert.match(launchRoute, /type PreparedMetaAdCreative = Awaited<ReturnType<typeof prepareMetaAdCreative>>;/, 'Launch flow should prepare creatives before creating a new ad set');
assert.match(launchRoute, /async function prepareMetaAdCreative/, 'Launch API should split media and creative creation from ad creation');
assert.match(launchRoute, /async function createPausedMetaAd\([\s\S]*prepared: PreparedMetaAdCreative/, 'Ad creation should reuse a prepared creative');
const prepareIndex = launchRoute.indexOf('const preparedCreatives = []');
const adsetIndex = launchRoute.indexOf('let adsetId = clean(body.adsetId');
assert.ok(prepareIndex > -1 && adsetIndex > -1 && prepareIndex < adsetIndex, 'Creative media should be prepared before a new ad set is created');
assert.match(launchRoute, /preparedCreatives\.push\([\s\S]*await prepareMetaAdCreative/, 'All selected creatives should be uploaded before ad set creation');
