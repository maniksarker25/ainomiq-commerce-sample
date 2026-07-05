import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspace = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');
const postBriefsTab = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/PostBriefsTab.tsx', import.meta.url), 'utf8');
const tabTypes = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/types.ts', import.meta.url), 'utf8');

assert.match(workspace, /const reopenTask = \(taskId: string\) => \{/, 'Finished briefs should have a direct reopen action');
assert.match(workspace, /const postponeTask = \(taskId: string, days = 3\) => \{/, 'Finished briefs should have a direct postpone action');
assert.match(workspace, /status: "in progress" as TaskStatus/, 'Reopened finished briefs should return to the editor queue');
assert.match(workspace, /sourceUsageLocked: false/, 'Reopened finished briefs should unlock their source assignment');
assert.match(workspace, /safeBaseDate\.getTime\(\) < today\.getTime\(\) \? today : safeBaseDate/, 'Postponing old briefs should not keep them in the past');
assert.match(workspace, /nextDate\.setDate\(nextDate\.getDate\(\) \+ days\)/, 'Postponing should move the due date forward by the requested days');
assert.match(workspace, /reopenTask=\{reopenTask\}/, 'PostBriefsTab should receive the reopen handler');
assert.match(workspace, /postponeTask=\{postponeTask\}/, 'PostBriefsTab should receive the postpone handler');

assert.match(tabTypes, /reopenTask: \(taskId: string\) => void;/, 'PostBriefsTab props should type the reopen handler');
assert.match(tabTypes, /postponeTask: \(taskId: string, days\?: number\) => void;/, 'PostBriefsTab props should type the postpone handler');

assert.match(postBriefsTab, /<RefreshCcw size=\{15\} \/> Reopen/, 'Finished brief cards should expose Reopen');
assert.match(postBriefsTab, /<CalendarClock size=\{15\} \/> Postpone 3 days/, 'Finished one-time brief cards should expose Postpone');
assert.match(postBriefsTab, /task\.scheduleType !== "returning"/, 'Postpone should only show where a direct due date can be moved');
