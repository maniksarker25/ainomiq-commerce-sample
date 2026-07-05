import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const launchTab = readFileSync(
  "app/dashboard/creative-os/components/tabs/LaunchTab.tsx",
  "utf8",
);

assert.match(launchTab, /filteredUploadedIds/);
assert.match(launchTab, /selectedVisibleUploadedIds/);
assert.match(launchTab, /Select all visible created/);
assert.match(launchTab, /Back to Ready/);
assert.match(launchTab, /moveSelectedUploadedBackToReady/);
assert.match(launchTab, /metaAdId: ""/);
assert.match(launchTab, /Select created/);
assert.match(launchTab, /sticky top-3/);
assert.match(launchTab, /selectedLaunchCount/);
assert.match(launchTab, /Clear all/);
assert.match(launchTab, /Same copy for all/);
assert.match(launchTab, /Different per ad/);
assert.match(launchTab, /Fill all same/);
assert.match(launchTab, /Fill all different/);
assert.match(launchTab, /launchCopyModeByLaunchId/);
assert.match(launchTab, /Batch cart/);
assert.match(launchTab, /activeBatchCopyItemByLaunchId/);
assert.match(launchTab, /Edit one ad at a time/);
assert.match(launchTab, /lg:sticky lg:top-20/);

console.log("creative-os launch created bulk actions ok");
