import { test, expect } from '@playwright/test';
import { substitutePlaceholders, composeBody } from '../../src/prompts/renderer';
import { PromptDefinition } from '../../src/prompts/types';

test('substitutePlaceholders replaces {{var}}', () => {
  expect(substitutePlaceholders('hi {{name}}!', { name: 'san' }, 't/x')).toBe('hi san!');
});

test('substitutePlaceholders handles multiple and repeated vars', () => {
  expect(substitutePlaceholders('{{a}}-{{a}}-{{b}}', { a: '1', b: '2' }, 't/x')).toBe('1-1-2');
});

test('substitutePlaceholders stringifies non-string values', () => {
  expect(substitutePlaceholders('n={{n}}', { n: 42 }, 't/x')).toBe('n=42');
});

test('substitutePlaceholders tolerates braces that are not placeholders', () => {
  expect(substitutePlaceholders('{ not a var } {{x}}', { x: '1' }, 't/x')).toBe('{ not a var } 1');
});

test('substitutePlaceholders throws clearly on missing var', () => {
  expect(() => substitutePlaceholders('{{x}}', {}, 't/x')).toThrow(
    /Prompt <t\/x> missing variable: \{\{x\}\}/,
  );
});

test('substitutePlaceholders treats explicit undefined as missing', () => {
  expect(() => substitutePlaceholders('{{x}}', { x: undefined }, 't/x')).toThrow(/missing variable/);
});

test('composeBody returns body when no partials and no compose', () => {
  const def: PromptDefinition = { id: 't/x' };
  expect(composeBody('BODY', {}, def)).toBe('BODY');
});

test('composeBody default-concatenates partials before body', () => {
  const def: PromptDefinition = { id: 't/x', partials: ['t/p1', 't/p2'] };
  const partials = { 't/p1': 'P1', 't/p2': 'P2' };
  expect(composeBody('BODY', partials, def)).toBe('P1\n\nP2\n\nBODY');
});

test('composeBody skips missing partial text gracefully', () => {
  const def: PromptDefinition = { id: 't/x', partials: ['t/missing'] };
  expect(composeBody('BODY', {}, def)).toBe('BODY');
});

test('composeBody uses custom compose function when provided', () => {
  const def: PromptDefinition = {
    id: 't/x',
    partials: ['t/p'],
    compose: (body, partials) => `[${partials['t/p']}]>${body}`,
  };
  expect(composeBody('BODY', { 't/p': 'P' }, def)).toBe('[P]>BODY');
});
