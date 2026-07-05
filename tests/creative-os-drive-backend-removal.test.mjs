import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const workspace = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');
const stateRoute = readFileSync(new URL('../app/api/ad-manager/creative-os/route.ts', import.meta.url), 'utf8');
const invitesRoute = readFileSync(new URL('../app/api/ad-manager/creative-os/invites/route.ts', import.meta.url), 'utf8');
const inviteRespondRoute = readFileSync(new URL('../app/api/ad-manager/creative-os/invites/respond/route.ts', import.meta.url), 'utf8');
const notifications = readFileSync(new URL('../lib/creative-os-notifications.ts', import.meta.url), 'utf8');

assert.doesNotMatch(workspace, /drive-source-health|drive-source-archive|workspaceDriveEmail/, 'Creative OS UI must not use Drive as backend plumbing');
assert.doesNotMatch(stateRoute, /ensureCreativeOsProductDriveStructure|shareDriveFoldersWithEmail|driveEmail|Google Drive video/, 'Creative OS state route must not prepare or share Drive folders');
assert.doesNotMatch(invitesRoute, /shareDriveFoldersWithEmail|revokeDriveFolderAccessForEmail|Drive folders|Drive folder/, 'Invite route must not manage Drive permissions');
assert.doesNotMatch(inviteRespondRoute, /shareDriveFoldersWithEmail|ensureCreativeOsProductDriveStructure|Drive share/, 'Invite accept route must not share Drive folders');
assert.doesNotMatch(notifications, /Open source folder|sourceGroupUrl|backendFolderUrl/, 'Notifications must not send backend/source folder links');

assert.equal(existsSync(new URL('../app/api/ad-manager/creative-os/drive-source-import/route.ts', import.meta.url)), true, 'Drive import endpoint remains available');
assert.equal(existsSync(new URL('../app/api/ad-manager/creative-os/drive-source-health/route.ts', import.meta.url)), false, 'Drive source health backend endpoint is removed');
assert.equal(existsSync(new URL('../app/api/ad-manager/creative-os/drive-source-archive/route.ts', import.meta.url)), false, 'Drive source archive backend endpoint is removed');
assert.equal(existsSync(new URL('../app/api/ad-manager/creative-os/drive-structure/route.ts', import.meta.url)), false, 'Drive structure backend endpoint is removed');
