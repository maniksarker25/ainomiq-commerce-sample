import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');
const editorBlock = source.slice(source.lastIndexOf('if (isCreativeEditor) {'), source.indexOf('{(state.activeSection === "dashboard"'));
const libraryBrowser = readFileSync(new URL('../app/dashboard/creative-os/components/library/CreativeLibraryGroupBrowser.tsx', import.meta.url), 'utf8');

assert.match(editorBlock, /const scopedSourceIds = new Set\([\s\S]*editorTaskScope\.map\(\(task\) => task\.sourceCreativeId\)/, 'Editor Library starts from assigned task source ids');
assert.match(editorBlock, /const scopedGroupKeys = new Set\([\s\S]*editorTaskScope\.map\(\(task\) => task\.sourceGroupKey\)/, 'Editor Library includes assigned task source groups');
assert.match(editorBlock, /const editorSources = productSources\.filter/, 'Editor Library filters product sources before rendering');
assert.match(editorBlock, /editorSources\.find\(\(source\) => source\.id === libraryPreviewSourceId\)/, 'Editor preview modal is limited to assigned editor sources');
assert.match(editorBlock, /<CreativeLibraryGroupBrowser[\s\S]*group=\{group\}[\s\S]*onPreviewSource=\{setLibraryPreviewSourceId\}/, 'Editors use the same Library folder/file browser as owners');
assert.match(editorBlock, /Only source files assigned through your briefs are visible here\./, 'Editor Library explains its scoped visibility');
assert.match(libraryBrowser, /onDeleteGroup\?:/, 'Library browser delete action can be hidden for read-only editor use');
assert.match(libraryBrowser, /onDeleteGroup \? \(/, 'Library browser hides delete button when no delete handler is provided');
