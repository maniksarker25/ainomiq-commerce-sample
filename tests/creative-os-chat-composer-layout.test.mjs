import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const widgetsSource = readFileSync(new URL('../app/dashboard/creative-os/components/shared/WorkspaceWidgets.tsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');

assert.match(widgetsSource, /<ScrollArea className="min-h-0 flex-1 px-4 py-5">/, 'Chat message scroll area should be allowed to shrink inside the panel');
assert.match(widgetsSource, /<div className="shrink-0 border-t bg-background p-3">/, 'Chat composer should stay visible instead of being pushed below the panel');
assert.match(widgetsSource, /placeholder="Write a message\.\.\."/, 'Chat composer input should remain present');
assert.match(widgetsSource, /disabled=\{!draft\.trim\(\)\}/, 'Send button should only disable for empty drafts');

assert.match(workspaceSource, /const sendChatMessage = \(roomId: string\) => \{[\s\S]*chatMessages: \[\.\.\.current\.chatMessages, message\]/, 'Chat send should still append the new message to state');
assert.match(workspaceSource, /setChatDrafts\(\(current\) => \(\{ \.\.\.current, \[roomId\]: "" \}\)\)/, 'Chat send should clear the draft after sending');
