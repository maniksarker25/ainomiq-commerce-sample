import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspace = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');
const groupSource = readFileSync(new URL('../app/dashboard/creative-os/components/library/CreativeLibraryGroupBrowser.tsx', import.meta.url), 'utf8');
const tileSource = readFileSync(new URL('../app/dashboard/creative-os/components/library/CreativeLibraryFileTile.tsx', import.meta.url), 'utf8');
const statusSource = workspace.slice(workspace.indexOf('const updateLibrarySourceStatus'), workspace.indexOf('const deleteTask'));

assert.match(groupSource, /onUpdateSourceStatus\?:/, 'Library browser should accept optional founder-only source status actions');
assert.match(groupSource, /onUpdateSourceStatus=\{onUpdateSourceStatus\}/, 'Library browser should pass source status actions to file tiles');
assert.match(tileSource, /role="menu"/, 'File tiles should render a real actions menu');
assert.match(tileSource, /Open preview/, 'Actions menu should allow opening the preview');
assert.match(tileSource, /<Download size=\{15\} \/> Download/, 'Actions menu should allow downloading the file');
assert.match(tileSource, /Copy Library link/, 'Actions menu should allow copying the Library link');
assert.match(tileSource, /File information/, 'Actions menu should expose file information');
assert.match(tileSource, /Mark do not use/, 'Founder actions should allow pausing a Library file');
assert.match(tileSource, /Mark ready/, 'Founder actions should allow restoring a paused Library file');
assert.match(statusSource, /nextStatus === "do not use"/, 'Source status action should persist a paused state');
assert.match(statusSource, /source\.derivativeCount >= source\.derivativeCap[\s\S]*"maxed out"[\s\S]*stillAssigned[\s\S]*"assigned"[\s\S]*"available"/, 'Restoring a source should preserve used and assigned state correctly');
