import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspaceWidgets = readFileSync(new URL('../app/dashboard/creative-os/components/shared/WorkspaceWidgets.tsx', import.meta.url), 'utf8');

assert.match(workspaceWidgets, /const \[customValue, setCustomValue\]/, 'Strategy picker should keep a custom draft for the active tab');
assert.match(workspaceWidgets, /Other \{noun\}/, 'Strategy picker should show an "Other <noun>" field for the active tab');
assert.match(workspaceWidgets, /placeholder=\{`Write your own \$\{noun\}`\}/, 'Custom field should invite users to write their own audience/angle/format/hook');
assert.match(workspaceWidgets, /onPick\(activeKind, customTrimmed\)/, 'Custom submit should add the typed value to the active tab field');
assert.match(workspaceWidgets, /setCustomValue\(""\)/, 'Custom submit should clear the input after adding');
assert.match(workspaceWidgets, /dedupeItems\(personas, selectedPersonas\)/, 'Audience tab should keep custom selected personas visible even when they are not saved product personas');
assert.match(workspaceWidgets, /activeItems\.map/, 'The active tab should render its combined product and selected custom values');
