import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');
const postBriefsSource = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/PostBriefsTab.tsx', import.meta.url), 'utf8');
const sourcesLib = readFileSync(new URL('../app/dashboard/creative-os/lib/sources.ts', import.meta.url), 'utf8');
const usageCountSource = sourcesLib.slice(sourcesLib.indexOf('export function approvedSourceUsageCount'), sourcesLib.length);
const approveReviewSource = source.slice(source.indexOf('const approveReview'), source.indexOf('const rejectReview'));
const taskSourcePicker = postBriefsSource.slice(postBriefsSource.indexOf('Only editable sources show here'), postBriefsSource.indexOf('label="Brief name"'));
const editBriefSource = source.slice(source.indexOf('const sourceDraftIsSameAssignment'), source.indexOf('const addSourceLinks'));
const briefEditDialogSource = readFileSync(
  new URL('../app/dashboard/creative-os/components/shared/BriefEditDialog.tsx', import.meta.url),
  'utf8',
);
const editBriefUi = briefEditDialogSource;
const libraryTileSource = readFileSync(new URL('../app/dashboard/creative-os/components/library/CreativeLibraryFileTile.tsx', import.meta.url), 'utf8');

assert.match(usageCountSource, /state\.launchItems\.reduce/, 'Source usage is counted from approved launch items');
assert.match(usageCountSource, /sourceIds\.includes\(sourceId\)/, 'Usage count supports sourceCreativeIds on multi-source deliveries');
assert.match(approveReviewSource, /const nextUsageCount = approvedSourceUsageCount\(nextState, source\.id\)/, 'Approving a review recalculates source usage');
assert.match(approveReviewSource, /nextUsageCount >= source\.derivativeCap[\s\S]*"maxed out"/, 'Sources move to Used when they hit their cap');
assert.match(source, /const productTaskSources = productSources\.filter\(sourceIsEditable\)/, 'New briefs only pick editable sources');
assert.match(taskSourcePicker, /When a source reaches its[\s\S]*cap, it moves to Used and leaves this picker\./, 'The brief picker explains the Used transition');
assert.match(sourcesLib, /function sourceIsEditable/, 'Brief editing shares the same editable-source rule');
assert.match(editBriefSource, /This source is already Used or paused/, 'Brief editing blocks reassignment to Used or paused sources');
assert.match(editBriefUi, /productTaskSelectionGroups\.map/, 'Brief editing only offers editable source groups');
assert.match(editBriefUi, /productTaskSources\.map/, 'Brief editing only offers editable single sources');
assert.match(libraryTileSource, /const statusLabel = sourceStatusLabel\(source\)/, 'Library file tiles show source status');
assert.match(libraryTileSource, /statusLabel === "Used"/, 'Library file tiles visibly distinguish Used sources');
