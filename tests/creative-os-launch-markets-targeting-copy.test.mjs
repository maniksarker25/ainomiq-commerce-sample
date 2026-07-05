import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/LaunchTab.tsx', import.meta.url), 'utf8');

assert.match(source, /const usesCopiedTargeting = draft\.adsetMode === "new" && Boolean\(draft\.targetingSourceAdsetId\);/, 'Launch setup should detect when a live ad set targeting template is selected');
assert.match(source, /\{usesCopiedTargeting \? "Country targeting \(copied\)" : "Country targeting"\}/, 'Geo label should use clear country targeting language');
assert.match(source, /value=\{usesCopiedTargeting \? "Copied from selected live ad set" : draft\.markets\}/, 'Copied targeting should not show stale manual country values');
assert.match(source, /placeholder="NL, BE, DE"/, 'Default targeting should show country-code examples');
assert.match(source, /disabled=\{usesCopiedTargeting\}/, 'Country input should be disabled when copied targeting will override it');
assert.match(source, /Country targeting, ages, audiences and placements come from that ad set\./, 'Copied targeting mode should explain the full targeting source');
assert.match(source, /Countries for default Meta targeting\. Use country codes like NL, BE, DE\./, 'Default targeting mode should explain what the field controls');
