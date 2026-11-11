import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { siteFiles } from './site-files.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '_site');
// _site is a generated artifact, never a source directory.
await rm(output, { recursive: true, force: true });
await mkdir(output);
for (const file of siteFiles) await cp(path.join(root, file), path.join(output, file), { recursive: true });
console.log('Static publication files prepared in _site/');
