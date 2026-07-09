import { test, expect } from '@playwright/test';
import { parseFrontmatter } from '../../src/prompts/frontmatter';

test('parses frontmatter and body', () => {
  const raw = `---
id: a/b
version: 1.2.0
lang: zh
title: Hello
---
body line 1
body line 2`;
  const { data, body } = parseFrontmatter(raw);
  expect(data).toEqual({ id: 'a/b', version: '1.2.0', lang: 'zh', title: 'Hello' });
  expect(body).toBe('body line 1\nbody line 2');
});

test('returns empty data and raw body when no frontmatter', () => {
  const raw = 'just body';
  const { data, body } = parseFrontmatter(raw);
  expect(data).toEqual({});
  expect(body).toBe('just body');
});

test('strips surrounding quotes from values', () => {
  const raw = `---
id: "a/b"
title: 'Hello World'
---
x`;
  const { data } = parseFrontmatter(raw);
  expect(data.id).toBe('a/b');
  expect(data.title).toBe('Hello World');
});

test('skips blank and comment lines', () => {
  const raw = `---
# a comment
id: a/b

version: 1.0.0
---
x`;
  const { data } = parseFrontmatter(raw);
  expect(data).toEqual({ id: 'a/b', version: '1.0.0' });
});

test('throws on invalid frontmatter line (no colon)', () => {
  const raw = `---
id: a/b
this line has no colon
---
x`;
  expect(() => parseFrontmatter(raw, '/tmp/x.md')).toThrow(/Invalid frontmatter line.*this line has no colon/);
});

test('preserves colons inside the value (splits on first colon)', () => {
  const raw = `---
url: https://example.com
---
x`;
  const { data } = parseFrontmatter(raw);
  expect(data.url).toBe('https://example.com');
});
