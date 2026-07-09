import * as fs from 'fs';
import * as path from 'path';
import { Case } from '../types/case';

export function substituteEnvVars(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => process.env[name] || '');
  }
  if (Array.isArray(value)) {
    return value.map(substituteEnvVars);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, substituteEnvVars(v)]),
    );
  }
  return value;
}

export function loadCases(dir: string): Case[] {
  const cases: Case[] = [];
  if (!fs.existsSync(dir)) return cases;

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    const parsed = JSON.parse(raw);
    const substituted = substituteEnvVars(parsed);
    if (Array.isArray(substituted)) {
      cases.push(...(substituted as Case[]));
    } else {
      cases.push(substituted as Case);
    }
  }
  return cases;
}
