import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const accordionSource = readFileSync("components/ui/accordion.tsx", "utf8");
const postBriefsSource = readFileSync(
  "app/dashboard/creative-os/components/tabs/PostBriefsTab.tsx",
  "utf8",
);

assert.doesNotMatch(
  accordionSource,
  /h-\(--radix-accordion-content-height\)/,
  "Open accordion content must not keep a fixed measured height after Magic Fill grows textareas",
);
assert.match(
  postBriefsSource,
  /<AccordionContent className="min-w-0 space-y-3 border-t border-border\/60 pb-4 pt-4">/,
  "Brief content should keep spacing around the extra notes field",
);
