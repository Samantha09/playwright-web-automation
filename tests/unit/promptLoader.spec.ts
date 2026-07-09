import { test, expect } from '@playwright/test';
import { loadPrompts, assertNoDuplicates } from '../../src/prompts/loader';
import { writePromptTree } from './helpers/prompts';

const GOOD = {
  'a/hello_zh.md': `---
id: a/hello
version: 1.0.0
lang: zh
title: Hi
---
hello {{name}}`,
  'a/hello_en.md': `---
id: a/hello
version: 1.0.0
lang: en
---
hello {{name}}`,
  'b/base_zh.md': `---
id: b/base
version: 1.0.0
lang: zh
---
preamble`,
};

test('loadPrompts recursively loads .md files and parses fields', () => {
  const dir = writePromptTree(GOOD);
  const files = loadPrompts(dir);
  expect(files).toHaveLength(3);
  const helloZh = files.find((f) => f.id === 'a/hello' && f.lang === 'zh')!;
  expect(helloZh.version).toBe('1.0.0');
  expect(helloZh.title).toBe('Hi');
  expect(helloZh.body).toContain('hello {{name}}');
  expect(helloZh.filePath).toContain('a/hello_zh.md');
});

test('loadPrompts ignores non-md files', () => {
  const dir = writePromptTree({ ...GOOD, 'a/readme.txt': 'ignore me' });
  expect(loadPrompts(dir)).toHaveLength(3);
});

test('loadPrompts throws on missing required field', () => {
  const dir = writePromptTree({
    'a/bad.md': `---
id: a/bad
lang: zh
---
no version here`,
  });
  expect(() => loadPrompts(dir)).toThrow(/missing required frontmatter field.*version/);
});

test('loadPrompts throws on invalid frontmatter line', () => {
  const dir = writePromptTree({
    'a/bad.md': `---
id: a/bad
no colon line
version: 1.0.0
lang: zh
---
x`,
  });
  expect(() => loadPrompts(dir)).toThrow(/Invalid frontmatter line/);
});

test('loadPrompts throws when content dir does not exist', () => {
  expect(() => loadPrompts('/does/not/exist/xyz')).toThrow(/content directory not found/);
});

test('assertNoDuplicates throws on duplicate id+lang', () => {
  const dir = writePromptTree({
    'a/x_zh.md': `---
id: a/x
version: 1.0.0
lang: zh
---
x`,
    'b/x_zh.md': `---
id: a/x
version: 1.0.0
lang: zh
---
x2`,
  });
  const files = loadPrompts(dir);
  expect(() => assertNoDuplicates(files)).toThrow(/Duplicate prompt a\/x@zh/);
});

test('assertNoDuplicates allows same id with different langs', () => {
  const dir = writePromptTree(GOOD);
  expect(() => assertNoDuplicates(loadPrompts(dir))).not.toThrow();
});
