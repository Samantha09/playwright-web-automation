import { test, expect } from '@playwright/test';
import { CandidateGenerator } from '../../src/core/CandidateGenerator';
import { DiscoveredForm } from '../../src/types/discovery';

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
