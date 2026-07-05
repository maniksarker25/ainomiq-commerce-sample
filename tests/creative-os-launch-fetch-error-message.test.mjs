import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const launchTab = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/LaunchTab.tsx', import.meta.url), 'utf8');

assert.match(launchTab, /function launchErrorMessage/, 'Launch UI should normalize low-level fetch failures');
assert.match(launchTab, /Meta launch request disconnected before Creative OS got the result\./, 'Raw Failed to fetch should be replaced with an actionable launch message');
assert.match(launchTab, /launchErrorMessage\(error\)/, 'Create flow should use the normalized launch error message');
