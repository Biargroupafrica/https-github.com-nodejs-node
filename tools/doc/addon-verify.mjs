#!/usr/bin/env node

// Extracts C++ addon examples from doc/api/addons.md into numbered test
// directories under test/addons/.
//
// Each code block to extract is preceded by a marker in the markdown:
//
//   <!-- addon-verify-file worker_support/addon.cc -->
//   ```cpp
//   #include <node.h>
//   ...
//   ```
//
// This produces test/addons/01_worker_support/addon.cc.
// Sections are numbered in order of first appearance.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    input: { type: 'string' },
    output: { type: 'string' },
  },
});

if (!values.input || !values.output) {
  console.error('Usage: addon-verify.mjs --input <file> --output <dir>');
  process.exit(1);
}

const src = readFileSync(values.input, 'utf8');

// Collect files grouped by section directory name.
const MARKER_RE = /^<!--\s*addon-verify-file\s+(\S+?)\/(\S+)\s*-->$/gm;
const FENCE_RE = /```\w*\n([\s\S]*?)\n```/;
const entries = [];
for (const match of src.matchAll(MARKER_RE)) {
  const [, dir, name] = match;
  const after = src.slice(match.index + match[0].length);
  const content = after.match(FENCE_RE)?.[1];
  if (content != null) entries.push({ dir, name, content });
}
const sections = Map.groupBy(entries, (e) => e.dir);

let idx = 0;
for (const [name, files] of sections) {
  const dirName = `${String(++idx).padStart(2, '0')}_${name}`;
  const dir = join(values.output, dirName);
  mkdirSync(dir, { recursive: true });

  for (const file of files) {
    let content = file.content;
    if (file.name === 'test.js') {
      content =
        "'use strict';\n" +
        "const common = require('../../common');\n" +
        content.replace(
          "'./build/Release/addon'",
          // eslint-disable-next-line no-template-curly-in-string
          '`./build/${common.buildType}/addon`',
        );
    }
    writeFileSync(join(dir, file.name), content);
  }

  // Generate binding.gyp
  const names = files.map((f) => f.name);
  writeFileSync(join(dir, 'binding.gyp'), JSON.stringify({
    targets: [{
      target_name: 'addon',
      sources: names,
      includes: ['../common.gypi'],
    }],
  }));

  console.log(`Generated ${dirName} with files: ${names.join(', ')}`);
}
