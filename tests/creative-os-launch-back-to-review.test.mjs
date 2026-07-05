import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspaceSource = readFileSync(new URL("../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx", import.meta.url), "utf8");
const launchTabSource = readFileSync(new URL("../app/dashboard/creative-os/components/tabs/LaunchTab.tsx", import.meta.url), "utf8");
const tabTypesSource = readFileSync(new URL("../app/dashboard/creative-os/components/tabs/types.ts", import.meta.url), "utf8");

assert.match(tabTypesSource, /moveLaunchItemBackToReview: \(launchId: string\) => void/, "Launch tab props should expose a callback to move launch items back to review");
assert.match(launchTabSource, /moveLaunchItemBackToReview/, "Launch tab should receive the back-to-review callback");
assert.match(launchTabSource, /Move back to review/, "Launch cards should show a Move back to review action");
assert.match(workspaceSource, /const moveLaunchItemBackToReview = \(launchItemId: string\) => \{[\s\S]*status: "ready" as ReviewStatus/, "Workspace should rebuild a ready review item from the launch item");
assert.match(workspaceSource, /reviews: \[\.\.\.current\.reviews, review\]/, "Moving back should add the rebuilt item to the review queue");
assert.match(workspaceSource, /launchItems: current\.launchItems\.filter\(\(item\) => item\.id !== launchItemId\)/, "Moving back should remove the item from Launch");
assert.match(workspaceSource, /activeSection: "review"/, "Moving back should take the user to Review Ads");
assert.match(workspaceSource, /moveLaunchItemBackToReview=\{moveLaunchItemBackToReview\}/, "Workspace should pass the callback into LaunchTab");
