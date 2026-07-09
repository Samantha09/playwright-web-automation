import { test, expect } from '@playwright/test';
import { normalizePromptText } from '../../src/prompts/normalize';

test('converts CRLF to LF', () => {
  expect(normalizePromptText('a\r\nb\r\nc')).toBe('a\nb\nc');
});

test('converts lone CR to LF', () => {
  expect(normalizePromptText('a\rb')).toBe('a\nb');
});

test('strips trailing whitespace per line', () => {
  expect(normalizePromptText('a   \nb\t\n')).toBe('a\nb');
});

test('trims leading and trailing whitespace', () => {
  expect(normalizePromptText('\n\n  hello  \n\n')).toBe('hello');
});

test('preserves meaningful blank lines (does not collapse them)', () => {
  expect(normalizePromptText('para one\n\npara two')).toBe('para one\n\npara two');
});

test('idempotent', () => {
  const input = 'a\r\nb  \n\nc';
  const once = normalizePromptText(input);
  expect(normalizePromptText(once)).toBe(once);
});
