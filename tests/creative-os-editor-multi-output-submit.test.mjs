import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspaceSource = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');
const taskCardSource = readFileSync(new URL('../app/dashboard/creative-os/components/editor/EditorTaskCard.tsx', import.meta.url), 'utf8');

const markDeliveredBlock = workspaceSource.slice(
  workspaceSource.indexOf('const markTaskDelivered'),
  workspaceSource.indexOf('const approveReview'),
);
const editorRenderBlock = workspaceSource.slice(
  workspaceSource.indexOf('items={editorTaskScope.map'),
  workspaceSource.indexOf('<EditorDeliveredCard'),
);

assert.match(taskCardSource, /const multipleOutputs = returning \|\| expectedOutputs > 1/, 'Editor task cards should treat one-time briefs with multiple outputs as multi-output submissions');
assert.match(taskCardSource, /\{multipleOutputs \? \(/, 'Editor task card should render per-output upload rows for multi-output briefs');
assert.match(editorRenderBlock, /const hasMultipleOutputs =[\s\S]*isReturningBrief\(task\) \|\| expectedOutputs > 1/, 'Editor render should allocate draft slots for one-time multi-output briefs');
assert.match(editorRenderBlock, /const draftSlots = hasMultipleOutputs/, 'Draft slot count should use multi-output detection');
assert.match(markDeliveredBlock, /const multipleOutputs = returning \|\| expectedOutputs > 1/, 'Submit validation should treat outputCount > 1 as multi-output even when not returning');
assert.match(markDeliveredBlock, /const existingDeliveredCount = multipleOutputs/, 'Existing submitted output count should be used for all multi-output briefs');
assert.match(markDeliveredBlock, /const deliveryPairs = multipleOutputs/, 'Submit payload should keep separate delivery pairs for all multi-output briefs');
assert.match(markDeliveredBlock, /const existingEdit = multipleOutputs[\s\S]*\? null/, 'Multi-output briefs should create one delivered edit per submitted output instead of overwriting one edit');
assert.match(markDeliveredBlock, /approvedCountForTask\(current, task\.id\) >= expectedOutputs/, 'Multi-output briefs should only close after all requested outputs are approved');
