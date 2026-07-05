import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const launchTab = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/LaunchTab.tsx', import.meta.url), 'utf8');
const route = readFileSync(new URL('../app/api/ad-manager/creative-os/launch-copy/route.ts', import.meta.url), 'utf8');

assert.match(launchTab, /fillLaunchCopy/, 'Launch setup should expose an AI copy fill action');
assert.match(launchTab, /\/api\/ad-manager\/creative-os\/launch-copy/, 'Launch copy fill should call the Creative OS AI copy endpoint');
assert.match(launchTab, /primaryText: data\.primaryText/, 'AI copy fill should patch primary text into the launch draft');
assert.match(launchTab, /headline: data\.headline/, 'AI copy fill should patch headline into the launch draft');
assert.match(launchTab, /AI fill copy/, 'Launch setup should show a clear AI fill copy button');

assert.match(route, /persona/, 'Launch copy endpoint should use persona context');
assert.match(route, /primaryText/, 'Launch copy endpoint should return primary text');
assert.match(route, /headline/, 'Launch copy endpoint should return headline');
assert.match(route, /OPENROUTER_API_KEY|OPENAI_API_KEY/, 'Launch copy endpoint should support configured AI providers');
