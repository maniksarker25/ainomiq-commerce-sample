import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tileSource = readFileSync(new URL('../app/dashboard/creative-os/components/library/CreativeLibraryFileTile.tsx', import.meta.url), 'utf8');
const thumbSource = readFileSync(new URL('../app/dashboard/creative-os/components/library/CreativeLibraryVideoThumb.tsx', import.meta.url), 'utf8');

assert.match(tileSource, /<CreativeLibraryVideoThumb[\s\S]*src=\{sourceUrl\}[\s\S]*poster=\{source\.thumbnailUrl \|\| ""\}[\s\S]*name=\{source\.name\}[\s\S]*\/>/, 'Video Library tiles should use a real thumbnail component');
assert.match(thumbSource, /preload="auto"/, 'Video thumbnails should request enough data to render a frame');
assert.match(thumbSource, /onLoadedMetadata=\{event => showPreviewFrame\(event\.currentTarget\)\}/, 'Video thumbnails should seek a preview frame when metadata loads');
assert.match(thumbSource, /onLoadedData=\{event => showPreviewFrame\(event\.currentTarget\)\}/, 'Video thumbnails should become visible when video data is available');
assert.match(thumbSource, /Loading preview/, 'Video thumbnails should show a loading state instead of a blank white tile');
assert.match(thumbSource, /Open to preview/, 'Video thumbnails should show a useful fallback if the thumbnail frame cannot load');
