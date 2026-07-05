import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspace = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');
const libraryUrlSource = readFileSync(new URL('../app/dashboard/creative-os/lib/library-urls.ts', import.meta.url), 'utf8');
const groupBrowser = readFileSync(new URL('../app/dashboard/creative-os/components/library/CreativeLibraryGroupBrowser.tsx', import.meta.url), 'utf8');
const fileTile = readFileSync(new URL('../app/dashboard/creative-os/components/library/CreativeLibraryFileTile.tsx', import.meta.url), 'utf8');
const previewModal = readFileSync(new URL('../app/dashboard/creative-os/components/library/LibraryPreviewModal.tsx', import.meta.url), 'utf8');
const libraryBrowser = `${groupBrowser}\n${fileTile}`;
const libraryUrlFunction = libraryUrlSource.slice(libraryUrlSource.indexOf('export function sourceLibraryUrl'), libraryUrlSource.indexOf('export function isAinomiqStoredSource'));

assert.match(libraryUrlSource, /function sourceLibraryUrl/, 'Creative OS has a dedicated Library URL resolver');
assert.match(libraryUrlFunction, /backendFolderUrl/, 'Library URL resolver prefers stored backend URLs');
assert.match(libraryUrlFunction, /creator === "Ainomiq Library Upload"/, 'Library URL resolver only falls back to assetUrl for uploaded/imported Library assets');
assert.match(libraryUrlFunction, /!isGoogleHostedSource/, 'Library URL resolver rejects Google-hosted URLs');
assert.match(libraryBrowser, /const sourceUrl = sourceLibraryUrl\(source\);/, 'Library browser opens only the resolved Library URL');
assert.match(libraryBrowser, /function CreativeLibraryFileTile/, 'Library browser renders in-app file tiles');
assert.match(libraryBrowser, /CreativeLibraryVideoThumb/, 'Library browser renders stored video previews through the thumbnail component');
assert.match(`${workspace}\n${previewModal}`, /function enableVideoAudio/, 'Playable video previews explicitly enable audio');
assert.doesNotMatch(`${workspace}\n${previewModal}`, /controls muted/, 'Video elements with controls must not be forced muted');
assert.doesNotMatch(
  libraryBrowser,
  /source\.assetUrl \|\| source\.originalAssetUrl \|\| source\.importSourceUrl \|\| source\.importUrl/,
  'Library browser must not fall back to original Google/reference links',
);
