import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const postBriefsTab = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/PostBriefsTab.tsx', import.meta.url), 'utf8');
const workspaceWidgets = readFileSync(new URL('../app/dashboard/creative-os/components/shared/WorkspaceWidgets.tsx', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');
const tabTypes = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/types.ts', import.meta.url), 'utf8');

assert.match(tabTypes, /refreshBriefPersonas: \(\) => void/, 'Post Briefs props should expose a persona refresh action');
assert.match(tabTypes, /briefPersonasRefreshing: boolean/, 'Post Briefs props should expose persona refresh loading state');
assert.match(workspace, /refreshBriefPersonas=\{\(\) => upgradeStrategyList\("personas"\)\}/, 'Workspace should refresh brief audiences from product persona AI upgrade');
assert.match(postBriefsTab, /refreshBriefPersonas/, 'Post Briefs should pass refresh action to StrategyPicker');
assert.match(postBriefsTab, /briefPersonasRefreshing/, 'Post Briefs should pass refresh loading state to StrategyPicker');
assert.match(workspaceWidgets, /Refresh \{groupLabel\.toLowerCase\(\)\}/, 'Strategy picker should show a refresh button for the active tab');
assert.match(workspaceWidgets, /onRefreshPersonas/, 'Audience picker should accept a refresh callback');
assert.match(workspaceWidgets, /personasRefreshing/, 'Audience picker should show loading state while refreshing');
