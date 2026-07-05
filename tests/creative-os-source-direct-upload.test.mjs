import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');
const uploadSourceBlock = source.slice(
  source.indexOf('const uploadSourceFiles'),
  source.indexOf('const inviteEditor'),
);

assert.match(uploadSourceBlock, /\/api\/creative-library\/upload-url/, 'Source uploads should request a direct storage upload URL');
assert.match(uploadSourceBlock, /method:\s*upload\.method \|\| "PUT"/, 'Source files should upload directly to storage instead of buffering through the app route');
assert.match(uploadSourceBlock, /\/api\/creative-library\/complete-upload/, 'Source uploads should register the uploaded storage object in the Ainomiq Library');
assert.match(uploadSourceBlock, /creative-os-source/, 'Source uploads should be tagged as source assets');
assert.doesNotMatch(uploadSourceBlock, /\/api\/creative-library\/upload-file/, 'Source uploads must not go through the buffered app upload route');
assert.doesNotMatch(uploadSourceBlock, /new FormData\(\)/, 'Source uploads must not send video files through multipart app requests');
