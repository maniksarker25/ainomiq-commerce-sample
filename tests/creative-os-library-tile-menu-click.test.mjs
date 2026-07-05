import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tileSource = readFileSync(new URL('../app/dashboard/creative-os/components/library/CreativeLibraryFileTile.tsx', import.meta.url), 'utf8');

assert.match(tileSource, /const openFile = \(\) => \{[\s\S]*onPreviewSource\(source\.id\)/, 'Library tiles should have a shared open handler');
assert.match(tileSource, /aria-label=\{`More actions for \$\{source\.name\}`\}/, 'Three-dot file control should be an accessible actions menu button');
assert.match(tileSource, /<MoreVertical size=\{15\} \/>/, 'The visible three-dot control should remain on file tiles');
assert.match(tileSource, /aria-label=\{`Preview Library file \$\{source\.name\}`\}/, 'Preview area should stay clickable independently');
assert.match(tileSource, /return \(\s*<div className=\{`group relative overflow-visible/, 'Library file tiles should avoid nesting buttons by using a non-button card wrapper');
