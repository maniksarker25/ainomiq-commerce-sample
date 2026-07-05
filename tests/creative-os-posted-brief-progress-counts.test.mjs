import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const postBriefsTab = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/PostBriefsTab.tsx', import.meta.url), 'utf8');
const postedBriefCard = readFileSync(new URL('../app/dashboard/creative-os/components/shared/PostedBriefCard.tsx', import.meta.url), 'utf8');

assert.match(postBriefsTab, /function briefProgressForTask/, 'Post Briefs should derive submitted, approved, and open counts per brief');
assert.match(postBriefsTab, /state\.launchItems\.filter\([\s\S]*editIds\.has\(item\.deliveredEditId\)/, 'Approved count should come from launch items linked to the brief edits');
assert.match(postBriefsTab, /notApprovedCount: pendingReviewCount/, 'Not approved count should be active pending review work only');
assert.match(postBriefsTab, /openCount: Math\.max\(0, requestedCount - approvedCount - pendingReviewCount\)/, 'Open count should return slots after revision feedback removes or deactivates a submitted edit');
assert.match(postBriefsTab, /progress=\{briefProgressForTask\(state, task\)\}/, 'Posted brief cards should receive progress counts');
assert.match(postedBriefCard, /Submitted/, 'Posted brief card should show submitted count');
assert.match(postedBriefCard, /Approved/, 'Posted brief card should show approved count');
assert.match(postedBriefCard, /Not approved/, 'Posted brief card should show not approved count');
assert.match(postedBriefCard, /Open/, 'Posted brief card should show remaining open slots');
