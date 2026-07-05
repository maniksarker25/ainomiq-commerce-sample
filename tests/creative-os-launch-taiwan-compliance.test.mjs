import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const launchRoute = readFileSync(new URL('../app/api/ad-manager/creative-os/launch-to-meta/route.ts', import.meta.url), 'utf8');

assert.match(launchRoute, /regional_regulated_categories\?: unknown;/, 'Meta ad set templates should carry regional regulated categories');
assert.match(launchRoute, /regional_regulation_identities\?: unknown;/, 'Meta ad set templates should carry regional regulation identities');
assert.match(launchRoute, /targetingIncludesTaiwan\(targeting: unknown\)/, 'Launch API should detect Taiwan targeting');
assert.match(launchRoute, /applyRegionalCompliance\(adsetBody\)/, 'Launch API should normalize regional compliance before creating an ad set');
assert.match(launchRoute, /TAIWAN_UNIVERSAL/, 'Taiwan targeting should declare the required Meta category');
assert.match(launchRoute, /regional_regulated_categories,\s*regional_regulation_identities/, 'Template ad set fetch should request regional compliance fields from Meta');
assert.match(launchRoute, /payload\.regional_regulated_categories = template\.regional_regulated_categories;/, 'Copied ad set regional categories should be preserved');
assert.match(launchRoute, /payload\.regional_regulation_identities = template\.regional_regulation_identities;/, 'Copied ad set regional identities should be preserved');
