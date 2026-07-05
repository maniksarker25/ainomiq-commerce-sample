import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const launchTab = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/LaunchTab.tsx', import.meta.url), 'utf8');

assert.match(launchTab, /Launch from setup/, 'Open Ads Manager setup should include an in-form launch button');
assert.match(launchTab, /void createInAdsManager\(item, createIds\)/, 'In-form launch button should use the same create flow as the side action');
assert.match(launchTab, /Create \$\{createIds\.length\} selected ads/, 'In-form launch button should support selected batch ads');
