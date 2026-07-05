import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspace = readFileSync(
  "app/dashboard/creative-os/components/CreativeOsWorkspace.tsx",
  "utf8",
);
const editorCard = readFileSync(
  "app/dashboard/creative-os/components/editor/EditorTaskCard.tsx",
  "utf8",
);
const naming = readFileSync(
  "app/dashboard/creative-os/lib/ad-naming.ts",
  "utf8",
);

assert.match(naming, /buildCreativeOsAdName/);
assert.match(naming, /DEFAULT_AD_NAMING_TEMPLATE/);
assert.match(editorCard, /Ads Manager name/);
assert.match(editorCard, /suggestedAdName/);
assert.match(workspace, /suggestedAdNameForTask/);
assert.match(workspace, /adName: edit\.adName/);
assert.match(workspace, /recommendedAdName:\s+review\.adName/);

console.log("creative-os editor ad naming wiring ok");
