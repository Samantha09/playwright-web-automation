import { test, expect } from '@playwright/test';
import { createRegistry, definePrompt, PromptRegistry } from '../../src/prompts';
import { writePromptTree } from './helpers/prompts';

const FIXTURES = {
  'greet_zh.md': `---
id: t/greet
version: 1.0.0
lang: zh
---
你好 {{name}}`,
  'greet_en.md': `---
id: t/greet
version: 1.0.0
lang: en
---
hi {{name}}`,
  'base_zh.md': `---
id: t/base
version: 1.0.0
lang: zh
---
PREAMBLE {{name}}`,
  'composed_zh.md': `---
id: t/composed
version: 1.0.0
lang: zh
---
MAIN {{name}}`,
};

const greet = definePrompt<{ name: string }>('t/greet');
const composed = definePrompt<{ name: string }>('t/composed', { partials: ['t/base'] });

function buildRegistry(extra: Record<string, string> = {}): { reg: PromptRegistry; dir: string } {
  const dir = writePromptTree({ ...FIXTURES, ...extra });
  const reg = createRegistry({ contentDir: dir, definitions: [greet, composed] });
  return { reg, dir };
}

test('indexes content: has / list / get', () => {
  const { reg } = buildRegistry();
  expect(reg.has('t/greet')).toBe(true);
  expect(reg.has('t/missing')).toBe(false);
  expect(reg.list().sort()).toEqual(['t/base', 't/composed', 't/greet']);
  expect(reg.get('t/greet', 'en').lang).toBe('en');
});

test('render typed def substitutes and returns metadata', () => {
  const { reg } = buildRegistry();
  const result = reg.render(greet, { name: 'san' });
  expect(result.text).toBe('你好 san');
  expect(result).toMatchObject({ id: 't/greet', version: '1.0.0', lang: 'zh' });
});

test('render by id (dynamic) works', () => {
  const { reg } = buildRegistry();
  expect(reg.render('t/greet', { name: 'x' }).text).toBe('你好 x');
});

test('render respects explicit lang option', () => {
  const { reg } = buildRegistry();
  expect(reg.render(greet, { name: 'x' }, { lang: 'en' }).text).toBe('hi x');
});

test('render falls back to default lang (zh) with a warning when requested lang missing', () => {
  const { reg } = buildRegistry();
  const warnings: string[] = [];
  const orig = console.warn;
  console.warn = (msg: string) => warnings.push(msg);
  try {
    // t/composed only has zh
    const result = reg.render(composed, { name: 'x' }, { lang: 'en' });
    expect(result.lang).toBe('zh');
    expect(warnings.some((w) => w.includes('t/composed'))).toBe(true);
  } finally {
    console.warn = orig;
  }
});

test('render composes partials (default concat)', () => {
  const { reg } = buildRegistry();
  const result = reg.render(composed, { name: 'x' });
  expect(result.text).toBe('PREAMBLE x\n\nMAIN x');
});

test('render throws on unknown id', () => {
  const { reg } = buildRegistry();
  expect(() => reg.render('t/nope', {})).toThrow(/Unknown prompt id: t\/nope/);
});

test('render throws on missing variable', () => {
  const { reg } = buildRegistry();
  expect(() => reg.render(greet, {} as { name: string })).toThrow(/missing variable: \{\{name\}\}/);
});

test('registry throws on definition/content version mismatch', () => {
  const dir = writePromptTree({
    'greet_zh.md': `---
id: t/greet
version: 2.0.0
lang: zh
---
hi {{name}}`,
  });
  const def = definePrompt<{ name: string }>('t/greet', { version: '1.0.0' });
  expect(() => createRegistry({ contentDir: dir, definitions: [def] })).toThrow(/version mismatch/);
});

test('registry throws when definition references unknown partial', () => {
  const dir = writePromptTree({
    'x_zh.md': `---
id: t/x
version: 1.0.0
lang: zh
---
x`,
  });
  const def = definePrompt('t/x', { partials: ['t/ghost'] });
  expect(() => createRegistry({ contentDir: dir, definitions: [def] })).toThrow(
    /references unknown partial: t\/ghost/,
  );
});

test('registry throws when definition has no matching content', () => {
  const dir = writePromptTree(FIXTURES);
  const def = definePrompt('t/orphan');
  expect(() => createRegistry({ contentDir: dir, definitions: [def] })).toThrow(
    /no matching content file/,
  );
});

test('registry throws on duplicate definition', () => {
  const dir = writePromptTree(FIXTURES);
  expect(() =>
    createRegistry({ contentDir: dir, definitions: [greet, greet] }),
  ).toThrow(/Duplicate prompt definition/);
});

test('render applies normalization (trims trailing whitespace)', () => {
  const dir = writePromptTree({
    'x_zh.md': `---
id: t/x
version: 1.0.0
lang: zh
---
line one
line two
   `,
  });
  const def = definePrompt('t/x');
  const reg = createRegistry({ contentDir: dir, definitions: [def] });
  expect(reg.render('t/x', {}).text).toBe('line one\nline two');
});

test('custom compose function is applied', () => {
  const def = definePrompt<{ name: string }>('t/composed', {
    partials: ['t/base'],
    compose: (body, partials) => `<<${partials['t/base']}>>${body}`,
  });
  const dir = writePromptTree(FIXTURES);
  const reg = createRegistry({ contentDir: dir, definitions: [def] });
  expect(reg.render(def, { name: 'x' }).text).toBe('<<PREAMBLE x>>MAIN x');
});
