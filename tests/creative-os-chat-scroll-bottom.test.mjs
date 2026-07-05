import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const widgets = readFileSync(
  "app/dashboard/creative-os/components/shared/WorkspaceWidgets.tsx",
  "utf8",
);
const workspace = readFileSync(
  "app/dashboard/creative-os/components/CreativeOsWorkspace.tsx",
  "utf8",
);

assert.match(widgets, /useEffect/, "Chat panel should use an effect to react to new messages");
assert.match(widgets, /chatBottomRef/, "Chat panel should keep a bottom anchor for scrolling");
assert.match(widgets, /scrollIntoView\(\{ block: "end"/, "Chat panel should scroll the latest message into view");
assert.match(widgets, /\[messages\.length, selectedRoom\?\.id\]/, "Chat panel should scroll after sends and room changes");
assert.match(widgets, /data-chat-bottom-anchor/, "Chat panel should expose a stable bottom anchor");
assert.match(workspace, /chatMessages: \[\.\.\.current\.chatMessages, message\]/, "Sending should keep the optimistic message visible immediately");
