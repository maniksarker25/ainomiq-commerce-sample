import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const groupBrowser = readFileSync(new URL('../app/dashboard/creative-os/components/library/CreativeLibraryGroupBrowser.tsx', import.meta.url), 'utf8');
const modalSource = readFileSync(new URL('../app/dashboard/creative-os/components/library/LibraryPreviewModal.tsx', import.meta.url), 'utf8');
const iconImports = `${groupBrowser}\n${modalSource}`;

assert.match(iconImports, /Download, FolderClosed/, 'Creative OS should import the Download icon');
assert.match(modalSource, /const downloadName = source\.name \|\| `ainomiq-library-\$\{source\.id\}`/, 'Library preview should derive a download filename');
assert.match(modalSource, /href=\{previewUrl\}[\s\S]*download=\{downloadName\}/, 'Library preview download link should point at the resolved Ainomiq Library file');
assert.match(modalSource, /aria-label=\{`Download \$\{source\.name\}`\}/, 'Library preview download button should be accessible');
assert.match(modalSource, /<Download size=\{15\} \/>[\s\S]*<span>Download<\/span>/, 'Library preview should show a visible Download button');
