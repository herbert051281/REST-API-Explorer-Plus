import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/bookmarklet.js', import.meta.url), 'utf8');

const onAllDoneMatch = source.match(/function onAllDone\(\) \{([\s\S]*?)\n        \}/);
assert.ok(onAllDoneMatch, 'detect flow should define onAllDone() for detected fields');

assert.match(
  onAllDoneMatch[1],
  /urlTabActive\s*=\s*false\s*;/,
  'detected fields should open My Query on the Power Query M tab'
);
