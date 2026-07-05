import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mediaPreview = readFileSync(
  "app/dashboard/creative-os/components/shared/MediaPreview.tsx",
  "utf8",
);
const editorTaskCard = readFileSync(
  "app/dashboard/creative-os/components/editor/EditorTaskCard.tsx",
  "utf8",
);

assert.match(mediaPreview, /export function parseTimestampedFeedback/, "Timestamped feedback should be parsed by shared media helpers");
assert.match(mediaPreview, /timestampFeedbackPattern/, "Parser should detect feedback lines that start with a video timestamp");
assert.match(mediaPreview, /export function TimestampedFeedbackMarks/, "Shared marker list should render timestamp feedback as marks");
assert.match(mediaPreview, /Video time marks/, "Marker list should clearly label timestamped video feedback");
assert.match(mediaPreview, /timestampToSeconds/, "Timestamp marks should convert timestamps into seekable seconds");
assert.match(mediaPreview, /onSeek\?: \(seconds: number\) => void/, "Timestamp marks should accept a seek handler");
assert.match(mediaPreview, /onClick=\{\(\) => onSeek\?\.\(timestampToSeconds\(mark\.timestamp\)\)\}/, "Clicking a timestamp mark should seek the video");
assert.match(mediaPreview, /aria-label=\{`Jump to \$\{mark\.timestamp\} in submitted video`\}/, "Timestamp mark buttons should be accessible");
assert.match(mediaPreview, /left: `\$\{Math\.min\(100, Math\.max\(0, \(timestampToSeconds\(mark\.timestamp\) \/ duration\) \* 100\)\)\}%`/, "Video timeline should position yellow markers by timestamp");
assert.match(mediaPreview, /bg-amber-400/, "Video timeline marks should be yellow");
assert.match(mediaPreview, /Go to \{mark\.timestamp\} in the submitted video/, "Markers should tell editors to jump to that time");
assert.match(editorTaskCard, /TimestampedFeedbackMarks/, "Editor task cards should render timestamp marks for active revision feedback");
assert.match(editorTaskCard, /<TimestampedFeedbackMarks feedback=\{revisionReview\.feedback\} \/>/, "Active revision feedback should show marker cards");
assert.match(editorTaskCard, /<TimestampedFeedbackMarks feedback=\{feedback\} \/>/, "Delivered revision cards should show marker cards");
