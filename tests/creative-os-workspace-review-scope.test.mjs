import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');
const reviewSource = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/ReviewTab.tsx', import.meta.url), 'utf8');
const launchSource = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/LaunchTab.tsx', import.meta.url), 'utf8');

assert.match(source, /const workspaceReviews = state\.reviews\.filter\(\(review\) =>[\s\S]*visibleProductIds\.has\(review\.productId\)/, 'Review queue is scoped to the whole visible workspace');
assert.match(source, /const workspaceLaunchItems = state\.launchItems\.filter\(\(item\) =>[\s\S]*visibleProductIds\.has\(item\.productId\)/, 'Launch queue is scoped to the whole visible workspace');
assert.match(source, /review: readyReviewCount/, 'Review badge uses the same visible ready-review count as Review Ads');
assert.match(source, /workspaceReviews\.filter\([\s\S]*review\.status === "ready"/, 'Review badge counts only ready workspace reviews');
assert.match(reviewSource, /items=\{readyReviews\.map/, 'Review Ads renders all visible ready workspace reviews, not only the active product');
assert.doesNotMatch(reviewSource, /items=\{productReviews\.map/, 'Review Ads must not render only the active product queue');
assert.match(launchSource, /const visibleLaunchItems = workspaceLaunchItems\.filter/, 'Launch keeps its queue scoped to workspace launch items');
assert.match(launchSource, /items=\{visibleLaunchItems\.map/, 'Launch renders all visible workspace launch items, not only the active product');
