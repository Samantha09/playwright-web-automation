import { test, expect } from '@playwright/test';
import { CandidateGenerator } from '../../src/core/CandidateGenerator';
import { DiscoveredForm, PageStructure } from '../../src/types/discovery';

test('CandidateGenerator generates login case', () => {
  const generator = new CandidateGenerator();
  const form: DiscoveredForm = {
    id: 'login-form',
    pageUrl: 'http://localhost/login',
    confidence: 0.95,
    fields: [
      { role: 'username', selector: 'input[name="email"]', confidence: 0.8 },
      { role: 'password', selector: 'input[type="password"]', confidence: 0.95 },
    ],
    submitSelector: 'button[type="submit"]',
  };
  const cases = generator.generateFromForm(form, 'http://localhost');
  expect(cases.some((c) => c.id === 'login-form-login')).toBe(true);
  const loginCase = cases.find((c) => c.id === 'login-form-login')!;
  expect(loginCase.steps.some((s) => s.action === 'fill' && s.params.value === '${PASSWORD}')).toBe(true);
});

test('CandidateGenerator generates search case', () => {
  const generator = new CandidateGenerator();
  const form: DiscoveredForm = {
    id: 'search-form',
    pageUrl: 'http://localhost/search',
    confidence: 0.9,
    fields: [{ role: 'search', selector: 'input[type="search"]', confidence: 0.8 }],
    submitSelector: 'button[type="submit"]',
  };
  const cases = generator.generateFromForm(form, 'http://localhost');
  expect(cases.some((c) => c.id === 'search-form-search')).toBe(true);
});

test('CandidateGenerator generates nav candidates from structure', () => {
  const generator = new CandidateGenerator();
  const structure: PageStructure = {
    nav: [
      { text: '首页', href: 'http://x/home' },
      { text: '关于', href: 'http://x/about' },
    ],
    headings: [],
    actions: [],
  };
  const cases = generator.generateFromStructure(structure, 'http://x/', 'http://x');
  expect(cases.length).toBe(2);
  expect(cases.every((c) => c.source === 'heuristic-nav')).toBe(true);
  const first = cases[0];
  expect(first.steps.some((s) => s.action === 'click')).toBe(true);
  expect(first.assertions.some((a) => a.type === 'urlContains' && a.expected === '/home')).toBe(true);
  expect(first.id).toContain('nav-');
});

test('CandidateGenerator caps nav candidates at 8', () => {
  const generator = new CandidateGenerator();
  const structure: PageStructure = {
    nav: Array.from({ length: 12 }, (_, i) => ({ text: `nav${i}`, href: `http://x/n${i}` })),
    headings: [],
    actions: [],
  };
  expect(generator.generateFromStructure(structure, 'http://x/', 'http://x').length).toBe(8);
});
