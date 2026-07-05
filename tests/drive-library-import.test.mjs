import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../lib/google-drive.ts', import.meta.url), 'utf8');
const importerSource = source.slice(source.indexOf('export async function importDriveLinksToAinomiqLibrary'));

assert.match(source, /export async function importDriveLinksToAinomiqLibrary/, 'exports Drive-to-Ainomiq Library importer');
assert.match(source, /alt:\s*['"]media['"]/, 'downloads original Drive file bytes instead of linking to Drive');
assert.match(source, /createCreativeLibraryAsset/, 'persists imported files as Creative Library assets');
assert.match(source, /sourceFolderPath/, 'preserves original folder path metadata');
assert.doesNotMatch(importerSource, /copyDriveFileToFolder/, 'new importer must not copy files back into Google Drive');
