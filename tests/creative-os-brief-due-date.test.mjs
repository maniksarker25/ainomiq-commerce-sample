import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');
const typesSource = readFileSync(new URL('../app/dashboard/creative-os/types.ts', import.meta.url), 'utf8');
const datesSource = readFileSync(new URL('../app/dashboard/creative-os/lib/dates.ts', import.meta.url), 'utf8');
const formFieldsSource = readFileSync(new URL('../app/dashboard/creative-os/_components/FormFields.tsx', import.meta.url), 'utf8');
const initialDraftSource = typesSource.slice(typesSource.indexOf('export const INITIAL_TASK_DRAFT'), typesSource.indexOf('export type TaskDraft'));
const prepareBriefSource = source.slice(source.indexOf('const prepareBriefDraft'), source.indexOf('const checkBriefSourceAvailability'));
const dueDateSelectSource = formFieldsSource.slice(formFieldsSource.indexOf('export function DueDateSelect'), formFieldsSource.indexOf('export function BriefFocusPanel'));

assert.match(initialDraftSource, /dueDate: defaultDueDate\(\)/, 'New one-time briefs should start with a real due date');
assert.match(datesSource, /const DUE_DATE_OPTION_DAYS = 90/, 'Due date choices should cover a broader future range');
assert.match(datesSource, /function futureDueDateOptions/, 'Due date choices are generated from future dates');
assert.match(datesSource, /function normalizeFutureDueDate/, 'Due dates are normalized to allowed future dates');
assert.match(prepareBriefSource, /normalizeFutureDueDate\(taskDraft\.dueDate\)/, 'Posting normalizes old blank or invalid one-time due dates');
assert.doesNotMatch(prepareBriefSource, /Add a due date before posting a one-time brief/, 'One-time briefs should not error when the visible default due date is used');
assert.match(dueDateSelectSource, /futureDueDateOptions\(\)/, 'The due date control renders bounded future options');
assert.match(dueDateSelectSource, /dueDateOptionLabel\(option\)/, 'Due date options should include the weekday label');
assert.match(datesSource, /weekday: "short"/, 'Due date labels should show the day of the week');
assert.match(datesSource, /setDate\(now\.getDate\(\) \+ index \+ 1\)/, 'Due date options must start in the future, not in the past');
assert.doesNotMatch(dueDateSelectSource, /Array\.from\(\{ length: 4 \}/, 'The due date control must not allow arbitrary future years');
