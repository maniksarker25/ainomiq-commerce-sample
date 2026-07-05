import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');
const productSetup = source.slice(source.indexOf('Product setup'), source.indexOf('Connect source material for new ads'));

assert.doesNotMatch(productSetup, /Active tenant/i, 'Products UI must not expose tenant/environment labels');
assert.doesNotMatch(productSetup, /tenantId \|\| 'anonymous'/, 'Products UI must not render raw tenant ids');
