import { test, expect } from '@playwright/test';
import { slugify, targetSlug } from '../../src/utils/slug';

test('slugify produces filesystem-safe slugs', () => {
  expect(slugify('Hello World!')).toBe('hello-world');
  expect(slugify('127.0.0.1:8080')).toBe('127-0-0-1-8080');
  expect(slugify('My App / Site')).toBe('my-app-site');
  expect(slugify('---leading---trailing---')).toBe('leading-trailing');
});

test('targetSlug derives from URL host(+port) or explicit name', () => {
  expect(targetSlug('http://127.0.0.1:8080')).toBe('127-0-0-1-8080');
  expect(targetSlug('https://example.com')).toBe('example-com');
  expect(targetSlug('https://app.foo.com:3000')).toBe('app-foo-com-3000');
  expect(targetSlug('https://x.com', 'Spug 运维')).toBe('spug');
  expect(targetSlug('not a url', 'FinBot')).toBe('finbot');
});
