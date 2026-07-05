import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');
const editorTaskCardSource = readFileSync(new URL('../app/dashboard/creative-os/components/editor/EditorTaskCard.tsx', import.meta.url), 'utf8');
const editorInfoSource = readFileSync(new URL('../app/dashboard/creative-os/components/editor/EditorInfoPanel.tsx', import.meta.url), 'utf8');
const editorBlock = source.slice(source.lastIndexOf('if (isCreativeEditor) {'), source.indexOf('{(state.activeSection === "dashboard"'));
const editorUiSource = `${editorBlock}\n${editorTaskCardSource}\n${editorInfoSource}`;

assert.match(editorBlock, /label: "Library"/, 'Editor portal navigation should call the source tab Library');
assert.doesNotMatch(editorBlock, /label: "Source material"/, 'Editor portal navigation must not use Source material as module name');
assert.match(editorUiSource, /Open Library/, 'Editor task cards should link to the Library');
assert.match(editorUiSource, /Library tab/, 'Editor help copy should refer to the Library tab');
assert.match(editorUiSource, /<strong[\s\S]*>Library:<\/strong>/, 'Editor brief cards should label assigned sources as Library');
