import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const notifications = readFileSync(new URL('../lib/creative-os-notifications.ts', import.meta.url), 'utf8');
const notifyBlock = notifications.slice(
  notifications.indexOf('export async function notifyCreativeOsStateChanges'),
  notifications.length,
);

assert.doesNotMatch(notifyBlock, /source_uploaded|notifySourceUploaded|newSources/, 'Source library uploads must not trigger emails');
assert.doesNotMatch(notifyBlock, /chat_message|notifyChatMessageSent|newChatMessages/, 'Chat messages must not trigger emails');
assert.match(notifications, /function resolveEditorEmail/, 'Brief notifications resolve editor email from permissions');
assert.match(notifications, /notifyEditorBriefUpdated/, 'Brief updates notify assigned editors');
assert.match(notifications, /resolveEditorEmail\(asString\(task\.assignee\), permissions\)/, 'brief_posted uses resolveEditorEmail');
assert.match(notifications, /async function notifyFounderDeliverySubmitted/, 'Delivery submission handler exists');
assert.match(notifications, /actor\.accessMode !== 'creative-editor'/, 'Delivery emails require a creative-editor actor');
assert.match(notifications, /function isVideoDelivery/, 'Delivery emails require a finished video');
assert.match(notifications, /Finished video submitted for review/, 'Delivery email copy mentions finished video');
assert.match(notifications, /Finished video ready for review/, 'Delivery email title mentions finished video');
assert.match(notifications, /eventType: 'brief_updated'/, 'Brief updated notifications are deduped separately');
assert.match(notifications, /function briefChangeSummary/, 'Brief updates use human-readable change summary');
assert.match(notifications, /labels\.add\('Source material'\)/, 'Source changes use a readable label');
const briefUpdatedEmail = notifications.slice(
  notifications.indexOf('async function notifyEditorBriefUpdated'),
  notifications.indexOf('async function notifyFounderDeliverySubmitted'),
);
assert.match(briefUpdatedEmail, /What changed:/, 'Brief updated email lists what changed');
assert.doesNotMatch(briefUpdatedEmail, /sourceGroupKey|sourceCreativeId/, 'Brief updated email must not expose raw field keys');
