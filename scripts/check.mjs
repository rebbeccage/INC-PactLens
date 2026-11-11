import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { siteFiles } from './site-files.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const file of siteFiles) await access(path.join(root, file));
const scripts = ['home.js', 'app.js', 'docx-export.js', 'model.js', 'data.js', 'meetings.js', 'source-documents.js', 'clauses.js', 'layout.js', 'languages.js', 'ui.js', 'topics.js', 'research.js', 'analysis-worker.js', 'source-pages.js', 'source-numbering.js',
  ...(await readdir(path.join(root, 'scripts'))).filter(x => x.endsWith('.mjs')).map(x => 'scripts/' + x)];
for (const file of scripts) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  assert.equal(result.status, 0, `Invalid JavaScript in ${file}: ${result.stderr}`);
}
let assets = 0;
for (const page of ['index.html', 'workspace.html']) {
  const html = await readFile(path.join(root, page), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const target = match[1];
    if (/^(?:https?:|data:|#)/.test(target)) continue;
    assert.ok(!target.startsWith('/'), `${page}: root-relative asset breaks repository subpaths: ${target}`);
    const url = new URL(target, `https://example.github.io/plastic-treaty-workbench/${page}`);
    assert.ok(url.pathname.startsWith('/plastic-treaty-workbench/'), `Asset escapes repository: ${target}`);
    const relative = decodeURIComponent(url.pathname.slice('/plastic-treaty-workbench/'.length));
    await access(path.join(root, relative || 'index.html'));
    assets++;
  }
}
console.log(`JavaScript syntax and ${assets} local page references passed, including repository subpaths.`);
