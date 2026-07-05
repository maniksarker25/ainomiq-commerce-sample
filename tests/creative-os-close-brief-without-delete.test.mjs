import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspace = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');
const postBriefsTab = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/PostBriefsTab.tsx', import.meta.url), 'utf8');
const postedBriefCard = readFileSync(new URL('../app/dashboard/creative-os/components/shared/PostedBriefCard.tsx', import.meta.url), 'utf8');
const tabTypes = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/types.ts', import.meta.url), 'utf8');

const closeTaskSource = workspace.slice(workspace.indexOf('const closeTask'), workspace.indexOf('const deleteTask'));

assert.match(workspace, /const closeTask = \(taskId: string\) => \{/, 'Active briefs should have a non-destructive close action');
assert.match(closeTaskSource, /status: "delivered" as TaskStatus/, 'Closing a brief should move it to finished history');
assert.match(closeTaskSource, /sourceUsageLocked: true/, 'Closing a brief should preserve completed source usage state');
assert.doesNotMatch(closeTaskSource, /status: "archived"/, 'Closing a brief must not archive/delete it');
assert.doesNotMatch(closeTaskSource, /deletedTaskIds|deletedDeliveredEditIds|deletedReviewIds/, 'Closing a brief must not tombstone or hide connected work');
assert.match(workspace, /closeTask=\{closeTask\}/, 'PostBriefsTab should receive the close handler');

assert.match(tabTypes, /closeTask: \(taskId: string\) => void;/, 'PostBriefsTab props should type the close handler');
assert.match(postBriefsTab, /closeTask,/, 'PostBriefsTab should destructure the close handler');
assert.match(postBriefsTab, /onClose=\{\(\) => closeTask\(task\.id\)\}/, 'Posted brief cards should wire Close brief');

assert.match(postedBriefCard, /onClose: \(\) => void;/, 'PostedBriefCard should accept a close handler');
assert.match(postedBriefCard, /<CheckCircle2 size=\{15\} \/> Close brief/, 'PostedBriefCard should expose a clear Close brief button');
assert.match(postedBriefCard, /aria-label=\{`Close brief \$\{task\.brief\}`\}/, 'Close brief should have an accessible label');
