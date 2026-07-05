import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspaceSource = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');
const taskCardSource = readFileSync(new URL('../app/dashboard/creative-os/components/editor/EditorTaskCard.tsx', import.meta.url), 'utf8');
const formFieldsSource = readFileSync(new URL('../app/dashboard/creative-os/_components/FormFields.tsx', import.meta.url), 'utf8');

const uploadBlock = workspaceSource.slice(
  workspaceSource.indexOf('const uploadFinishedAdFile'),
  workspaceSource.indexOf('const addDeliveryDraftLine'),
);
const editorRenderBlock = workspaceSource.slice(
  workspaceSource.indexOf('items={editorTaskScope.map'),
  workspaceSource.indexOf('<EditorDeliveredCard'),
);

assert.match(formFieldsSource, /multiple=\{multiple\}/, 'Finished ad upload inputs should support selecting multiple files');
assert.match(formFieldsSource, /onUploadFiles\?: \(files: File\[\]\) => void;/, 'Finished ad upload fields should expose a multi-file callback');
assert.match(formFieldsSource, /Array\.from\(event\.currentTarget\.files \|\| \[\]\)/, 'Finished ad upload fields should read every selected file');
assert.match(formFieldsSource, /Select one or multiple videos\/images from your device\./, 'Multi-file upload help should tell editors they can select multiple videos');

assert.match(taskCardSource, /onUploadFinishedAds: \(files: File\[\], index\?: number\) => void;/, 'Editor task cards should accept multi-file upload handling');
assert.match(taskCardSource, /onUploadFiles=\{\(files\) =>[\s\S]*onUploadFinishedAds\(files, index\)/, 'Per-output upload fields should pass multi-file selections through with the starting slot');
assert.match(taskCardSource, /\n\s+multiple\n\s+help=\{deliveryPreviewHelp\(task\)\}/, 'Multi-output upload fields should enable multiple file selection');

assert.match(uploadBlock, /uploadedTaskExpectedOutputs > 1/, 'One-time multi-output uploads should write to the selected output line');
assert.match(uploadBlock, /const uploadFinishedAdFiles = \(/, 'Workspace should upload multiple selected finished ads');
assert.match(uploadBlock, /files\.slice\(0, availableSlots\)/, 'Multi-file upload should not exceed remaining output slots');
assert.match(uploadBlock, /uploadFinishedAdFile\(taskId, file, startIndex \+ offset\)/, 'Each selected file should upload into a separate output slot');
assert.match(editorRenderBlock, /onUploadFinishedAds=\{\(files, index\) =>[\s\S]*remainingOutputs/, 'Editor render should cap multi-file upload to remaining outputs');
