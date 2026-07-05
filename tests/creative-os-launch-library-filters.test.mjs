import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const launchSource = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/LaunchTab.tsx', import.meta.url), 'utf8');

assert.match(launchSource, /type LaunchStatusFilter = "all" \| "ready" \| "uploaded" \| "live"/, 'Launch library should define status filters');
assert.match(launchSource, /const \[launchStatusFilter, setLaunchStatusFilter\]/, 'Launch library should keep a selected status filter');
assert.match(launchSource, /const \[launchBriefFilter, setLaunchBriefFilter\]/, 'Launch library should keep a selected brief filter');
assert.match(launchSource, /const launchBriefOptions = useMemo/, 'Launch library should derive brief filter options');
assert.match(launchSource, /const filteredLaunchItems = useMemo/, 'Launch library should derive filtered launch items');
assert.match(launchSource, /item\.status !== launchStatusFilter/, 'Launch library status filter should hide non-matching items');
assert.match(launchSource, /context\.task\?\.id \|\| item\.deliveredEditId/, 'Launch library brief filter should match items by brief/task');
assert.match(launchSource, /items=\{filteredLaunchItems\.map/, 'Launch grid should render filtered launch items');
assert.match(launchSource, /Select all visible ready/, 'Batch select should be scoped to visible filtered ready ads');
