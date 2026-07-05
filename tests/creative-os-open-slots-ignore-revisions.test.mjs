import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspaceSource = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');
const postBriefsTab = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/PostBriefsTab.tsx', import.meta.url), 'utf8');

assert.match(workspaceSource, /function occupiedOutputCountForTask/, 'Editor slot count should use active occupied outputs, not raw delivered edits');
assert.match(workspaceSource, /review\.status === "ready"/, 'Only ready reviews should block another editor upload slot');
assert.match(workspaceSource, /state\.launchItems\.forEach/, 'Approved launch items should still occupy output slots');
assert.match(workspaceSource, /const existingDeliveredCount = multipleOutputs[\s\S]*occupiedOutputCountForTask\(state, taskId\)/, 'Pre-submit validation should ignore revision-requested and orphan delivered edits');
assert.match(workspaceSource, /const submittedOutputs = occupiedOutputCountForTask\([\s\S]*state,[\s\S]*task\.id,[\s\S]*\)/, 'Editor task cards should show open slots from active submissions plus approvals');

assert.match(postBriefsTab, /const pendingReviewEditIds = new Set/, 'Post Briefs progress should separate active pending review slots');
assert.match(postBriefsTab, /review\.status !== "ready"[\s\S]*return/, 'Revision requested reviews should not count as submitted/blocking slots');
assert.match(postBriefsTab, /submittedCount: approvedCount \+ pendingReviewCount/, 'Submitted count should mean approved plus active pending review, not stale delivered edits');
assert.match(postBriefsTab, /openCount: Math\.max\(0, requestedCount - approvedCount - pendingReviewCount\)/, 'Open count should reopen slots for revision-requested or orphan delivered edits');
