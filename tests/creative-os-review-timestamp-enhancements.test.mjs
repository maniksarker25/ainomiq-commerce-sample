import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const reviewTab = readFileSync(
  "app/dashboard/creative-os/components/tabs/ReviewTab.tsx",
  "utf8",
);
const mediaPreview = readFileSync(
  "app/dashboard/creative-os/components/shared/MediaPreview.tsx",
  "utf8",
);

assert.match(mediaPreview, /TimestampedReviewPreview/);
assert.match(mediaPreview, /Timestamp note/);
assert.match(mediaPreview, /formatTimestamp/);
assert.match(reviewTab, /TimestampedReviewPreview/);
assert.match(reviewTab, /REVIEW_ENHANCEMENTS/);
assert.match(reviewTab, /Enhancement:/);
assert.match(reviewTab, /Ads Manager name/);

console.log("creative-os review timestamp notes and enhancements ok");
