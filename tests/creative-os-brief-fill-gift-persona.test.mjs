import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../app/api/ad-manager/creative-os/brief-fill/route.ts', import.meta.url), 'utf8');

assert.match(route, /function personaMentionsGift/, 'Brief fill should detect gift-searcher personas');
assert.match(route, /Looking for a gift\?/, 'Gift persona fallback should include a direct gift hook');
assert.match(route, /giftIntent/, 'Brief fill should carry gift intent through normalization');
assert.match(route, /ensureGiftPersonaBrief/, 'Brief fill should post-process weak AI output for gift personas');
assert.match(route, /If the selected persona mentions gift/, 'AI prompt should explicitly teach gift-persona hook strategy');
assert.match(route, /Need a useful gift for someone who wears jeans\?/, 'AI prompt should give a concrete gift hook example');
