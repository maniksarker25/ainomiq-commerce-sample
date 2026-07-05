import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mediaPreview = readFileSync(
  "app/dashboard/creative-os/components/shared/MediaPreview.tsx",
  "utf8",
);

assert.match(mediaPreview, /const \[videoActive, setVideoActive\] = useState\(false\)/, "Review videos should not mount immediately");
assert.match(mediaPreview, /\{!videoActive \? \(/, "Review video preview should render a lightweight placeholder first");
assert.match(mediaPreview, /onClick=\{\(\) => setVideoActive\(true\)\}/, "Review video should activate only on user intent");
assert.match(mediaPreview, /preload="none"/, "Active review video should avoid eager buffering");
assert.match(mediaPreview, /setVideoActive\(true\);[\s\S]*requestAnimationFrame/, "Timestamp seek should activate the video before seeking");
assert.match(mediaPreview, /disableRemotePlayback/, "Review player should disable extra remote playback work");
