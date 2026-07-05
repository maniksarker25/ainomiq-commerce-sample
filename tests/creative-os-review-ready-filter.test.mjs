import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reviewTabSource = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/ReviewTab.tsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');
const requestRevisionBlock = workspaceSource.slice(
  workspaceSource.indexOf('const requestRevision'),
  workspaceSource.indexOf('const updateReviewFeedback'),
);

assert.match(reviewTabSource, /const readyReviews = workspaceReviews\.filter\([\s\S]*review\.status === "ready"/, 'Review Ads should only list ads that are still ready for review');
assert.match(reviewTabSource, /!hiddenRevisionReviewIds\.includes\(review\.id\)/, 'Review Ads should hide revision requests immediately after the click');
assert.match(reviewTabSource, /!\["sending", "sent"\]\.includes\(revisionSendStatus\[review\.id\] \|\| ""\)/, 'Review Ads should optimistically hide revision requests while they are sending or sent');
assert.match(reviewTabSource, /items=\{readyReviews\.map\(\(review\) => \{/, 'Review Ads grid should render the filtered ready review list');

assert.match(workspaceSource, /const readyReviewCount = useMemo\([\s\S]*review\.status === "ready"/, 'Review Ads sidebar badge should only count visible ready reviews');
assert.match(workspaceSource, /const readyReviewCount = useMemo\([\s\S]*!hiddenRevisionReviewIds\.includes\(review\.id\)/, 'Review Ads sidebar badge should hide locally dismissed revision requests');
assert.match(workspaceSource, /const readyReviewCount = useMemo\([\s\S]*!\["sending", "sent"\]\.includes\(revisionSendStatus\[review\.id\] \|\| ""\)/, 'Review Ads sidebar badge should hide revision requests while sending or sent');
assert.match(workspaceSource, /review: readyReviewCount/, 'Review Ads sidebar badge should use the same ready-review count as the visible list');
assert.match(workspaceSource, /deletedReviewIds: uniqueStrings\(\[[\s\S]*reviewId/, 'Revision feedback should persistently remove the review from the open review queue');
assert.match(workspaceSource, /reviews: baseState\.reviews\.filter\(\(item\) => item\.id !== reviewId\)/, 'Revision feedback should remove the review card from state instead of leaving it ready');
assert.match(workspaceSource, /deletedDeliveredEditIds: edit[\s\S]*uniqueStrings\(\[[\s\S]*edit\.id/, 'Revision feedback should tombstone the rejected delivery so editor output slots reopen and stale sync cannot restore it');
assert.match(workspaceSource, /deliveredEdits: edit[\s\S]*baseState\.deliveredEdits\.filter\(\(item\) => item\.id !== edit\.id\)/, 'Revision feedback should remove the rejected delivery from submitted output counts');
assert.match(workspaceSource, /setHiddenRevisionReviewIds\(\(current\) =>[\s\S]*\[\.\.\.current, reviewId\]/, 'Revision feedback should immediately hide the clicked review locally');
assert.match(workspaceSource, /setHiddenRevisionReviewIds\(\(current\) =>[\s\S]*current\.filter\(\(id\) => id !== reviewId\)/, 'Failed revision feedback should restore the review card');
assert.match(workspaceSource, /latestStateRef\.current = baseState;[\s\S]*setState\(baseState\);/, 'Failed revision feedback should restore the previous state');
assert.match(workspaceSource, /edit\?\.taskId === task\.id && task\.status !== "archived"[\s\S]*status: "in progress" as TaskStatus/, 'Revision feedback should reopen the task for editor changes even if it was already closed');
assert.doesNotMatch(requestRevisionBlock, /setTimeout\(\(\) => \{[\s\S]*delete next\[reviewId\]/, 'Sent revision feedback should not be unhidden by a timeout while the page is open');
