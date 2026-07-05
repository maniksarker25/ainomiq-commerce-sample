import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');
const editorTaskCardSource = readFileSync(new URL('../app/dashboard/creative-os/components/editor/EditorTaskCard.tsx', import.meta.url), 'utf8');
const editorInfoSource = readFileSync(new URL('../app/dashboard/creative-os/components/editor/EditorInfoPanel.tsx', import.meta.url), 'utf8');
const tasksSource = readFileSync(new URL('../app/dashboard/creative-os/lib/tasks.ts', import.meta.url), 'utf8');
const formFieldsSource = readFileSync(new URL('../app/dashboard/creative-os/_components/FormFields.tsx', import.meta.url), 'utf8');
const editorBlock = source.slice(source.lastIndexOf('if (isCreativeEditor) {'), source.indexOf('<ProductsTab'));
const editorUiSource = `${editorBlock}\n${editorTaskCardSource}\n${editorInfoSource}\n${tasksSource}`;
const markDeliveredBlock = source.slice(source.indexOf('const markTaskDelivered'), source.indexOf('const approveReview'));

assert.match(formFieldsSource, /export function LibraryFileSelect/, 'Editor submissions should use a dedicated Library file selector');
assert.match(editorBlock, /const sourceOptions = librarySourceOptions\(taskSources\)/, 'Editor task cards should build selectable Library file options from assigned brief sources');
assert.match(editorUiSource, /<LibraryFileSelect[\s\S]*label=\{deliverySourceLabel\(task\)\}[\s\S]*options=\{sourceOptions\}/, 'Submit work should render a Library file dropdown instead of a pasted source link field');
assert.doesNotMatch(editorUiSource, /Source link used/, 'Editor portal must not refer to submitted source selection as Source link used');
assert.doesNotMatch(editorUiSource, /Paste source folder or raw file link/, 'Editor portal must not ask editors to paste raw source links');
assert.match(editorUiSource, /Choose the exact Library file you used for the edit\./, 'Editor help should explain Library file selection');
assert.match(markDeliveredBlock, /const defaultLibrarySourceUrls = librarySourceOptions\([\s\S]*assignedTaskSources[\s\S]*\)\.map\(\(option\) => option\.value\)/, 'Submission validation should fall back to assigned Library files when the dropdown default is unchanged');
assert.match(markDeliveredBlock, /Choose the Library file used before requesting approval\./, 'Validation copy should refer to Library files');
