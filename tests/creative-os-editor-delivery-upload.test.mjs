import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');
const editorTaskCardSource = readFileSync(new URL('../app/dashboard/creative-os/components/editor/EditorTaskCard.tsx', import.meta.url), 'utf8');
const editorInfoSource = readFileSync(new URL('../app/dashboard/creative-os/components/editor/EditorInfoPanel.tsx', import.meta.url), 'utf8');
const tasksSource = readFileSync(new URL('../app/dashboard/creative-os/lib/tasks.ts', import.meta.url), 'utf8');
const formFieldsSource = readFileSync(new URL('../app/dashboard/creative-os/_components/FormFields.tsx', import.meta.url), 'utf8');
const editorBlock = source.slice(source.lastIndexOf('if (isCreativeEditor) {'), source.indexOf('<ProductsTab'));
const editorUiSource = `${editorBlock}\n${editorTaskCardSource}\n${editorInfoSource}\n${tasksSource}`;
const uploadHelperBlock = source.slice(source.indexOf('const uploadFinishedAdFile'), source.indexOf('const addDeliveryDraftLine'));
const uploadFieldBlock = formFieldsSource.slice(formFieldsSource.indexOf('export function FinishedAdUploadField'), formFieldsSource.indexOf('export function LibraryFileSelect'));
const markDeliveredBlock = source.slice(source.indexOf('const markTaskDelivered'), source.indexOf('const approveReview'));

assert.match(formFieldsSource, /export function FinishedAdUploadField/, 'Editor submit flow should render a dedicated finished ad upload field');
assert.match(editorUiSource, /<FinishedAdUploadField[\s\S]*label="Finished ad file"/, 'Returning brief rows should upload a finished ad file instead of rendering a link input');
assert.match(editorUiSource, /<FinishedAdUploadField[\s\S]*label=\{deliveryPreviewLabel\(task\)\}/, 'One-time briefs should upload a finished ad file instead of rendering a link input');
assert.match(uploadFieldBlock, /type="file"[\s\S]*accept="video\/\*,image\/\*"/, 'Finished ad upload should accept video and image files');
assert.match(uploadHelperBlock, /\/api\/creative-library\/upload-url/, 'Finished ad uploads should request a direct storage upload URL');
assert.match(uploadHelperBlock, /method:\s*upload\.method \|\| "PUT"/, 'Finished ad files should upload directly to storage instead of buffering through the app route');
assert.match(uploadHelperBlock, /\/api\/creative-library\/complete-upload/, 'Finished ad uploads should register the uploaded storage object in the Ainomiq Library');
assert.match(uploadHelperBlock, /creative-os-delivery/, 'Finished ad uploads should be tagged as delivery assets');
assert.match(uploadHelperBlock, /updateDeliveryDraftLine\(taskId, "previewUrl", index, assetUrl\)/, 'Returning uploads should write the returned Ainomiq URL into the correct delivery slot');
assert.match(uploadHelperBlock, /updateDeliveryDraft\(taskId, "previewUrl", assetUrl\)/, 'One-time uploads should write the returned Ainomiq URL into the delivery draft');
assert.match(markDeliveredBlock, /Upload the finished ad file before requesting approval/, 'Validation should ask editors to upload a finished ad file');
assert.doesNotMatch(editorUiSource, /Paste finished video file link|Finished ad link/, 'Editor submit UI must not ask for a finished ad link');
