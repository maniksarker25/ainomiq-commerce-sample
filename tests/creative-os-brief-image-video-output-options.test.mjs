import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const typesSource = readFileSync("app/dashboard/creative-os/types.ts", "utf8");
const postBriefsTab = readFileSync(
  "app/dashboard/creative-os/components/tabs/PostBriefsTab.tsx",
  "utf8",
);
const briefEditDialog = readFileSync(
  "app/dashboard/creative-os/components/shared/BriefEditDialog.tsx",
  "utf8",
);

for (const option of [
  "9:16 image ad",
  "9:16 video ad",
  "4:5 image ad",
  "4:5 video ad",
  "1:1 image ad",
  "1:1 video ad",
]) {
  assert.match(typesSource, new RegExp(`"${option}"`), `${option} should be available as a brief output format`);
}

assert.doesNotMatch(
  typesSource,
  /"9:16 story\/reel"/,
  "Brief formats should use explicit image/video ad output labels instead of ambiguous story/reel wording",
);
for (const ratio of ['"9:16"', '"4:5"', '"1:1"']) {
  assert.match(typesSource, new RegExp(`OUTPUT_FORMAT_OPTIONS[\\s\\S]*${ratio.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), `${ratio} should be an output aspect-ratio format`);
}
assert.match(postBriefsTab, /OUTPUT_FORMAT_OPTIONS\.map/, "New briefs should let you pick an aspect-ratio format per video and photo output");
assert.match(postBriefsTab, /Total outputs/, "New briefs should show the total output count");
assert.match(briefEditDialog, /CREATIVE_FORMAT_OPTIONS\.map/, "Edited briefs should render the shared format options");
