import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const launchRoute = readFileSync(new URL('../app/api/ad-manager/creative-os/launch-to-meta/route.ts', import.meta.url), 'utf8');

assert.match(launchRoute, /async function loadVideoThumbnailUrl\(token: string, videoId: string\)/, 'Launch API should load a Meta-generated thumbnail after video upload');
assert.match(launchRoute, /\/thumbnails\?fields=uri,is_preferred&limit=10/, 'Launch API should query Meta video thumbnails');
assert.match(launchRoute, /fields=thumbnails\{uri,is_preferred\}/, 'Launch API should fall back to nested video thumbnails');
assert.match(launchRoute, /function createMetaFallbackThumbnailPng\(\)/, 'Launch API should generate a fallback thumbnail when Meta thumbnails lag');
assert.match(launchRoute, /thumbnailImageHash = thumbnailUrl[\s\S]*uploadMetaImageHash/, 'Video uploads should fall back to a Meta image hash');
assert.match(launchRoute, /return "";/, 'Missing Meta thumbnails should not fail the whole launch');
assert.match(launchRoute, /video_data: \{[\s\S]*video_id: media\.id,[\s\S]*media\.thumbnailUrl \? \{ image_url: media\.thumbnailUrl \} : \{ image_hash: media\.thumbnailImageHash \}/, 'Video ad creatives should include image_url or image_hash in video_data');
