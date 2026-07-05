import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const launchTab = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/LaunchTab.tsx', import.meta.url), 'utf8');
const launchRoute = readFileSync(new URL('../app/api/ad-manager/creative-os/launch-to-meta/route.ts', import.meta.url), 'utf8');

assert.match(launchTab, /const \[launchNotice, setLaunchNotice\]/, 'Launch UI should keep a global success/error notice after created ads leave the ready list');
assert.match(launchTab, /Open created ads/, 'Launch success notice should link to the created Ads Manager selection');
assert.match(launchTab, /Selected ads in this launch/, 'Batch setup should show every selected ad, not only the clicked card');
assert.match(launchTab, /type LaunchCopyOverride/, 'Batch launch UI should track per-ad copy overrides');
assert.match(launchTab, /itemOverrides/, 'Batch launch requests should submit per-ad copy overrides');
assert.match(launchTab, /Per-ad copy/, 'Batch setup should make per-ad copy editing visible');
assert.match(launchTab, /Edit Meta ad names, primary text, and headlines per selected ad above/, 'Shared setup should not pretend batch copy fields apply to every ad');
assert.match(launchTab, /Meta ad name/, 'Launch setup should let the user name ads separately from the headline');
assert.match(launchTab, /Meta headline/, 'Launch setup should label the headline as the Meta headline');
assert.match(launchTab, /adName: context\.briefTitle/, 'Default launch drafts should include an editable ad name');

assert.match(launchRoute, /adName\?: unknown;/, 'Launch API should accept an explicit ad name');
assert.match(launchRoute, /body\.itemOverrides/, 'Launch API should read per-ad copy overrides');
assert.match(launchRoute, /itemCopy\.primaryText \|\| body\.primaryText/, 'Per-ad primary text should override shared primary text');
assert.match(launchRoute, /itemCopy\.headline \|\| body\.headline/, 'Per-ad headline should override shared headline');
assert.match(launchRoute, /input\.headline \|\|/, 'Explicit headlines should win even for batch launches');
assert.match(launchRoute, /name: prepared\.adName/, 'Meta ad object name should come from the ad name field');
assert.match(launchRoute, /title: headline/, 'Video creative title should still use the headline field');
assert.match(launchRoute, /name: headline/, 'Image link creative headline should still use the headline field');
