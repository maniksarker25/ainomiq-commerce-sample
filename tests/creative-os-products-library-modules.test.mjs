import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx', import.meta.url), 'utf8');
const productsSource = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/ProductsTab.tsx', import.meta.url), 'utf8');
const librarySource = readFileSync(new URL('../app/dashboard/creative-os/components/tabs/LibraryTab.tsx', import.meta.url), 'utf8');
const navSource = source.slice(source.indexOf('const screenNav'), source.indexOf('if (!ready)'));

assert.match(navSource, /label: "Products"/, 'Creative OS has a Products module');
assert.match(navSource, /label: "Library"/, 'Creative OS has a Library module');
assert.match(navSource, /active:[\s\S]*state\.activeSection === "dashboard" \|\| state\.activeSection === "setup"/, 'Products module owns product setup only');
assert.match(navSource, /active: state\.activeSection === "sources"/, 'Library module owns source files only');
assert.match(productsSource, /Product setup/, 'Products module renders product setup');
assert.doesNotMatch(productsSource, /Ainomiq Library<\/div>/, 'Products module must not render the Library browser');
assert.match(librarySource, /Ainomiq Library/, 'Library module renders the source browser');
assert.doesNotMatch(librarySource, /Product setup|Product set details/, 'Library module must not render product setup copy');
