import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const clientNormalize = readFileSync(new URL('../app/dashboard/creative-os/lib/normalize.ts', import.meta.url), 'utf8');
const serverRoute = readFileSync(new URL('../app/api/ad-manager/creative-os/route.ts', import.meta.url), 'utf8');

assert.match(clientNormalize, /function repairIncompleteMultiOutputTasks/, 'Client state normalization should repair incomplete multi-output tasks');
assert.match(clientNormalize, /approvedCountByTaskId/, 'Client repair should count approved launch items, not just submitted edits');
assert.match(clientNormalize, /if \(task\.status !== "delivered"\) return task/, 'Client repair should only reopen tasks that were closed as delivered');
assert.match(clientNormalize, /approvedCount < expectedOutputs[\s\S]*status: "in progress"/, 'Client repair should reopen delivered multi-output tasks until all outputs are approved');
assert.match(clientNormalize, /return repairIncompleteMultiOutputTasks\([\s\S]*applyDeletedReviewIds/, 'Client normalize should apply the repair when loading Creative OS state');

assert.match(serverRoute, /function repairIncompleteMultiOutputTasks/, 'Server state normalization should repair incomplete multi-output tasks');
assert.match(serverRoute, /approvedCountByTaskId/, 'Server repair should count approved launch items, not just submitted edits');
assert.match(serverRoute, /if \(task\.status !== 'delivered'\) return task/, 'Server repair should only reopen tasks that were closed as delivered');
assert.match(serverRoute, /approvedCount < expectedOutputs \? \{ \.\.\.task, status: 'in progress' \}/, 'Server repair should reopen delivered multi-output tasks until all outputs are approved');
assert.match(serverRoute, /return repairIncompleteMultiOutputTasks\(applyDeletedReviewIds/, 'Server normalize should apply the repair when reading stored state');
assert.match(serverRoute, /applySourceLifecycle\(repairIncompleteMultiOutputTasks/, 'Server save should repair state before persisting after editor/customer merges');
