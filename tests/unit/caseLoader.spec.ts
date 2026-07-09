import { test, expect } from '@playwright/test';
import { substituteEnvVars } from '../../src/utils/caseLoader';

test('substituteEnvVars replaces placeholders', () => {
  process.env.TEST_VAR = 'hello';
  const result = substituteEnvVars('${TEST_VAR} world');
  expect(result).toBe('hello world');
});

test('substituteEnvVars handles nested objects', () => {
  process.env.NESTED_VAR = 'value';
  const result = substituteEnvVars({ key: '${NESTED_VAR}', arr: ['${NESTED_VAR}'] });
  expect(result).toEqual({ key: 'value', arr: ['value'] });
});
